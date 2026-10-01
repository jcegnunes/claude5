/**
 * Assinatura e verificação PAdES no padrão ICP-Brasil (DOC-ICP-15.03):
 * CMS SignedData destacado (ETSI.CAdES.detached) com os atributos assinados
 * exigidos pela Política AD-RB: content-type, message-digest,
 * signing-certificate-v2 e identificador da política (sem signing-time:
 * no PAdES a data fica no dicionário /M da assinatura).
 */
import forge from 'node-forge';
import { ICP_PADES_POLICIES, ICP_POLICY, ICP_TRUST_ANCHORS_B64 } from './icpBrasil';

const A = forge.asn1;
const C = A.Class;
const T = A.Type;

const OID = {
  data: '1.2.840.113549.1.7.1',
  signedData: '1.2.840.113549.1.7.2',
  contentType: '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  signingCertificateV2: '1.2.840.113549.1.9.16.2.47',
  sigPolicyId: '1.2.840.113549.1.9.16.2.15',
  spqUri: '1.2.840.113549.1.9.16.5.1',
  sha256: '2.16.840.1.101.3.4.2.1',
  sha256WithRSA: '1.2.840.113549.1.1.11',
  rsaEncryption: '1.2.840.113549.1.1.1'
};

const oid = (o: string) => A.create(C.UNIVERSAL, T.OID, false, A.oidToDer(o).getBytes());
const seq = (v: forge.asn1.Asn1[]) => A.create(C.UNIVERSAL, T.SEQUENCE, true, v);
const set = (v: forge.asn1.Asn1[]) => A.create(C.UNIVERSAL, T.SET, true, v);
const octets = (bytes: string) => A.create(C.UNIVERSAL, T.OCTETSTRING, false, bytes);
const int = (bytes: string) => A.create(C.UNIVERSAL, T.INTEGER, false, bytes);
const algSha256 = () => seq([oid(OID.sha256)]);
const der = (n: forge.asn1.Asn1) => A.toDer(n).getBytes();
const sha256 = (bytes: string) => { const md = forge.md.sha256.create(); md.update(bytes); return md.digest().getBytes(); };
const hexToBytes = (h: string) => forge.util.hexToBytes(h);
const toBinary = (u8: Uint8Array) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return s; };
const fromBinary = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0));

/** DER exige os elementos do SET OF em ordem crescente de codificação. */
function sortedSet(items: forge.asn1.Asn1[]) {
  return set([...items].sort((a, b) => (der(a) < der(b) ? -1 : der(a) > der(b) ? 1 : 0)));
}

function attribute(type: string, value: forge.asn1.Asn1) {
  return seq([oid(type), set([value])]);
}

/** tbsCertificate -> [serialNumber, issuer] como nós ASN.1 */
function issuerAndSerial(cert: forge.pki.Certificate) {
  const tbs = (forge.pki.certificateToAsn1(cert).value as forge.asn1.Asn1[])[0];
  const fields = tbs.value as forge.asn1.Asn1[];
  const hasVersion = fields[0].tagClass === C.CONTEXT_SPECIFIC;
  return { serial: fields[hasVersion ? 1 : 0], issuer: fields[hasVersion ? 3 : 2] };
}

export interface LoadedP12 {
  key: forge.pki.rsa.PrivateKey;
  cert: forge.pki.Certificate;
  chain: forge.pki.Certificate[];
}

export function loadP12(p12: Uint8Array, password: string): LoadedP12 {
  const pfx = forge.pkcs12.pkcs12FromAsn1(A.fromDer(toBinary(p12)), false, password);
  const keyBag = [
    ...(pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(pfx.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [])
  ][0];
  if (!keyBag?.key) throw new Error('O certificado não contém a chave privada.');
  const key = keyBag.key as forge.pki.rsa.PrivateKey;
  const certs = (pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).map(b => b.cert).filter(Boolean) as forge.pki.Certificate[];
  const cert = certs.find(c => (c.publicKey as forge.pki.rsa.PublicKey)?.n?.equals(key.n)) || certs[0];
  if (!cert) throw new Error('O arquivo não contém o certificado.');
  return { key, cert, chain: certs.filter(c => c !== cert) };
}

/**
 * CMS SignedData (DER) da assinatura PAdES ICP-Brasil AD-RB sobre o conteúdo
 * indicado pelo ByteRange do PDF.
 */
export function createIcpBrasilCms(content: Uint8Array, p12: LoadedP12): Uint8Array {
  const { key, cert, chain } = p12;
  const certDer = der(forge.pki.certificateToAsn1(cert));
  const { serial, issuer } = issuerAndSerial(cert);

  // signing-certificate-v2: ESSCertIDv2 { certHash (SHA-256, algoritmo padrão omitido), issuerSerial }
  const essCertIdV2 = seq([
    octets(sha256(certDer)),
    seq([seq([A.create(C.CONTEXT_SPECIFIC, 4, true, [issuer])]), serial])
  ]);
  const signingCertV2 = seq([seq([essCertIdV2])]);

  // signature-policy-identifier: { OID da política, hash SHA-256 do documento, URI }
  const sigPolicyId = seq([
    oid(ICP_POLICY.oid),
    seq([algSha256(), octets(hexToBytes(ICP_POLICY.hashSha256Hex))]),
    seq([seq([oid(OID.spqUri), A.create(C.UNIVERSAL, T.IA5STRING, false, ICP_POLICY.uri)])])
  ]);

  const attrs = sortedSet([
    attribute(OID.contentType, oid(OID.data)),
    attribute(OID.messageDigest, octets(sha256(toBinary(content)))),
    attribute(OID.signingCertificateV2, signingCertV2),
    attribute(OID.sigPolicyId, sigPolicyId)
  ]);

  // assina o DER dos atributos codificados como SET
  const md = forge.md.sha256.create();
  md.update(der(attrs));
  const signature = key.sign(md);

  const signedAttrs = A.create(C.CONTEXT_SPECIFIC, 0, true, attrs.value as forge.asn1.Asn1[]);
  const signerInfo = seq([
    int(String.fromCharCode(1)),
    seq([issuer, serial]),
    algSha256(),
    signedAttrs,
    seq([oid(OID.sha256WithRSA), A.create(C.UNIVERSAL, T.NULL, false, '')]),
    octets(signature)
  ]);
  const certificates = A.create(C.CONTEXT_SPECIFIC, 0, true,
    [cert, ...chain].map(c => forge.pki.certificateToAsn1(c)));
  const signedData = seq([
    int(String.fromCharCode(1)),
    set([algSha256()]),
    seq([oid(OID.data)]),
    certificates,
    set([signerInfo])
  ]);
  const contentInfo = seq([oid(OID.signedData), A.create(C.CONTEXT_SPECIFIC, 0, true, [signedData])]);
  return fromBinary(der(contentInfo));
}

// ===========================================================================
// Verificação (validador do sistema)
// ===========================================================================
export type CheckStatus = 'ok' | 'aviso' | 'erro';

export interface SignatureCheck {
  index: number;
  signerCn: string;
  signerDn: string;
  issuerCn: string;
  signingTime?: string;
  subFilter: string;
  coversWholeDocument: boolean;
  /** Conteúdo assinado não foi alterado (message-digest confere) */
  integrity: boolean;
  /** Assinatura RSA sobre os atributos confere com a chave do certificado */
  cryptoValid: boolean;
  /** signing-certificate-v2 aponta para o certificado do signatário */
  signingCertOk: boolean | null;
  policyOid?: string;
  policyName?: string;
  policyHashOk?: boolean;
  /** Cadeia confirmada até uma AC Raiz da política */
  chainTrusted: boolean;
  chain: string[];
  certValidAtSigning: boolean;
  status: CheckStatus;
  messages: string[];
}

export interface PdfSignatureReport {
  signatures: SignatureCheck[];
  /** Códigos de validação impressos no PDF (ex.: VAL-TRE-...) */
  validationCodes: string[];
}

function parsePdfDate(s?: string): Date | undefined {
  const m = (s || '').match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})([Z+-])?(\d{2})?'?(\d{2})?/);
  if (!m) return undefined;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const off = m[7] && m[7] !== 'Z' ? (m[7] === '-' ? -1 : 1) * ((+m[8] || 0) * 60 + (+m[9] || 0)) : 0;
  return new Date(utc - off * 60000);
}

let anchorsCache: forge.pki.Certificate[] | null = null;
function trustAnchors(): forge.pki.Certificate[] {
  if (!anchorsCache) {
    anchorsCache = Object.values(ICP_TRUST_ANCHORS_B64).map(b64 => forge.pki.certificateFromAsn1(A.fromDer(forge.util.decode64(b64))));
  }
  return anchorsCache;
}

const dnString = (n: forge.pki.Certificate['subject']) => n.attributes.map(a => `${a.shortName === 'ST' ? 'S' : a.shortName || a.name}=${a.value}`).join(', ');
const sameDn = (a: forge.pki.Certificate['subject'], b: forge.pki.Certificate['subject']) => dnString(a) === dnString(b);

function buildChain(leaf: forge.pki.Certificate, pool: forge.pki.Certificate[], at: Date): { trusted: boolean; names: string[]; problems: string[] } {
  const names: string[] = [];
  const problems: string[] = [];
  const anchors = trustAnchors();
  let current = leaf;
  for (let i = 0; i < 8; i++) {
    const anchor = anchors.find(a => sameDn(a.subject, current.issuer));
    if (anchor) {
      try {
        if (!anchor.verify(current)) { problems.push(`assinatura de ${anchor.subject.getField('CN')?.value} não confere`); return { trusted: false, names, problems }; }
      } catch { problems.push('algoritmo da cadeia não suportado'); return { trusted: false, names, problems }; }
      names.push(String(anchor.subject.getField('CN')?.value));
      return { trusted: true, names, problems };
    }
    const parent = pool.find(c => c !== current && sameDn(c.subject, current.issuer));
    if (!parent) { problems.push(`certificado da AC "${current.issuer.getField('CN')?.value}" não veio no arquivo assinado`); return { trusted: false, names, problems }; }
    try {
      if (!parent.verify(current)) { problems.push(`assinatura de ${parent.subject.getField('CN')?.value} não confere`); return { trusted: false, names, problems }; }
    } catch { problems.push('algoritmo da cadeia não suportado'); return { trusted: false, names, problems }; }
    if (at < parent.validity.notBefore || at > parent.validity.notAfter) problems.push(`AC ${parent.subject.getField('CN')?.value} fora da validade na data da assinatura`);
    names.push(String(parent.subject.getField('CN')?.value));
    if (sameDn(parent.subject, parent.issuer)) { problems.push('a raiz da cadeia não é uma AC Raiz da ICP-Brasil aceita pela política'); return { trusted: false, names, problems }; }
    current = parent;
  }
  problems.push('cadeia longa demais');
  return { trusted: false, names, problems };
}

/** Confere todas as assinaturas digitais do PDF. */
export function verifyPdfSignatures(pdf: Uint8Array): PdfSignatureReport {
  const text = toBinary(pdf);
  const validationCodes = Array.from(new Set(text.match(/VAL-(?:TRE|JVM)-\d{4}-[A-Z0-9]{6,12}/g) || []));
  const signatures: SignatureCheck[] = [];
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let m: RegExpExecArray | null;
  let index = 0;
  while ((m = re.exec(text))) {
    index++;
    const [a, b, c, d] = m.slice(1).map(Number);
    const messages: string[] = [];
    const check: SignatureCheck = {
      index, signerCn: '', signerDn: '', issuerCn: '', subFilter: '', coversWholeDocument: c + d === pdf.length,
      integrity: false, cryptoValid: false, signingCertOk: null, chainTrusted: false, chain: [], certValidAtSigning: false,
      status: 'erro', messages
    };
    signatures.push(check);
    try {
      // dicionário da assinatura (subfiltro e data /M) fica antes do /Contents
      const dictStart = text.lastIndexOf('<<', a + b);
      const objEnd = text.indexOf('endobj', c);
      const dict = text.slice(Math.max(0, dictStart), objEnd > 0 ? objEnd : c + 4000);
      check.subFilter = (dict.match(/\/SubFilter\s*\/([\w.]+)/g)?.pop() || '').replace(/\/SubFilter\s*\//, '');
      const when = parsePdfDate((dict.match(/\/M\s*\((D:[^)]+)\)/g)?.pop() || '').replace(/^\/M\s*\(/, ''));
      check.signingTime = when?.toISOString();

      const hex = text.slice(a + b + 1, c - 1).replace(/(?:00)+$/, '');
      const cms = A.fromDer(hexToBytes(hex.length % 2 ? hex + '0' : hex));
      const sd = ((cms.value as forge.asn1.Asn1[])[1].value as forge.asn1.Asn1[])[0].value as forge.asn1.Asn1[];
      const certNode = sd.find(n => n.tagClass === C.CONTEXT_SPECIFIC && n.type === 0);
      const certs = ((certNode?.value || []) as forge.asn1.Asn1[]).map(n => { try { return forge.pki.certificateFromAsn1(n); } catch { return null; } }).filter(Boolean) as forge.pki.Certificate[];
      const signerInfo = ((sd[sd.length - 1].value as forge.asn1.Asn1[])[0]).value as forge.asn1.Asn1[];
      const sid = signerInfo[1].value as forge.asn1.Asn1[];
      const sidSerial = forge.util.bytesToHex(sid[1].value as string).replace(/^0+/, '');
      const signer = certs.find(x => x.serialNumber.replace(/^0+/, '') === sidSerial) || certs[0];
      if (!signer) throw new Error('certificado do signatário ausente');
      check.signerCn = String(signer.subject.getField('CN')?.value || '');
      check.signerDn = dnString(signer.subject);
      check.issuerCn = String(signer.issuer.getField('CN')?.value || '');

      const signedAttrsNode = signerInfo.find(n => n.tagClass === C.CONTEXT_SPECIFIC && n.type === 0)!;
      const attrs = signedAttrsNode.value as forge.asn1.Asn1[];
      const attrValue = (type: string) => {
        const at = attrs.find(x => A.derToOid((x.value as forge.asn1.Asn1[])[0].value as string) === type);
        return at ? ((at.value as forge.asn1.Asn1[])[1].value as forge.asn1.Asn1[])[0] : undefined;
      };

      // integridade: hash do conteúdo coberto pelo ByteRange
      const content = text.slice(a, a + b) + text.slice(c, c + d);
      const digestAttr = attrValue(OID.messageDigest);
      check.integrity = !!digestAttr && digestAttr.value === sha256(content);
      if (!check.integrity) messages.push('o documento foi alterado depois de assinado');

      // assinatura RSA sobre os atributos (codificados como SET)
      const signature = signerInfo[signerInfo.length - 1].value as string;
      const attrsDer = der(set(attrs));
      const mdA = forge.md.sha256.create();
      mdA.update(attrsDer);
      try { check.cryptoValid = (signer.publicKey as forge.pki.rsa.PublicKey).verify(mdA.digest().getBytes(), signature); } catch { check.cryptoValid = false; }
      if (!check.cryptoValid) messages.push('a assinatura criptográfica não confere com o certificado');

      // signing-certificate-v2
      const scv2 = attrValue(OID.signingCertificateV2);
      if (scv2) {
        const ess = ((scv2.value as forge.asn1.Asn1[])[0].value as forge.asn1.Asn1[])[0].value as forge.asn1.Asn1[];
        const hashNode = ess.find(n => n.type === T.OCTETSTRING)!;
        check.signingCertOk = hashNode.value === sha256(der(forge.pki.certificateToAsn1(signer)));
        if (!check.signingCertOk) messages.push('signing-certificate-v2 não corresponde ao signatário');
      } else {
        messages.push('sem o atributo signing-certificate-v2 (exigido pela ICP-Brasil)');
      }

      // política de assinatura
      const pol = attrValue(OID.sigPolicyId);
      if (pol && Array.isArray(pol.value)) {
        const parts = pol.value as forge.asn1.Asn1[];
        check.policyOid = A.derToOid(parts[0].value as string);
        const known = ICP_PADES_POLICIES[check.policyOid];
        check.policyName = known?.name;
        const hashValue = ((parts[1].value as forge.asn1.Asn1[])[1]).value as string;
        check.policyHashOk = !!known && forge.util.bytesToHex(hashValue) === known.hash;
        if (!known) messages.push(`política ${check.policyOid} não consta na lista da ICP-Brasil`);
        else if (!check.policyHashOk) messages.push('hash da política não confere com a lista oficial');
      } else {
        messages.push('sem política de assinatura ICP-Brasil (assinatura PAdES básica)');
      }

      // validade do certificado e cadeia até a AC Raiz
      const at = when || new Date();
      check.certValidAtSigning = at >= signer.validity.notBefore && at <= signer.validity.notAfter;
      if (!check.certValidAtSigning) messages.push('certificado fora da validade na data da assinatura');
      const chain = buildChain(signer, certs, at);
      check.chainTrusted = chain.trusted;
      check.chain = chain.names;
      messages.push(...chain.problems);
      if (!check.coversWholeDocument) messages.push('houve alterações (atualizações) no arquivo depois desta assinatura');

      const icpOk = check.signingCertOk === true && check.policyHashOk === true && check.chainTrusted;
      check.status = check.integrity && check.cryptoValid && check.certValidAtSigning
        ? (icpOk ? 'ok' : 'aviso')
        : 'erro';
    } catch (err) {
      messages.push(`não foi possível ler a assinatura (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  return { signatures, validationCodes };
}
