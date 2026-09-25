/**
 * Endereço público (hospedagem do app) usado nos QR Codes de validação.
 * Não é banco de dados: o portal /validar/CODIGO consulta o Supabase.
 */
export const DEFAULT_VALIDATION_BASE_URL = 'https://mediumvioletred-bison-595566.hostingersite.com';

/** Domínios antigos que devem ser migrados automaticamente para o endereço atual. */
const LEGACY_DOMAINS = ['mediumturquoise-giraffe-910043'];

export function normalizeValidationBaseUrl(raw?: string | null): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed || LEGACY_DOMAINS.some(d => trimmed.includes(d))) {
    return DEFAULT_VALIDATION_BASE_URL;
  }
  return trimmed;
}
