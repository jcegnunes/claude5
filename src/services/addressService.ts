export interface CepResult {
  cep: string;
  logradouro: string;
  complemento?: string;
  bairro?: string;
  localidade: string; // Cidade
  uf: string; // Estado
  ibge?: string;
  formattedAddress?: string;
}

export async function lookupCep(rawCep: string): Promise<CepResult | null> {
  const clean = rawCep.replace(/\D/g, '');
  if (clean.length !== 8) {
    return null;
  }

  // 1. Try local server backend proxy first
  try {
    const res = await fetch(`/api/cep/${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.localidade && data.uf) {
        return {
          cep: data.cep || `${clean.substring(0, 5)}-${clean.substring(5)}`,
          logradouro: data.logradouro || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          localidade: data.localidade || data.cidade || '',
          uf: (data.uf || data.estado || '').toUpperCase(),
          formattedAddress: [data.logradouro, data.bairro].filter(Boolean).join(' - ')
        };
      }
    }
  } catch (e) {
    // Continue to public APIs
  }

  // 2. Try ViaCEP public API
  try {
    const resViaCep = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (resViaCep.ok) {
      const data = await resViaCep.json();
      if (!data.erro && data.localidade) {
        return {
          cep: data.cep || `${clean.substring(0, 5)}-${clean.substring(5)}`,
          logradouro: data.logradouro || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          localidade: data.localidade || '',
          uf: (data.uf || '').toUpperCase(),
          ibge: data.ibge,
          formattedAddress: [data.logradouro, data.bairro].filter(Boolean).join(' - ')
        };
      }
    }
  } catch (e) {
    // Continue to fallback
  }

  // 3. Try BrasilAPI fallback
  try {
    const resBrasilApi = await fetch(`https://brasilapi.com.br/api/cep/v1/${clean}`);
    if (resBrasilApi.ok) {
      const data = await resBrasilApi.json();
      if (data && data.city) {
        return {
          cep: data.cep || `${clean.substring(0, 5)}-${clean.substring(5)}`,
          logradouro: data.street || '',
          complemento: '',
          bairro: data.neighborhood || '',
          localidade: data.city || '',
          uf: (data.state || '').toUpperCase(),
          formattedAddress: [data.street, data.neighborhood].filter(Boolean).join(' - ')
        };
      }
    }
  } catch (e) {
    // Fallback failed
  }

  return null;
}
