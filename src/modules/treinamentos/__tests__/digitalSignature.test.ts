import { describe, expect, it } from 'vitest';
import forge from 'node-forge';
import { jsPDF } from 'jspdf';
import { inspectP12, isCertExpired, signPdf, base64ToBytes, bytesToBase64 } from '../digitalSignature';

function makeP12(cn: string, password: string, days = 365): Uint8Array {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '0a1b';
  cert.validity.notBefore = new Date(Date.now() - 2 * 864e5);
  cert.validity.notAfter = new Date(Date.now() + days * 864e5);
  cert.setSubject([{ name: 'commonName', value: cn }]);
  cert.setIssuer([{ name: 'commonName', value: 'AC TESTE' }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const der = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des' })).getBytes();
  return Uint8Array.from(der, c => c.charCodeAt(0));
}

const rt = makeP12('ENG RT:52998224725', 'senha1');
const ins = makeP12('INSTRUTOR:11144477735', 'senha2');

describe('Certificado digital A1', () => {
  it('lê titular, CPF, emissor e validade com a senha certa', () => {
    const info = inspectP12(rt, 'senha1');
    expect(info.holderName).toBe('ENG RT');
    expect(info.holderDoc).toBe('52998224725');
    expect(info.issuer).toBe('AC TESTE');
    expect(info.commonName).toBe('ENG RT:52998224725');
    expect(info.subjectDn).toBe('CN=ENG RT:52998224725');
    expect(isCertExpired(info)).toBe(false);
  });

  it('senha errada é recusada com mensagem clara', () => {
    expect(() => inspectP12(rt, 'errada')).toThrow(/Senha incorreta/);
  });

  it('certificado vencido é identificado', () => {
    expect(isCertExpired({ validTo: new Date(Date.now() - 864e5).toISOString() })).toBe(true);
  });

  it('assina o PDF com RT e instrutor; a primeira assinatura continua íntegra', async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.text('Certificado', 20, 20);
    const pdf = new Uint8Array(doc.output('arraybuffer'));
    const signed = await signPdf(pdf, [
      { p12: rt, password: 'senha1', name: 'ENG RT', reason: 'RT' },
      { p12: ins, password: 'senha2', name: 'INSTRUTOR', reason: 'Instrutor' }
    ]);
    const text = Buffer.from(signed).toString('latin1');
    const ranges = [...text.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)].map(m => m.slice(1).map(Number));
    expect(ranges).toHaveLength(2);
    // assinatura do instrutor cobre o arquivo todo; a do RT, a versão anterior
    expect(ranges[1][2] + ranges[1][3]).toBe(signed.length);
    expect(ranges[0][2] + ranges[0][3]).toBeLessThan(signed.length);
    ranges.forEach(r => {
      const content = Buffer.concat([Buffer.from(signed.subarray(r[0], r[0] + r[1])), Buffer.from(signed.subarray(r[2], r[2] + r[3]))]);
      const hex = text.slice(r[0] + r[1] + 1, r[2] - 1).replace(/(00)+$/, '');
      const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.hexToBytes(hex))) as any;
      const attr = p7.rawCapture.authenticatedAttributes.find((a: any) => forge.asn1.derToOid(a.value[0].value) === forge.pki.oids.messageDigest);
      const md = forge.md.sha256.create();
      md.update(content.toString('binary'));
      expect(md.digest().getBytes()).toBe(attr.value[1].value[0].value);
    });
  }, 30000);

  it('sem assinantes devolve o PDF sem alteração', async () => {
    const pdf = new Uint8Array([1, 2, 3]);
    expect(await signPdf(pdf, [])).toBe(pdf);
  });

  it('base64 ida e volta', () => {
    expect(Array.from(base64ToBytes(bytesToBase64(rt)).slice(0, 20))).toEqual(Array.from(rt.slice(0, 20)));
  });
});

describe('Certificado digital A1 — dados ICP-Brasil', () => {
  it('lê tipo, nível, CNPJ, responsável, e-mail, política, usos, cadeia e impressão digital', () => {
    const A = forge.asn1;
    const other = (oid: string, val: string) => A.create(A.Class.CONTEXT_SPECIFIC, 0, true, [
      A.create(A.Class.UNIVERSAL, A.Type.OID, false, A.oidToDer(oid).getBytes()),
      A.create(A.Class.CONTEXT_SPECIFIC, 0, true, [A.create(A.Class.UNIVERSAL, A.Type.OCTETSTRING, false, val)])
    ]);
    const san = A.create(A.Class.UNIVERSAL, A.Type.SEQUENCE, true, [
      other('2.16.76.1.3.4', '01011980' + '52998224725' + '00000000000' + '123456789012345' + 'SSPSP '),
      other('2.16.76.1.3.2', 'JOAO CARLOS EVARISTO'),
      other('2.16.76.1.3.3', '29894500000104'),
      A.create(A.Class.CONTEXT_SPECIFIC, 1, false, 'contato@jvm.com.br')
    ]);
    const pol = A.create(A.Class.UNIVERSAL, A.Type.SEQUENCE, true, [A.create(A.Class.UNIVERSAL, A.Type.SEQUENCE, true, [
      A.create(A.Class.UNIVERSAL, A.Type.OID, false, A.oidToDer('2.16.76.1.2.1.51').getBytes())
    ])]);
    // AC (autoassinada) + certificado do titular emitido por ela
    const acKeys = forge.pki.rsa.generateKeyPair(1024);
    const ac = forge.pki.createCertificate();
    ac.publicKey = acKeys.publicKey; ac.serialNumber = '0f';
    ac.validity.notBefore = new Date(Date.now() - 864e5); ac.validity.notAfter = new Date(Date.now() + 3650 * 864e5);
    const acName = [{ shortName: 'C', value: 'BR' }, { shortName: 'O', value: 'ICP-Brasil' }, { shortName: 'CN', value: 'AC TESTE RFB' }];
    ac.setSubject(acName); ac.setIssuer(acName);
    ac.sign(acKeys.privateKey, forge.md.sha256.create());
    const keys = forge.pki.rsa.generateKeyPair(1024);
    const c = forge.pki.createCertificate();
    c.publicKey = keys.publicKey; c.serialNumber = '3f2a';
    c.validity.notBefore = new Date(Date.now() - 864e5); c.validity.notAfter = new Date(Date.now() + 365 * 864e5);
    c.setSubject([{ shortName: 'C', value: 'BR' }, { shortName: 'ST', value: 'DF' }, { shortName: 'O', value: 'ICP-Brasil' }, { shortName: 'OU', value: 'RFB e-CNPJ A1' }, { shortName: 'CN', value: 'JVM ENGENHARIA LTDA:29894500000104' }]);
    c.setIssuer(acName);
    c.setExtensions([
      { id: '2.5.29.17', value: A.toDer(san).getBytes() },
      { id: '2.5.29.32', value: A.toDer(pol).getBytes() },
      { name: 'keyUsage', digitalSignature: true, nonRepudiation: true, keyEncipherment: true },
      { name: 'extKeyUsage', clientAuth: true, emailProtection: true }
    ]);
    c.sign(acKeys.privateKey, forge.md.sha256.create());
    const der = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [c, ac], 'pw', { algorithm: '3des' })).getBytes();
    const info = inspectP12(Uint8Array.from(der, ch => ch.charCodeAt(0)), 'pw');
    const d = info.details;
    expect(info.holderName).toBe('JVM ENGENHARIA LTDA');
    expect([d.kind, d.level, d.icpBrasil]).toEqual(['e-CNPJ', 'A1', true]);
    expect(d.cnpj).toBe('29.894.500/0001-04');
    expect(d.responsibleName).toBe('JOAO CARLOS EVARISTO');
    expect(d.responsibleCpf).toBe('529.982.247-25');
    expect(d.email).toBe('contato@jvm.com.br');
    expect(d.subjectDn).toBe('C=BR, S=DF, O=ICP-Brasil, OU=RFB e-CNPJ A1, CN=JVM ENGENHARIA LTDA:29894500000104');
    expect(d.issuerCn).toBe('AC TESTE RFB');
    expect(d.chain).toEqual(['AC TESTE RFB']);
    expect(d.policies).toEqual(['2.16.76.1.2.1.51']);
    expect(d.keyUsage).toEqual(['Assinatura digital', 'Não repúdio', 'Cifragem de chave']);
    expect(d.extKeyUsage).toEqual(['Autenticação de cliente', 'Proteção de e-mail']);
    expect(d.signatureAlgorithm).toBe('sha256WithRSAEncryption');
    expect(d.keyBits).toBe(1024);
    expect(d.sha256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    // dados pessoais que não interessam à assinatura não são lidos
    expect(JSON.stringify(d)).not.toMatch(/01011980|123456789012345|SSPSP/);
  });
});
