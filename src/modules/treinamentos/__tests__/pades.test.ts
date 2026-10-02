import { describe, expect, it } from 'vitest';
import forge from 'node-forge';
import { jsPDF } from 'jspdf';
import { signPdf } from '../digitalSignature';
import { verifyPdfSignatures } from '../pades';
import { ICP_POLICY, ICP_TRUST_ANCHORS_B64 } from '../icpBrasil';

function makeP12(cn: string, password: string): Uint8Array {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '5a';
  cert.validity.notBefore = new Date(Date.now() - 864e5);
  cert.validity.notAfter = new Date(Date.now() + 365 * 864e5);
  cert.setSubject([{ shortName: 'C', value: 'BR' }, { shortName: 'CN', value: cn }]);
  cert.setIssuer([{ shortName: 'C', value: 'BR' }, { shortName: 'CN', value: 'AC TESTE' }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const der = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des' })).getBytes();
  return Uint8Array.from(der, c => c.charCodeAt(0));
}

const basePdf = () => {
  const doc = new jsPDF();
  doc.text('Certificado VAL-TRE-2610-ABCD2345', 20, 20);
  return new Uint8Array(doc.output('arraybuffer'));
};

describe('Assinatura PAdES no padrão ICP-Brasil', () => {
  it('âncoras da política: ACs Raiz Brasileiras v5 e v12', () => {
    expect(Object.keys(ICP_TRUST_ANCHORS_B64)).toEqual(['Autoridade Certificadora Raiz Brasileira v5', 'Autoridade Certificadora Raiz Brasileira v12']);
    expect(ICP_POLICY.oid).toBe('2.16.76.1.7.1.11.1.3');
  });

  it('assina com ETSI.CAdES.detached, política AD-RB v1.3 e signing-certificate-v2; o sistema confere', async () => {
    const signed = await signPdf(basePdf(), [
      { p12: makeP12('ENG RT:52998224725', 'a'), password: 'a', name: 'ENG RT', reason: 'RT' },
      { p12: makeP12('INSTRUTOR:11144477735', 'b'), password: 'b', name: 'INSTRUTOR', reason: 'Instrutor' }
    ]);
    const report = verifyPdfSignatures(signed);
    expect(report.validationCodes).toEqual(['VAL-TRE-2610-ABCD2345']);
    expect(report.signatures).toHaveLength(2);
    report.signatures.forEach(s => {
      expect(s.subFilter).toBe('ETSI.CAdES.detached');
      expect(s.integrity).toBe(true);
      expect(s.cryptoValid).toBe(true);
      expect(s.signingCertOk).toBe(true);
      expect(s.policyOid).toBe('2.16.76.1.7.1.11.1.3');
      expect(s.policyName).toBe('AD-RB v1.3');
      expect(s.policyHashOk).toBe(true);
      expect(s.certValidAtSigning).toBe(true);
      // certificado de teste não pertence à ICP-Brasil: cadeia não confirmada
      expect(s.chainTrusted).toBe(false);
      expect(s.status).toBe('aviso');
      expect(s.signingTime).toBeTruthy();
    });
    expect(report.signatures[0].signerCn).toBe('ENG RT:52998224725');
    expect(report.signatures[0].coversWholeDocument).toBe(false);
    expect(report.signatures[1].coversWholeDocument).toBe(true);
  }, 60000);

  it('documento alterado depois de assinado é detectado', async () => {
    const signed = await signPdf(basePdf(), [{ p12: makeP12('X:11144477735', 'a'), password: 'a', name: 'X', reason: 'r' }]);
    const tampered = new Uint8Array(signed);
    const text = Buffer.from(tampered).toString('latin1');
    const pos = text.indexOf('VAL-TRE-2610-ABCD2345');
    tampered[pos + 8] = 'X'.charCodeAt(0);
    const [s] = verifyPdfSignatures(tampered).signatures;
    expect(s.integrity).toBe(false);
    expect(s.status).toBe('erro');
    expect(s.messages.join(' ')).toContain('alterado');
  }, 60000);

  it('PDF sem assinatura: nenhuma assinatura encontrada', () => {
    expect(verifyPdfSignatures(basePdf()).signatures).toHaveLength(0);
  });
});

describe('Resumo da política na assinatura (exigência do Verificador do ITI)', () => {
  it('usa o signPolicyHash do documento da política, não o SHA-256 do arquivo', async () => {
    const signed = await signPdf(basePdf(), [{ p12: makeP12('X:11144477735', 'a'), password: 'a', name: 'X', reason: 'r' }]);
    const text = Buffer.from(signed).toString('latin1');
    const r = [...text.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)][0].slice(1).map(Number);
    const hex = text.slice(r[0] + r[1] + 1, r[2] - 1);
    expect(hex).toContain('23e4be4b9b362172e4ebb0e72b86a133ece5aad843d8651c6e38a0ba3f08fc60');
    expect(hex).not.toContain('23da544aef71f7a75dc85fa6e17a83875741e4baef41ec178258a5c86ace54dd');
    const [s] = verifyPdfSignatures(signed).signatures;
    expect(s.policyHashOk).toBe(true);
  }, 60000);
});
