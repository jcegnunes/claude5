/**
 * Endereço público (hospedagem do app) usado nos QR Codes de validação.
 * Não é banco de dados: o portal /validar/CODIGO consulta o Supabase.
 */
export const DEFAULT_VALIDATION_BASE_URL = 'https://jvmlab.com.br';

/**
 * Domínios antigos (desativados): endereços salvos nos aparelhos e no cadastro
 * da empresa são trocados automaticamente pelo endereço atual. Documentos já
 * impressos com esses endereços são validados digitando o código em
 * https://jvmlab.com.br/validar.
 */
const LEGACY_DOMAINS = ['mediumturquoise-giraffe-910043', 'mediumvioletred-bison-595566'];

export function normalizeValidationBaseUrl(raw?: string | null): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed || LEGACY_DOMAINS.some(d => trimmed.includes(d))) {
    return DEFAULT_VALIDATION_BASE_URL;
  }
  return trimmed;
}
