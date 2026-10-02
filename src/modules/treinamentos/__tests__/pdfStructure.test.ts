import { describe, expect, it } from 'vitest';
import forge from 'node-forge';
import { jsPDF } from 'jspdf';
import { fixLastStartxref, signPdf } from '../digitalSignature';
import { verifyPdfSignatures } from '../pades';

function makeP12(cn: string, pw: string) {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const c = forge.pki.createCertificate();
  c.publicKey = keys.publicKey; c.serialNumber = '0b';
  c.validity.notBefore = new Date(Date.now() - 864e5); c.validity.notAfter = new Date(Date.now() + 365 * 864e5);
  c.setSubject([{ shortName: 'CN', value: cn }]); c.setIssuer([{ shortName: 'CN', value: 'AC' }]);
  c.sign(keys.privateKey, forge.md.sha256.create());
  return Uint8Array.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [c], pw, { algorithm: '3des' })).getBytes(), ch => ch.charCodeAt(0));
}

/** Problemas de estrutura: startxref e posições dos objetos de cada tabela xref. */
function xrefProblems(pdf: Uint8Array): string[] {
  const s = Buffer.from(pdf).toString('latin1');
  const out: string[] = [];
  for (const m of s.matchAll(/startxref\s+(\d+)/g)) {
    const off = Number(m[1]);
    if (!s.startsWith('xref', off)) { out.push(`startxref ${off}`); continue; }
    const body = s.slice(off + 4, s.indexOf('trailer', off));
    let num = 0;
    for (const raw of body.split('\n')) {
      const l = raw.trim();
      if (!l) continue;
      const sub = /^(\d+) (\d+)$/.exec(l);
      if (sub) { num = Number(sub[1]); continue; }
      const e = /^(\d{10}) (\d{5}) ([nf])$/.exec(l);
      if (!e) { out.push(`linha ${l}`); continue; }
      if (e[3] === 'n' && !s.startsWith(`${num} ${Number(e[2])} obj`, Number(e[1]))) out.push(`objeto ${num}`);
      num++;
    }
  }
  return out;
}

describe('Estrutura do PDF assinado (para leitores não "repararem" o arquivo)', () => {
  it('com duas assinaturas, todas as tabelas xref e startxref apontam para o lugar certo', async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('Certificado VAL-TRE-2610-ABCD2345', 20, 20);
    const base = new Uint8Array(doc.output('arraybuffer'));
    expect(xrefProblems(base)).toEqual([]);
    const signed = await signPdf(base, [
      { p12: makeP12('RT:52998224725', 'a'), password: 'a', name: 'RT', reason: 'RT' },
      { p12: makeP12('INS:11144477735', 'b'), password: 'b', name: 'INS', reason: 'Instrutor' }
    ]);
    expect(xrefProblems(signed)).toEqual([]);
    const report = verifyPdfSignatures(signed);
    expect(report.signatures.map(s => s.integrity && s.cryptoValid)).toEqual([true, true]);
  }, 60000);

  it('corrige o startxref deslocado e não mexe em PDF correto', () => {
    const head = '%PDF-1.3\n1 0 obj\n<<>>\nendobj\n';
    const pos = head.length; // posição da palavra "xref"
    const ok = Buffer.from(`${head}xref\n0 1\n0000000000 65535 f \ntrailer\n<<>>\nstartxref\n${pos}\n%%EOF`);
    expect(Buffer.from(fixLastStartxref(new Uint8Array(ok))).toString()).toBe(ok.toString());
    const bad = Buffer.from(ok.toString().replace(`startxref\n${pos}`, `startxref\n${pos - 1}`));
    expect(Buffer.from(fixLastStartxref(new Uint8Array(bad))).toString()).toBe(ok.toString());
  });

  it('arquivo regravado por outro programa: mensagem clara', async () => {
    const doc = new jsPDF();
    doc.text('VAL-TRE-2610-ABCD2345', 20, 20);
    const signed = await signPdf(new Uint8Array(doc.output('arraybuffer')), [{ p12: makeP12('X:11144477735', 'a'), password: 'a', name: 'X', reason: 'r' }]);
    // simula o leitor de PDF regravando: remove 100 bytes do começo do conteúdo
    const rewritten = new Uint8Array([...signed.subarray(0, 20), ...signed.subarray(120)]);
    const [s] = verifyPdfSignatures(rewritten).signatures;
    expect(s.rewritten).toBe(true);
    expect(s.status).toBe('erro');
    expect(s.messages[0]).toContain('regravado por outro programa');
  }, 60000);
});

describe('Assinatura gerada no NAVEGADOR (Buffer do pacote "buffer")', () => {
  it('catálogo e página regravados ficam com /AcroForm e /Annots DENTRO do dicionário', async () => {
    const nodeBuffer = (globalThis as any).Buffer;
    // pacote npm "buffer" (o que o Vite usa no navegador), não o Buffer do Node
    const { Buffer: BrowserBuffer } = await import('buffer/index.js');
    (globalThis as any).Buffer = BrowserBuffer; // simula o navegador
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.text('Certificado VAL-TRE-2610-ABCD2345', 20, 20);
      const signed = await signPdf(new Uint8Array(doc.output('arraybuffer')), [
        { p12: makeP12('JVM ENGENHARIA LTDA:29894500000104', 'a'), password: 'a', name: 'JVM ENGENHARIA LTDA:29894500000104', reason: 'Instrutor – certificado de treinamento', location: 'Brasília/DF' }
      ]);
      const s = nodeBuffer.from(signed).toString('latin1');
      const update = s.slice(s.indexOf('%%EOF') + 5);
      const objects = [...update.matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g)].map(m => m[2]);
      const catalog = objects.find(o => o.includes('/Type /Catalog'))!;
      const page = objects.find(o => o.includes('/Type /Page'))!;
      // dicionário fecha só no fim, depois de /AcroForm e /Annots
      expect(catalog.trim()).toMatch(/\/AcroForm \d+ 0 R\s*>>$/);
      expect(catalog.slice(0, catalog.indexOf('/AcroForm'))).not.toContain('>>');
      expect(page.slice(0, page.indexOf('/Annots'))).not.toMatch(/>>\s*$/);
      expect(page.trim().endsWith('>>')).toBe(true);
      // textos em ASCII e cabeçalho 1.7
      expect(update).toContain('/Reason (Instrutor - certificado de treinamento)');
      expect(update).toContain('/Location (Brasilia/DF)');
      expect(s.slice(0, 8)).toBe('%PDF-1.7');
      expect(xrefProblems(signed)).toEqual([]);
      const [sig] = verifyPdfSignatures(signed).signatures;
      expect(sig.integrity && sig.cryptoValid).toBe(true);
    } finally {
      (globalThis as any).Buffer = nodeBuffer;
    }
  }, 60000);
});
