import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, fillTemplate, hexToRgb, normalizeLayout } from '../layout';

const cert = {
  courseName: 'NR-35 – Trabalho em Altura', normReference: 'NR-35', startDate: '2026-10-01', endDate: '2026-10-02',
  modality: 'presencial' as const, location: 'Campinas/SP', workloadHours: 8, participantName: 'Ana Souza',
  participantCpf: '52998224725', participantCompany: 'ACME', expiryDate: '2028-10-02', classNumber: 'TUR-2610-0001'
};

describe('Treinamentos — layout do certificado', () => {
  it('texto padrão gera a mesma frase de antes', () => {
    expect(fillTemplate(DEFAULT_LAYOUT.bodyTemplate, cert)).toBe(
      'concluiu com aproveitamento o treinamento "NR-35 – Trabalho em Altura", em conformidade com NR-35, realizado no período de 01/10/2026 a 02/10/2026, na modalidade presencial, em Campinas/SP, com carga horária total de 8 horas.'
    );
    expect(fillTemplate('{periodo}{local}', { ...cert, endDate: cert.startDate, location: '' })).toBe('em 01/10/2026');
  });

  it('campos do participante, validade e turma; campo desconhecido fica como está', () => {
    expect(fillTemplate('{NOME} {cpf} {empresa} {validade} {turma} {xyz}', cert))
      .toBe('Ana Souza 529.982.247-25 ACME 02/10/2028 TUR-2610-0001 {xyz}');
    expect(fillTemplate('{validade}', { ...cert, expiryDate: undefined })).toBe('sem vencimento');
  });

  it('layout salvo incompleto ou inválido volta ao padrão', () => {
    expect(normalizeLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    const n = normalizeLayout({ title: 'CERTIFICADO DE CAPACITAÇÃO', primaryColor: 'azul', logoWidth: 500, maxInstructors: 7, logoSource: 'x', customLogo: 'javascript:alert(1)', showFrame: false, bodyTemplate: '  ' });
    expect(n.title).toBe('CERTIFICADO DE CAPACITAÇÃO');
    expect(n.primaryColor).toBe(DEFAULT_LAYOUT.primaryColor);
    expect(n.logoWidth).toBe(70);
    expect(n.maxInstructors).toBe(2);
    expect(n.logoSource).toBe('empresa');
    expect(n.customLogo).toBe('');
    expect(n.frameStyle).toBe('nenhuma'); // showFrame=false de layouts antigos
    expect(n.bodyTemplate).toBe(DEFAULT_LAYOUT.bodyTemplate);
  });

  it('cores em RGB', () => {
    expect(hexToRgb('#0a2540')).toEqual([10, 37, 64]);
    expect(hexToRgb('#EA580C')).toEqual([234, 88, 12]);
  });
});

describe('Treinamentos — modelo importado (fundo)', () => {
  it('aceita só imagem JPEG/PNG em base64 e limita os ajustes de posição', () => {
    const n = normalizeLayout({ frontBackground: 'data:image/jpeg;base64,AAAA', backBackground: 'https://x/y.png', contentOffsetY: -99, signatureOffsetY: 99 });
    expect(n.frontBackground).toBe('data:image/jpeg;base64,AAAA');
    expect(n.backBackground).toBe('');
    expect(n.contentOffsetY).toBe(-40);
    expect(n.signatureOffsetY).toBe(15);
  });
});

describe('Treinamentos — dados da empresa no cabeçalho', () => {
  const company = {
    name: 'JVM Engenharia', legalName: 'JVM ENGENHARIA LTDA', cnpj: '12345678000199', creaCompanyRegister: 'CREA-SP 123456',
    address: 'Rua A', number: '10', neighborhood: 'Centro', city: 'Campinas', state: 'SP', cep: '13000-000',
    phone: '(19) 3333-4444', email: 'contato@jvm.com.br', website: 'jvm.com.br', instagram: '@jvm'
  };

  it('padrão mostra o mesmo de antes; layout antigo sem dados vale para frente e verso', async () => {
    const { companyHeaderLines } = await import('../layout');
    expect(companyHeaderLines(company, DEFAULT_LAYOUT.companyFields)).toEqual({
      title: 'JVM ENGENHARIA LTDA', identity: ['CNPJ 12.345.678/0001-99'], contact: ['(19) 3333-4444 · contato@jvm.com.br', 'jvm.com.br']
    });
    const old = normalizeLayout({ showCompanyData: false });
    expect([old.companyDataOnFront, old.companyDataOnBack]).toEqual([false, false]);
  });

  it('só os dados escolhidos, na ordem da tela', async () => {
    const { companyHeaderLines } = await import('../layout');
    expect(companyHeaderLines(company, ['instagram', 'nomeFantasia', 'crea', 'endereco'])).toEqual({
      title: 'JVM Engenharia', identity: ['CREA SP 123456'], contact: ['Rua A, 10 – Centro – Campinas/SP – CEP 13000-000', '@jvm']
    });
    expect(normalizeLayout({ companyFields: ['site', 'xyz', 'cnpj'] }).companyFields).toEqual(['cnpj', 'site']);
  });
});

describe('Treinamentos — segundo logo', () => {
  it('padrão sem segundo logo; só imagem válida; tamanho limitado', () => {
    expect(DEFAULT_LAYOUT.logo2Image).toBe('');
    const n = normalizeLayout({ logo2Image: 'http://x/logo.png', logo2Width: 5, logo2Position: 'x' });
    expect(n.logo2Image).toBe('');
    expect(n.logo2Width).toBe(15);
    expect(n.logo2Position).toBe('direita');
    expect(normalizeLayout({ logo2Image: 'data:image/png;base64,AAAA' }).logo2Image).toBe('data:image/png;base64,AAAA');
  });
});
