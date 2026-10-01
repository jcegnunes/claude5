/**
 * Assinatura digital ICP-Brasil (certificado A1 .pfx/.p12) dos PDFs de
 * certificado de treinamento. Cada assinatura é acrescentada como atualização
 * incremental do PDF, então a primeira (RT) continua válida depois da segunda
 * (instrutor). Bibliotecas carregadas só quando usadas.
 */
import forge from 'node-forge';

export interface SigningCertInfo {
  holderName: string;
  /** CPF/CNPJ do titular, quando presente no certificado ICP-Brasil */
  holderDoc: string;
  issuer: string;
  serial: string;
  validFrom: string;
  validTo: string;
}

export interface PdfSigner {
  /** Conteúdo do arquivo .pfx/.p12 */
  p12: Uint8Array;
  password: string;
  name: string;
  reason: string;
}

function bytesToBinary(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return s;
}

/**
 * Abre o certificado com a senha e devolve os dados do titular.
 * Lança erro com mensagem amigável (senha errada, sem chave privada...).
 */
export function inspectP12(bytes: Uint8Array, password: string): SigningCertInfo {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(bytesToBinary(bytes)), false, password);
  } catch {
    throw new Error('Senha incorreta ou arquivo que não é um certificado A1 (.pfx/.p12).');
  }
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])
  ];
  if (!keyBags.length || !keyBags[0].key) throw new Error('O arquivo não contém a chave privada do certificado.');
  const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map(b => b.cert).filter(Boolean) as forge.pki.Certificate[];
  if (!certs.length) throw new Error('O arquivo não contém o certificado.');
  // certificado do titular: o que corresponde à chave privada (ou o que não é AC)
  const key = keyBags[0].key as forge.pki.rsa.PrivateKey;
  const own = certs.find(c => {
    const pub = c.publicKey as forge.pki.rsa.PublicKey;
    return pub && pub.n && key.n && pub.n.equals(key.n);
  }) || certs[0];
  const cn = String(own.subject.getField('CN')?.value || '');
  const [namePart, docPart] = cn.split(':');
  const issuer = String(own.issuer.getField('CN')?.value || own.issuer.getField('O')?.value || '');
  return {
    holderName: (namePart || cn).trim(),
    holderDoc: (docPart || '').replace(/\D/g, ''),
    issuer,
    serial: own.serialNumber,
    validFrom: own.validity.notBefore.toISOString(),
    validTo: own.validity.notAfter.toISOString()
  };
}

export function isCertExpired(info: Pick<SigningCertInfo, 'validTo'>, now = new Date()): boolean {
  return new Date(info.validTo).getTime() < now.getTime();
}

/** Assina o PDF com cada certificado, na ordem (uma atualização incremental por assinatura). */
export async function signPdf(pdf: Uint8Array, signers: PdfSigner[]): Promise<Uint8Array> {
  if (!signers.length) return pdf;
  const { Buffer } = await import('buffer');
  (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
  const [{ plainAddPlaceholder }, { P12Signer }, signpdfModule] = await Promise.all([
    import('@signpdf/placeholder-plain'),
    import('@signpdf/signer-p12'),
    import('@signpdf/signpdf')
  ]);
  const signpdf: any = (signpdfModule as any).default || signpdfModule;
  // Buffer do pacote "buffer" (navegador)
  let buf: any = Buffer.from(pdf);
  for (const s of signers) {
    buf = plainAddPlaceholder({
      pdfBuffer: buf,
      reason: s.reason,
      contactInfo: '',
      name: s.name,
      location: 'Brasil',
      signatureLength: 20000
    });
    const signer = new P12Signer(Buffer.from(s.p12), { passphrase: s.password });
    buf = Buffer.from(await signpdf.sign(buf, signer));
  }
  return new Uint8Array(buf);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes));
}
