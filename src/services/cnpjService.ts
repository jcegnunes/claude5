/**
 * CNPJ Lookup & Validation Service
 * Suporta múltiplos provedores públicos brasileiros (BrasilAPI, MinhaReceita)
 * com fallback inteligente, validação de dígitos verificadores e formatação automática.
 */

export interface CnpjResult {
  cnpj: string;
  cnpjFormatted: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  dataAbertura?: string;
  cnaePrincipal?: string;
  cnaeDescricao?: string;
  
  // Endereço
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  
  // Contato
  email?: string;
  telefone?: string;
  responsavelSocio?: string;
}

/**
 * Valida o algoritmo de dígitos verificadores de um CNPJ brasileiro (módulo 11)
 */
export function isValidCnpj(rawCnpj: string): boolean {
  const clean = rawCnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;

  // Rejeita sequências de dígitos repetidos conhecidos (ex: 00000000000000, 11111111111111)
  if (/^(\d)\1{13}$/.test(clean)) return false;

  // Validação do 1º Dígito Verificador
  let size = 12;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== Number(digits.charAt(0))) return false;

  // Validação do 2º Dígito Verificador
  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== Number(digits.charAt(1))) return false;

  return true;
}

/**
 * Formata um CNPJ no padrão 00.000.000/0000-00
 */
export function formatCnpj(rawCnpj: string): string {
  const clean = rawCnpj.replace(/\D/g, '').substring(0, 14);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return `${clean.substring(0, 2)}.${clean.substring(2)}`;
  if (clean.length <= 8) return `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5)}`;
  if (clean.length <= 12) return `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}/${clean.substring(8)}`;
  return `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}/${clean.substring(8, 12)}-${clean.substring(12, 14)}`;
}

/**
 * Formata um telefone com DDD
 */
function formatPhone(dddTel: string): string {
  const clean = dddTel.replace(/\D/g, '');
  if (!clean) return '';
  if (clean.length === 10) {
    return `(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}`;
  }
  if (clean.length === 11) {
    return `(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}`;
  }
  return dddTel;
}

/**
 * Formata CEP no formato 00000-000
 */
function formatCep(rawCep: string): string {
  const clean = rawCep.replace(/\D/g, '').substring(0, 8);
  if (clean.length === 8) {
    return `${clean.substring(0, 5)}-${clean.substring(5)}`;
  }
  return rawCep;
}

/**
 * Consulta informações completas de uma empresa na base da Receita Federal via APIs públicas
 */
export async function lookupCnpj(rawCnpj: string): Promise<{ success: boolean; data?: CnpjResult; error?: string }> {
  const clean = rawCnpj.replace(/\D/g, '');
  
  if (clean.length !== 14) {
    return {
      success: false,
      error: `CNPJ incompleto. O CNPJ deve conter exatamente 14 dígitos (informado: ${clean.length}).`
    };
  }

  // Verificação de dígitos verificadores
  if (!isValidCnpj(clean)) {
    return {
      success: false,
      error: 'CNPJ inválido (dígitos verificadores incorretos). Verifique se digitou o número corretamente.'
    };
  }

  // 1. Tenta BrasilAPI (Provedor primário mais rápido e completo)
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && (data.razao_social || data.nome_fantasia || data.logradouro)) {
        // Obter primeiro sócio/diretor para contato caso exista
        let socioPrincipal = '';
        if (Array.isArray(data.qsa) && data.qsa.length > 0) {
          const socio = data.qsa.find((s: { nome_socio?: string; qualificacao_socio?: string }) => 
            s.qualificacao_socio?.toLowerCase().includes('administrador') || 
            s.qualificacao_socio?.toLowerCase().includes('diretor') ||
            s.qualificacao_socio?.toLowerCase().includes('presidente')
          ) || data.qsa[0];
          socioPrincipal = socio?.nome_socio || '';
        }

        const logradouroCompleto = [
          data.descricao_tipo_de_logradouro,
          data.logradouro
        ].filter(Boolean).join(' ').trim() || data.logradouro || '';

        return {
          success: true,
          data: {
            cnpj: clean,
            cnpjFormatted: formatCnpj(clean),
            razaoSocial: data.razao_social || data.nome_fantasia || 'Empresa Sem Razão Informada',
            nomeFantasia: data.nome_fantasia || data.razao_social || '',
            situacaoCadastral: data.descricao_situacao_cadastral || (data.situacao_cadastral === 2 ? 'ATIVA' : 'REGULAR'),
            dataAbertura: data.data_inicio_atividade || '',
            cnaePrincipal: data.cnae_fiscal ? String(data.cnae_fiscal) : undefined,
            cnaeDescricao: data.cnae_fiscal_descricao || undefined,
            logradouro: logradouroCompleto,
            numero: data.numero ? String(data.numero).replace(/^0+/, '') || 'S/N' : 'S/N',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            municipio: data.municipio || '',
            uf: (data.uf || '').toUpperCase(),
            cep: formatCep(data.cep || ''),
            email: data.email ? data.email.toLowerCase() : '',
            telefone: data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1) : '',
            responsavelSocio: socioPrincipal
          }
        };
      }
    } else if (res.status === 404) {
      return {
        success: false,
        error: 'CNPJ não encontrado na base oficial da Receita Federal.'
      };
    }
  } catch {
    // Falha de rede ou timeout, tenta próximo provedor
  }

  // 2. Fallback: MinhaReceita API
  try {
    const resMinhaReceita = await fetch(`https://minhareceita.org/${clean}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (resMinhaReceita.ok) {
      const data = await resMinhaReceita.json();
      if (data && (data.razao_social || data.nome_fantasia)) {
        let socioPrincipal = '';
        if (Array.isArray(data.qsa) && data.qsa.length > 0) {
          socioPrincipal = data.qsa[0]?.nome_socio || '';
        }

        const logradouroCompleto = [
          data.descricao_tipo_de_logradouro,
          data.logradouro
        ].filter(Boolean).join(' ').trim() || data.logradouro || '';

        return {
          success: true,
          data: {
            cnpj: clean,
            cnpjFormatted: formatCnpj(clean),
            razaoSocial: data.razao_social || data.nome_fantasia || '',
            nomeFantasia: data.nome_fantasia || data.razao_social || '',
            situacaoCadastral: data.descricao_situacao_cadastral || 'ATIVA',
            dataAbertura: data.data_inicio_atividade || '',
            cnaePrincipal: data.cnae_fiscal ? String(data.cnae_fiscal) : undefined,
            cnaeDescricao: data.cnae_fiscal_descricao || undefined,
            logradouro: logradouroCompleto,
            numero: data.numero ? String(data.numero).replace(/^0+/, '') || 'S/N' : 'S/N',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            municipio: data.municipio || '',
            uf: (data.uf || '').toUpperCase(),
            cep: formatCep(data.cep || ''),
            email: data.email ? data.email.toLowerCase() : '',
            telefone: data.ddd_telefone_1 ? formatPhone(data.ddd_telefone_1) : '',
            responsavelSocio: socioPrincipal
          }
        };
      }
    }
  } catch {
    // Falha no fallback
  }

  // 3. Fallback: OpenCNPJ / ReceitaWS via proxy CORS
  try {
    const resReceitaWS = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://receitaws.com.br/v1/cnpj/${clean}`)}`);
    if (resReceitaWS.ok) {
      const data = await resReceitaWS.json();
      if (data && data.status !== 'ERROR' && data.nome) {
        return {
          success: true,
          data: {
            cnpj: clean,
            cnpjFormatted: formatCnpj(clean),
            razaoSocial: data.nome || '',
            nomeFantasia: data.fantasia || data.nome || '',
            situacaoCadastral: data.situacao || 'ATIVA',
            logradouro: data.logradouro || '',
            numero: data.numero || 'S/N',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            municipio: data.municipio || '',
            uf: (data.uf || '').toUpperCase(),
            cep: formatCep(data.cep || ''),
            email: data.email ? data.email.toLowerCase() : '',
            telefone: data.telefone ? formatPhone(data.telefone) : '',
            responsavelSocio: Array.isArray(data.qsa) && data.qsa[0]?.nome ? data.qsa[0].nome : ''
          }
        };
      }
    }
  } catch {
    // Provedor falhou
  }

  return {
    success: false,
    error: 'Não foi possível consultar os dados do CNPJ no momento. Verifique sua conexão ou preencha os dados manualmente.'
  };
}
