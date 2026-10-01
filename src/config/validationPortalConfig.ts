/**
 * Endereços públicos da plataforma.
 * - Sistema (login, ensaios, laudos): https://jvmlab.com.br
 * - Validador (página que consulta o certificado): https://validador.jvmlab.com.br
 * - Endereço impresso no QR Code: página "validar" do site da JVM no Wix, que
 *   exibe o validador dentro do site (https://www.jvmengenharia.com.br/validar).
 * Não são banco de dados: o validador consulta o Supabase.
 */
export const APP_BASE_URL = 'https://jvmlab.com.br';
export const EMBEDDED_PORTAL_URL = 'https://validador.jvmlab.com.br';

/** Marcador do código no endereço do QR Code. */
export const CODE_PLACEHOLDER = '{codigo}';

/**
 * Endereço do QR Code. Aceita dois formatos:
 * - modelo com {codigo}: https://www.jvmengenharia.com.br/validar?codigo={codigo}
 * - endereço base: https://validador.jvmlab.com.br  (vira .../validar/CODIGO)
 */
export const DEFAULT_VALIDATION_BASE_URL = 'https://www.jvmengenharia.com.br/validar?codigo={codigo}';

/**
 * Domínios onde o app funciona SOMENTE como portal de validação: qualquer
 * endereço abre a consulta de certificados (nunca a tela de login do sistema).
 * validador.localhost: mesmo modo para testes no próprio computador.
 */
export const PORTAL_ONLY_HOSTS = ['validador.jvmlab.com.br', 'validador.localhost'];

export function isPortalOnlyHost(hostname: string): boolean {
  return PORTAL_ONLY_HOSTS.includes((hostname || '').toLowerCase());
}

/**
 * Endereços antigos: os salvos nos aparelhos e no cadastro da empresa são
 * trocados automaticamente pelo endereço atual. Documentos já impressos com
 * eles são validados digitando o código no validador.
 */
const LEGACY_DOMAINS = ['mediumturquoise-giraffe-910043', 'mediumvioletred-bison-595566'];
const LEGACY_EXACT = [APP_BASE_URL, 'https://www.jvmlab.com.br'];

export function normalizeValidationBaseUrl(raw?: string | null): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed || LEGACY_EXACT.includes(trimmed.toLowerCase()) || LEGACY_DOMAINS.some(d => trimmed.includes(d))) {
    return DEFAULT_VALIDATION_BASE_URL;
  }
  return trimmed;
}

/** Link de validação de um documento (o que vai no QR Code). */
export function buildValidationUrl(base: string | null | undefined, code: string): string {
  const b = normalizeValidationBaseUrl(base);
  const enc = encodeURIComponent(code || '');
  return b.includes(CODE_PLACEHOLDER) ? b.split(CODE_PLACEHOLDER).join(enc) : `${b}/validar/${enc}`;
}

/** Código de validação contido num link lido do QR Code (ou null). */
export function extractValidationCode(text: string): string | null {
  const clean = (text || '').trim();
  if (!clean) return null;
  const path = clean.match(/\/validar\/([^/?#\s]+)/i);
  if (path) return decodeURIComponent(path[1]);
  const query = clean.match(/[?&]codigo=([^&#\s]+)/i);
  if (query) return decodeURIComponent(query[1]);
  return null;
}
