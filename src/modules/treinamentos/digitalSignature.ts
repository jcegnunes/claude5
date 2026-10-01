/**
 * Assinatura digital ICP-Brasil (certificado A1 .pfx/.p12) dos PDFs de
 * certificado de treinamento. Cada assinatura é acrescentada como atualização
 * incremental do PDF, então a primeira (RT) continua válida depois da segunda
 * (instrutor). Bibliotecas carregadas só quando usadas.
 */
import forge from 'node-forge';

export interface SigningCertInfo {
  holderName: string;
  /** Nome comum completo do certificado (ex.: "JVM ENGENHARIA LTDA:29894500000104") */
  commonName: string;
  /** Nome distinto (ND) do titular: "C=BR, S=DF, L=BRASILIA, O=ICP-Brasil, OU=..., CN=..." */
  subjectDn: string;
  /** CPF/CNPJ do titular, quando presente no certificado ICP-Brasil */
  holderDoc: string;
  issuer: string;
  serial: string;
  validFrom: string;
  validTo: string;
  /** Todos os dados do certificado ligados à assinatura */
  details: CertDetails;
}

/**
 * Dados do certificado ligados à assinatura. Dados pessoais do titular que
 * não interessam à assinatura (nascimento, RG, NIS, título) não são lidos.
 */
export interface CertDetails {
  commonName: string;
  subjectDn: string;
  /** e-CPF, e-CNPJ ou outro */
  kind: string;
  /** A1, A3... (pela política ICP-Brasil) */
  level: string;
  icpBrasil: boolean;
  cpf?: string;
  cnpj?: string;
  /** e-CNPJ: responsável pelo certificado */
  responsibleName?: string;
  responsibleCpf?: string;
  email?: string;
  issuerCn: string;
  issuerDn: string;
  /** Cadeia de ACs presente no arquivo (do emissor até a raiz) */
  chain: string[];
  serial: string;
  validFrom: string;
  validTo: string;
  policies: string[];
  keyUsage: string[];
  extKeyUsage: string[];
  signatureAlgorithm: string;
  keyBits: number;
  sha256: string;
}

const DN_SHORT: Record<string, string> = { ST: 'S' };
const dnOf = (name: forge.pki.Certificate['subject']) => name.attributes
  .map(a => `${DN_SHORT[a.shortName || ''] || a.shortName || a.name || a.type}=${a.value}`)
  .join(', ');

const KEY_USAGE: Record<string, string> = {
  digitalSignature: 'Assinatura digital', nonRepudiation: 'Não repúdio', keyEncipherment: 'Cifragem de chave',
  dataEncipherment: 'Cifragem de dados', keyAgreement: 'Acordo de chave', keyCertSign: 'Assinatura de certificado', cRLSign: 'Assinatura de LCR'
};
const EXT_KEY_USAGE: Record<string, string> = {
  clientAuth: 'Autenticação de cliente', emailProtection: 'Proteção de e-mail', codeSigning: 'Assinatura de código',
  serverAuth: 'Autenticação de servidor', timeStamping: 'Carimbo do tempo'
};
const ICP_LEVEL: Record<string, string> = { '1': 'A1', '2': 'A2', '3': 'A3', '4': 'A4' };
const formatCpf = (d: string) => (d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d);
const formatCnpj = (d: string) => (d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d);
const digitsOnly = (v: string) => v.replace(/\D/g, '');

/** Lê os campos do certificado (incluindo os campos ICP-Brasil do SubjectAltName). */
export function certificateDetails(own: forge.pki.Certificate, chainCerts: forge.pki.Certificate[] = []): CertDetails {
  const A = forge.asn1;
  const cn = String(own.subject.getField('CN')?.value || '');
  const details: CertDetails = {
    commonName: cn,
    subjectDn: dnOf(own.subject),
    kind: 'Certificado digital',
    level: '',
    icpBrasil: /ICP-Brasil/i.test(dnOf(own.subject) + dnOf(own.issuer)),
    issuerCn: String(own.issuer.getField('CN')?.value || ''),
    issuerDn: dnOf(own.issuer),
    chain: [],
    serial: own.serialNumber,
    validFrom: own.validity.notBefore.toISOString(),
    validTo: own.validity.notAfter.toISOString(),
    policies: [],
    keyUsage: [],
    extKeyUsage: [],
    signatureAlgorithm: (forge.pki.oids as Record<string, string>)[own.signatureOid || ''] || own.signatureOid || '',
    keyBits: (own.publicKey as forge.pki.rsa.PublicKey)?.n?.bitLength?.() || 0,
    sha256: ''
  };
  try {
    const md = forge.md.sha256.create();
    md.update(A.toDer(forge.pki.certificateToAsn1(own)).getBytes());
    details.sha256 = md.digest().toHex().toUpperCase().match(/.{2}/g)!.join(':');
  } catch { /* sem impressão digital */ }

  for (const ext of (own.extensions || []) as any[]) {
    try {
      if (ext.id === '2.5.29.17' && typeof ext.value === 'string') {
        // SubjectAltName: campos ICP-Brasil (otherName) e e-mail
        for (const gn of A.fromDer(ext.value).value as forge.asn1.Asn1[]) {
          if (gn.tagClass !== A.Class.CONTEXT_SPECIFIC) continue;
          if (gn.type === 1 && typeof gn.value === 'string') details.email = gn.value;
          if (gn.type !== 0 || !Array.isArray(gn.value)) continue;
          const oid = A.derToOid((gn.value[0] as forge.asn1.Asn1).value as string);
          const wrapped = (gn.value[1] as forge.asn1.Asn1)?.value as forge.asn1.Asn1[];
          const raw = String((wrapped && wrapped[0] && wrapped[0].value) || '');
          if (oid === '2.16.76.1.3.1') details.cpf = digitsOnly(raw.slice(8, 19));            // e-CPF: titular
          if (oid === '2.16.76.1.3.4') details.responsibleCpf = digitsOnly(raw.slice(8, 19)); // e-CNPJ: responsável
          if (oid === '2.16.76.1.3.2') details.responsibleName = raw.trim();
          if (oid === '2.16.76.1.3.3') details.cnpj = digitsOnly(raw);
        }
      } else if (ext.id === '2.5.29.32' && typeof ext.value === 'string') {
        for (const pi of A.fromDer(ext.value).value as forge.asn1.Asn1[]) {
          const oid = A.derToOid(((pi.value as forge.asn1.Asn1[])[0]).value as string);
          details.policies.push(oid);
          const m = oid.match(/^2\.16\.76\.1\.2\.(\d)\./);
          if (m) { details.level = ICP_LEVEL[m[1]] || details.level; details.icpBrasil = true; }
        }
      } else if (ext.name === 'keyUsage') {
        details.keyUsage = Object.keys(KEY_USAGE).filter(k => ext[k]).map(k => KEY_USAGE[k]);
      } else if (ext.name === 'extKeyUsage') {
        details.extKeyUsage = Object.keys(EXT_KEY_USAGE).filter(k => ext[k]).map(k => EXT_KEY_USAGE[k]);
      }
    } catch { /* extensão em formato inesperado: ignorada */ }
  }

  // CPF/CNPJ também vêm no CN ("NOME:documento")
  const docInCn = digitsOnly(cn.split(':')[1] || '');
  if (!details.cnpj && docInCn.length === 14) details.cnpj = docInCn;
  if (!details.cpf && !details.cnpj && docInCn.length === 11) details.cpf = docInCn;
  details.kind = details.cnpj ? 'e-CNPJ' : details.cpf ? 'e-CPF' : 'Certificado digital';
  if (details.cpf) details.cpf = formatCpf(details.cpf);
  if (details.cnpj) details.cnpj = formatCnpj(details.cnpj);
  if (details.responsibleCpf) details.responsibleCpf = formatCpf(details.responsibleCpf);

  // cadeia: do emissor do titular até a raiz, com os certificados de AC do arquivo
  let current = own;
  for (let i = 0; i < 6; i++) {
    const parent = chainCerts.find(c => c !== current && dnOf(c.subject) === dnOf(current.issuer));
    if (!parent) break;
    details.chain.push(String(parent.subject.getField('CN')?.value || dnOf(parent.subject)));
    if (dnOf(parent.subject) === dnOf(parent.issuer)) break;
    current = parent;
  }
  if (!details.chain.length && details.issuerCn) details.chain.push(details.issuerCn);
  return details;
}

export interface PdfSigner {
  /** Conteúdo do arquivo .pfx/.p12 */
  p12: Uint8Array;
  password: string;
  name: string;
  reason: string;
  location?: string;
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
  const subjectDn = dnOf(own.subject);
  const details = certificateDetails(own, certs);
  return {
    holderName: (namePart || cn).trim(),
    commonName: cn,
    subjectDn,
    holderDoc: (docPart || '').replace(/\D/g, '') || digitsOnly(details.cnpj || details.cpf || ''),
    issuer,
    serial: own.serialNumber,
    validFrom: own.validity.notBefore.toISOString(),
    validTo: own.validity.notAfter.toISOString(),
    details
  };
}

export function isCertExpired(info: Pick<SigningCertInfo, 'validTo'>, now = new Date()): boolean {
  return new Date(info.validTo).getTime() < now.getTime();
}

/** Assina o PDF com cada certificado, na ordem (uma atualização incremental por assinatura). */
/**
 * Assina o PDF no padrão ICP-Brasil: PAdES (ETSI.CAdES.detached) com a
 * Política de Assinatura AD-RB (ver pades.ts). Uma atualização incremental por
 * assinatura, então as anteriores continuam válidas.
 */
export async function signPdf(pdf: Uint8Array, signers: PdfSigner[]): Promise<Uint8Array> {
  if (!signers.length) return pdf;
  const { Buffer } = await import('buffer');
  (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
  const [{ plainAddPlaceholder }, utils, signpdfModule, pades] = await Promise.all([
    import('@signpdf/placeholder-plain'),
    import('@signpdf/utils'),
    import('@signpdf/signpdf'),
    import('./pades')
  ]);
  const signpdf: any = (signpdfModule as any).default || signpdfModule;

  /** Assinante CAdES ICP-Brasil para a biblioteca de PDF. */
  class IcpBrasilSigner extends (utils as any).Signer {
    constructor(private loaded: ReturnType<typeof pades.loadP12>) { super(); }
    async sign(content: Uint8Array) {
      return Buffer.from(pades.createIcpBrasilCms(new Uint8Array(content), this.loaded));
    }
  }

  // Buffer do pacote "buffer" (navegador)
  let buf: any = Buffer.from(pdf);
  for (const s of signers) {
    let loaded: ReturnType<typeof pades.loadP12>;
    try {
      loaded = pades.loadP12(s.p12, s.password);
    } catch {
      throw new Error('Senha incorreta ou arquivo que não é um certificado A1 (.pfx/.p12).');
    }
    buf = plainAddPlaceholder({
      pdfBuffer: buf,
      reason: s.reason,
      contactInfo: '',
      name: s.name,
      location: s.location || 'Brasil',
      signatureLength: 24000,
      subFilter: (utils as any).SUBFILTER_ETSI_CADES_DETACHED
    });
    buf = Buffer.from(await signpdf.sign(buf, new IcpBrasilSigner(loaded)));
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
