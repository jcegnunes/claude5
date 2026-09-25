import * as XLSX from 'xlsx';
import { TestRecord, Client, CompanyLabInfo } from '../types';
import { DielectricStorageService } from './syncEngine';
import { formatDateBR, getTodayBR } from '../utils/dateUtils';
import { sanitizeForFilename, getEffectiveCollaborator } from './pdfGenerator';
import { saveFileLocally } from '../utils/nativeFileSaver';

/**
 * Tradução amigável dos tipos de equipamento
 */
export function getEquipmentTypeDescription(type: string, customName?: string): string {
  if (customName && customName.trim()) return customName;
  
  const map: Record<string, string> = {
    luva_isolante: 'Luva Isolante de Borracha',
    manga_isolante: 'Manga Isolante de Borracha',
    bota_dielétrica: 'Calçado / Bota Dielétrica',
    capacete_classe_b: 'Capacete de Segurança Classe B',
    manta_isolante: 'Manta / Cobertura Isolante de Borracha',
    tapete_isolante: 'Tapete / Estrado Isolante de Borracha',
    escada_isolada: 'Escada Isolada de Fibra de Vidro',
    bastao_manobra: 'Bastão de Manobra Isolado',
    vara_manobra: 'Vara de Manobra Telescópica',
    ponteira_prova: 'Ponteira / Terminal de Prova',
    detector_tensao: 'Detector de Tensão',
    ferramenta_isolada: 'Conjunto de Ferramentas Isoladas 1000V',
    outro: 'Outro Equipamento Dielétrico'
  };

  return map[type] || type || 'Equipamento Dielétrico';
}

/**
 * Descrição detalhada das normas aplicadas aos ensaios
 */
interface NormInfo {
  code: string;
  name: string;
  equipmentTypes: string;
  scope: string;
}

export function getApplicableNormsList(tests: TestRecord[]): NormInfo[] {
  const normMap = new Map<string, NormInfo>();
  const dbNorms = DielectricStorageService.getNorms();

  // Normas padrões de referência
  const standardCatalog: Record<string, NormInfo> = {
    'NBR 16295': {
      code: 'ABNT NBR 16295 / IEC 60903',
      name: 'Trabalhos em Linha Viva — Luvas de Material Isolante',
      equipmentTypes: 'Luvas Isolantes de Borracha (Classes 00, 0, 1, 2, 3 e 4)',
      scope: 'Tabela 4: Ensaios de prova e rigidez dielétrica em CA/CC, medição de corrente de fuga por comprimento (280mm, 360mm, 410mm, 460mm).'
    },
    'NBR 16295 Tabela 4': {
      code: 'ABNT NBR 16295 Tabela 4 / IEC 60903',
      name: 'Trabalhos em Linha Viva — Luvas de Material Isolante (Tabela 4)',
      equipmentTypes: 'Luvas Isolantes de Borracha (Classes 00, 0, 1, 2, 3 e 4)',
      scope: 'Tabela 4: Ensaios de prova e rigidez dielétrica em CA/CC com limites específicos de corrente de fuga.'
    },
    'ABNT NBR 10622': {
      code: 'ABNT NBR 10622 / IEC 60984',
      name: 'Mangas de Borracha Vulcanizada para Trabalhos em Linha Viva',
      equipmentTypes: 'Mangas Isolantes de Borracha',
      scope: 'Ensaio de tensão aplicada em corrente alternada e verificação de corrente de fuga máxima permitida.'
    },
    'ASTM D1048': {
      code: 'ASTM D1048',
      name: 'Standard Specification for Rubber Insulating Blankets',
      equipmentTypes: 'Mantas Isolantes de Borracha (Type I e Type II, Style A/B/C/D)',
      scope: 'Ensaio de rigidez dielétrica e corrente de fuga com eletrodos metálicos planos.'
    },
    'ASTM D178': {
      code: 'ASTM D178',
      name: 'Standard Specification for Rubber Insulating Matting',
      equipmentTypes: 'Tapetes / Lençóis Isolantes de Borracha',
      scope: 'Ensaio de tensão suportável e rigidez dielétrica conforme espessura e classe.'
    },
    'ABNT IEC 61478': {
      code: 'ABNT NBR IEC 61478 / ABNT NBR 16308 / EN 50528:2024',
      name: 'Trabalhos em Linha Viva / Baixa Tensão — Escadas de Material Isolante',
      equipmentTypes: 'Escadas Isoladas de Fibra de Vidro (Extensíveis, Simples, Tesoura, Plataforma)',
      scope: 'Ensaio dielétrico em montantes (36 kV em BT conforme EN 50528:2024 ou 90/100 kV em AT) e entre degraus.'
    },
    'ABNT NBR 16603': {
      code: 'ABNT NBR 16603 / IEC 60855',
      name: 'Tubos e Bastões de Material Isolante para Trabalhos em Tensão',
      equipmentTypes: 'Bastões de Manobra e Varas Telescópicas',
      scope: 'Ensaio de rigidez dielétrica longitudinal em regime contínuo de alta tensão.'
    },
    'ABNT NBR 16604': {
      code: 'ABNT NBR 16604 / IEC 60900',
      name: 'Ferramentas Manuais para Trabalhos em Tensão até 1 000 V CA e 1 500 V CC',
      equipmentTypes: 'Conjuntos e Ferramentas Manuais Isoladas',
      scope: 'Inspeção visual da isolação polimérica e ensaio de rigidez dielétrica a 10.000 V CA por 3 minutos.'
    },
    'ABNT NBR IEC 61243-1': {
      code: 'ABNT NBR IEC 61243-1 / IEC 61243-1',
      name: 'Trabalhos em Linha Viva — Detectores de Tensão — Parte 1: Tipo Capacitivo (> 1 kV c.a.)',
      equipmentTypes: 'Detectores de Tensão / Prova de Ausência de Tensão',
      scope: 'Ensaio de rigidez dielétrica e isolação da haste isolante (100 kV CA / 300 mm), rigidez da carcaça e ensaio de limiar de sensibilidade (15% a 45% de Un).'
    },
    'ABNT NBR 8221': {
      code: 'ABNT NBR 8221 / ANSI Z89.1',
      name: 'Capacetes de Segurança para Uso na Indústria — Classe B (Classe Dielétrica 2)',
      equipmentTypes: 'Capacetes de Segurança Classe B (Classe 2 - Até 20.000V)',
      scope: 'Ensaio de rigidez dielétrica a 20 kV CA durante 3 minutos após imersão em água por 24h. Limite de fuga ≤ 9,0 mA e sem perfuração até 30 kV.'
    },
    'NR-10': {
      code: 'NR-10 (Portaria MTE nº 3.214/78)',
      name: 'Segurança em Instalações e Serviços em Eletricidade',
      equipmentTypes: 'Todos os EPIs, EPCs e Ferramental Isolado',
      scope: 'Itens 10.4.3.1 e 10.7.8: Obrigatoriedade de ensaios periódicos de isolação elétrica com emissão de laudo técnico formal.'
    }
  };

  // Sempre incluir NR-10 como norma regulamentadora mãe
  normMap.set('NR-10', standardCatalog['NR-10']);

  // Varrer ensaios selecionados para identificar as normas usadas
  tests.forEach(test => {
    const rawCode = (test.normCode || '').trim();
    const isGlove = test.equipmentType === 'luva_isolante' || Boolean(test.gloveLength_mm);

    if (isGlove) {
      normMap.set('NBR 16295', standardCatalog['NBR 16295 Tabela 4'] || standardCatalog['NBR 16295']);
    }

    if (test.equipmentType === 'manga_isolante') {
      normMap.set('ABNT NBR 10622', standardCatalog['ABNT NBR 10622']);
    } else if (test.equipmentType === 'manta_isolante') {
      normMap.set('ASTM D1048', standardCatalog['ASTM D1048']);
    } else if (test.equipmentType === 'tapete_isolante') {
      normMap.set('ASTM D178', standardCatalog['ASTM D178']);
    } else if (test.equipmentType === 'escada_isolada') {
      normMap.set('ABNT IEC 61478', standardCatalog['ABNT IEC 61478']);
    } else if (test.equipmentType === 'bastao_manobra' || test.equipmentType === 'vara_manobra') {
      normMap.set('ABNT NBR 16603', standardCatalog['ABNT NBR 16603']);
    } else if (test.equipmentType === 'ferramenta_isolada') {
      normMap.set('ABNT NBR 16604', standardCatalog['ABNT NBR 16604']);
    } else if (test.equipmentType === 'detector_tensao') {
      normMap.set('ABNT NBR IEC 61243-1', standardCatalog['ABNT NBR IEC 61243-1']);
    } else if (test.equipmentType === 'capacete_classe_b') {
      normMap.set('ABNT NBR 8221', standardCatalog['ABNT NBR 8221']);
    }

    if (rawCode) {
      // Verificar se coincide com o banco de normas customizadas
      const foundDb = dbNorms.find(n => n.normCode === rawCode || n.id === test.normCriterionId);
      if (foundDb && !normMap.has(foundDb.normCode)) {
        normMap.set(foundDb.normCode, {
          code: foundDb.normCode,
          name: foundDb.normName || 'Critério Normativo Laboratorial',
          equipmentTypes: foundDb.applicableEquipmentTypes.map(t => getEquipmentTypeDescription(t)).join(', '),
          scope: foundDb.notes || `Tensão de ensaio: ${foundDb.testVoltage_kV} kV (${foundDb.voltageType}), Duração: ${foundDb.testDurationSeconds}s, Limite: ${foundDb.maxLeakageCurrent} ${foundDb.currentUnit}.`
        });
      } else if (!isGlove && !normMap.has(rawCode)) {
        // Tentar chave do catálogo
        for (const [key, info] of Object.entries(standardCatalog)) {
          if (rawCode.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(rawCode.toLowerCase())) {
            normMap.set(key, info);
            break;
          }
        }
      }
    }
  });

  return Array.from(normMap.values());
}

/**
 * Interface estendida para linha de ensaio na planilha
 */
interface SpreadsheetTestItem {
  collaboratorName: string;
  collaboratorRegistration: string;
  collaboratorSector: string;
  reportNumber: string;
  certificateNumber: string;
  equipmentTag: string;
  equipmentTypeName: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  caNumber: string;
  dielectricClass: string;
  dimensionOrLength: string;
  appliedVoltage_kV: number;
  voltageType: string;
  durationSeconds: number;
  measuredLeakage_mA: number;
  leakageLimit_mA: number;
  testDate: string;
  retestDueDate: string;
  result: string;
  serviceOrderNumber: string;
  artNumber: string;
  technicianName: string;
  technicalNotes: string;
}

/**
 * Gera e exporta a planilha Excel (.xlsx) com:
 * 1. Cabeçalho com dados completos do Cliente
 * 2. Relação das normas técnicas utilizadas
 * 3. Tabela com os equipamentos ensaiados organizados por colaborador
 */
export async function exportTestsSpreadsheet(
  selectedTests: TestRecord[],
  companyInfo?: CompanyLabInfo,
  clientsList?: Client[]
): Promise<void> {
  if (!selectedTests || selectedTests.length === 0) {
    throw new Error('Nenhum ensaio selecionado para exportação da planilha.');
  }

  const company = companyInfo || DielectricStorageService.getCompanyInfo();
  const clients = clientsList || DielectricStorageService.getClients();
  const workOrders = DielectricStorageService.getWorkOrders();
  const equipments = DielectricStorageService.getEquipment();

  // 1. Identificar dados do cliente
  // Se todos os ensaios forem do mesmo cliente, obtemos a ficha cadastral completa
  const primaryClientId = selectedTests[0].clientId;
  const matchedClient = clients.find(c => c.id === primaryClientId || c.razaoSocial === selectedTests[0].clientName);
  
  const clientName = matchedClient?.razaoSocial || selectedTests[0].clientName || 'Cliente Geral';
  const clientFantasy = matchedClient?.nomeFantasia || '';
  const clientCnpj = matchedClient?.cnpj || 'Não informado';
  const clientIE = matchedClient?.inscricaoEstadual || 'Isento / Não informado';
  const clientAddress = matchedClient 
    ? `${matchedClient.endereco}, ${matchedClient.numero}${matchedClient.complemento ? ' - ' + matchedClient.complemento : ''} - ${matchedClient.bairro}, ${matchedClient.cidade}/${matchedClient.estado} - CEP: ${matchedClient.cep}`
    : 'Conforme cadastro do cliente';
  const clientContact = matchedClient?.responsavel 
    ? `${matchedClient.responsavel} (${matchedClient.cargoResponsavel || 'Responsável'})`
    : 'Setor de Segurança do Trabalho / Manutenção';
  const clientPhone = matchedClient?.telefone || matchedClient?.whatsapp || 'Não informado';
  const clientEmail = matchedClient?.email || 'Não informado';

  // Ordens de serviço vinculadas
  const osNumbers = Array.from(new Set(selectedTests.map(t => t.serviceOrderNumber).filter(Boolean))).join(', ') || 'N/A';
  const artNumbers = Array.from(new Set(selectedTests.map(t => t.artNumber).filter(Boolean))).join(', ') || 'N/A';

  // Estatísticas do Lote
  const totalItems = selectedTests.length;
  const approvedItems = selectedTests.filter(t => t.result === 'APROVADO').length;
  const reprovedItems = totalItems - approvedItems;
  const approvalRate = totalItems > 0 ? ((approvedItems / totalItems) * 100).toFixed(1) : '0.0';

  // 2. Preparar Relação de Normas Utilizadas
  const normsList = getApplicableNormsList(selectedTests);

  // 3. Preparar e organizar os ensaios por Colaborador / Usuário
  const preparedItems: SpreadsheetTestItem[] = selectedTests.map(test => {
    const matchingOS = workOrders.find(o => o.id === test.serviceOrderId || o.osNumber === test.serviceOrderNumber);
    const matchingEq = equipments.find(e => e.id === test.equipmentId || e.tag === test.equipmentTag);

    const collaboratorName = getEffectiveCollaborator(test) || 'Colaborador Não Especificado / Uso Geral';
    const collaboratorRegistration = test.collaboratorRegistration || matchingOS?.collaboratorRegistration || matchingEq?.collaboratorRegistration || '-';
    const collaboratorSector = test.collaboratorSector || matchingOS?.collaboratorSector || matchingEq?.collaboratorSector || matchingEq?.sector || 'Geral';

    let dimensionOrLength = '-';
    if (test.gloveLength_mm) {
      dimensionOrLength = `${test.gloveLength_mm} mm`;
    } else if (test.blanketDimensions) {
      dimensionOrLength = test.blanketDimensions;
    } else if (test.mattingDimensions) {
      dimensionOrLength = test.mattingDimensions;
    } else if (matchingEq?.sizeOrLength) {
      dimensionOrLength = matchingEq.sizeOrLength;
    }

    const manufacturer = matchingEq?.manufacturer || '-';
    const model = matchingEq?.model || '-';

    return {
      collaboratorName,
      collaboratorRegistration,
      collaboratorSector,
      reportNumber: test.reportNumber || test.testNumber,
      certificateNumber: test.certificateNumber || (test.result === 'APROVADO' ? '-' : 'N/A (Reprovado)'),
      equipmentTag: test.equipmentTag || '-',
      equipmentTypeName: getEquipmentTypeDescription(test.equipmentType, matchingEq?.customTypeName),
      manufacturer,
      model,
      serialNumber: test.equipmentSerial || '-',
      caNumber: test.equipmentCa || matchingEq?.caNumber || '-',
      dielectricClass: `Classe ${test.equipmentClass || '0'}`,
      dimensionOrLength,
      appliedVoltage_kV: test.appliedVoltage_kV || 0,
      voltageType: test.voltageType || 'AC',
      durationSeconds: test.applicationDurationSeconds || 60,
      measuredLeakage_mA: Number(test.measuredLeakageCurrent_mA?.toFixed(2)) || 0,
      leakageLimit_mA: Number(test.leakageCurrentLimit_mA?.toFixed(2)) || 0,
      testDate: formatDateBR(test.testDate),
      retestDueDate: formatDateBR(test.retestDueDate),
      result: test.result,
      serviceOrderNumber: test.serviceOrderNumber || '-',
      artNumber: test.artNumber || matchingOS?.artNumber || '-',
      technicianName: test.technicianName || '-',
      technicalNotes: test.resultRationale || test.technicalNotes || (test.result === 'APROVADO' ? 'Equipamento APROVADO em ensaio de isolação dielétrica' : 'REPROVADO: Corrente de fuga ou inspeção visual fora dos limites')
    };
  });

  // Ordenação prioritária por Colaborador / Usuário -> Setor -> Tag
  preparedItems.sort((a, b) => {
    // Colaboradores não especificados vão para o final
    const aIsGeneral = a.collaboratorName.includes('Não Especificado');
    const bIsGeneral = b.collaboratorName.includes('Não Especificado');
    if (aIsGeneral && !bIsGeneral) return 1;
    if (!aIsGeneral && bIsGeneral) return -1;

    const collabComp = a.collaboratorName.localeCompare(b.collaboratorName, 'pt-BR');
    if (collabComp !== 0) return collabComp;

    const tagComp = a.equipmentTag.localeCompare(b.equipmentTag, 'pt-BR');
    if (tagComp !== 0) return tagComp;

    return a.reportNumber.localeCompare(b.reportNumber, 'pt-BR');
  });

  // Construção da Matriz de Células (AOA - Array of Arrays)
  const aoa: any[][] = [];

  // ==========================================
  // BLOCO 1: CABEÇALHO DO LABORATÓRIO & TÍTULO
  // ==========================================
  aoa.push([`RELATÓRIO TÉCNICO & TABULAÇÃO DE ENSAIOS DIELÉTRICOS - CONTROLE DE EPIs / EPCs`]);
  aoa.push([`${company.name || 'LABORATÓRIO DE ENSAIOS DIELÉTRICOS'} • ${company.legalName || ''} • CNPJ: ${company.cnpj || ''} • CREA: ${company.creaCompanyRegister || ''}`]);
  aoa.push([`Endereço do Laboratório: ${company.address || ''}, ${company.number || 'S/N'} - ${company.neighborhood || ''} - ${company.city || ''}/${company.state || ''} - CEP: ${company.cep || ''} • Tel: ${company.phone || ''} • E-mail: ${company.email || ''}`]);
  aoa.push([]); // Linha em branco

  // ==========================================
  // BLOCO 2: DADOS DO CLIENTE / SOLICITANTE
  // ==========================================
  aoa.push([`1. DADOS DO CLIENTE / SOLICITANTE`]);
  aoa.push([`Razão Social:`, clientName, ``, `CNPJ / CPF:`, clientCnpj, ``, `Inscrição Estadual:`, clientIE]);
  if (clientFantasy) {
    aoa.push([`Nome Fantasia:`, clientFantasy, ``, `Responsável:`, clientContact, ``, `Telefone / Contato:`, clientPhone]);
  } else {
    aoa.push([`Contato / Responsável:`, clientContact, ``, `Telefone:`, clientPhone, ``, `E-mail:`, clientEmail]);
  }
  aoa.push([`Endereço da Empresa:`, clientAddress, ``, ``, ``, ``, `E-mail:`, clientEmail]);
  aoa.push([`Ordem de Serviço (OS):`, osNumbers, ``, `ART Vinculada:`, artNumbers, ``, `Data de Emissão da Planilha:`, `${getTodayBR()} (Hora: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`]);
  aoa.push([`Resumo do Lote Ensaiado:`, `Total: ${totalItems} equipamentos | Aprovados: ${approvedItems} (${approvalRate}%) | Reprovados: ${reprovedItems}`, ``, `Status Geral:`, reprovedItems === 0 ? '100% CONFORME (LOTE APROVADO)' : 'LOTE COM ITENS REPROVADOS', ``, `Laboratório Executor:`, company.name || 'JVM Engenharia']);
  aoa.push([]); // Linha em branco

  // ==========================================
  // BLOCO 3: RELAÇÃO DE NORMAS TÉCNICAS
  // ==========================================
  aoa.push([`2. RELAÇÃO DE NORMAS TÉCNICAS E CRITÉRIOS DE CONFORMIDADE APLICADOS`]);
  aoa.push([
    `Item`,
    `Código da Norma / Regulamentação`,
    `Título / Denominação Oficial`,
    `Equipamentos Dielétricos Abrangidos`,
    `Escopo Técnico & Parâmetros do Ensaio`
  ]);

  normsList.forEach((norm, idx) => {
    aoa.push([
      `2.${idx + 1}`,
      norm.code,
      norm.name,
      norm.equipmentTypes,
      norm.scope
    ]);
  });
  aoa.push([]); // Linha em branco

  // ==========================================
  // BLOCO 4: TABULAÇÃO DOS ENSAIOS (POR COLABORADOR)
  // ==========================================
  aoa.push([`3. TABULAÇÃO DOS EQUIPAMENTOS ENSAIADOS (ORGANIZADOS POR COLABORADOR / USUÁRIO)`]);
  
  // Cabeçalho das Colunas da Tabela de Ensaios
  const tableHeaders = [
    'Colaborador / Usuário',
    'Matrícula',
    'Setor / Lotação',
    'Nº Laudo Técnico',
    'Nº Certificado',
    'Tag / Identificação',
    'Tipo de Equipamento',
    'Fabricante',
    'Modelo',
    'Nº de Série',
    'CA (MTE)',
    'Classe Dielétrica',
    'Dimensão / Comprimento',
    'Tensão Aplicada (kV)',
    'Tipo Tensão',
    'Duração (s)',
    'Corrente Fuga Medida (mA)',
    'Limite Máx. Normativo (mA)',
    'Data do Ensaio',
    'Validade / Próximo Reensaio',
    'Resultado do Ensaio',
    'Ordem de Serviço (OS)',
    'ART',
    'Inspetor Técnico',
    'Parecer Técnico & Observações'
  ];
  aoa.push(tableHeaders);

  // Linhas de dados organizadas por Colaborador
  let currentCollaborator = '';
  preparedItems.forEach((item) => {
    // Se mudou de colaborador, podemos notar
    if (item.collaboratorName !== currentCollaborator) {
      currentCollaborator = item.collaboratorName;
    }

    aoa.push([
      item.collaboratorName,
      item.collaboratorRegistration,
      item.collaboratorSector,
      item.reportNumber,
      item.certificateNumber,
      item.equipmentTag,
      item.equipmentTypeName,
      item.manufacturer,
      item.model,
      item.serialNumber,
      item.caNumber,
      item.dielectricClass,
      item.dimensionOrLength,
      item.appliedVoltage_kV,
      item.voltageType,
      item.durationSeconds,
      item.measuredLeakage_mA,
      item.leakageLimit_mA,
      item.testDate,
      item.retestDueDate,
      item.result,
      item.serviceOrderNumber,
      item.artNumber,
      item.technicianName,
      item.technicalNotes
    ]);
  });

  // Linha final de rodapé e totais
  aoa.push([]);
  aoa.push([
    'TOTAIS DO RELATÓRIO:',
    `${totalItems} equipamentos ensaiados`,
    `Aprovados: ${approvedItems}`,
    `Reprovados: ${reprovedItems}`,
    `Taxa de Aprovação: ${approvalRate}%`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    `Data da Emissão: ${getTodayBR()}`
  ]);

  // Criar o Workbook e Worksheet no SheetJS
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Configuração de Largura das Colunas para visualização perfeita
  ws['!cols'] = [
    { wch: 28 }, // Colaborador / Usuário
    { wch: 14 }, // Matrícula
    { wch: 18 }, // Setor / Lotação
    { wch: 20 }, // Nº Laudo Técnico
    { wch: 20 }, // Nº Certificado
    { wch: 18 }, // Tag / Identificação
    { wch: 32 }, // Tipo de Equipamento
    { wch: 16 }, // Fabricante
    { wch: 16 }, // Modelo
    { wch: 18 }, // Nº de Série
    { wch: 14 }, // CA (MTE)
    { wch: 16 }, // Classe Dielétrica
    { wch: 22 }, // Dimensão / Comprimento
    { wch: 18 }, // Tensão Aplicada (kV)
    { wch: 12 }, // Tipo Tensão
    { wch: 12 }, // Duração (s)
    { wch: 24 }, // Corrente Fuga Medida (mA)
    { wch: 24 }, // Limite Máx. Normativo (mA)
    { wch: 14 }, // Data do Ensaio
    { wch: 22 }, // Validade / Próximo Reensaio
    { wch: 18 }, // Resultado do Ensaio
    { wch: 18 }, // Ordem de Serviço
    { wch: 22 }, // ART
    { wch: 24 }, // Inspetor Técnico
    { wch: 45 }  // Parecer Técnico & Observações
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tabulação de Ensaios');

  // Gerar Nome Amigável do Arquivo
  const safeClient = sanitizeForFilename(clientName);
  const dateFormatted = new Date().toISOString().slice(0, 10);
  const fileName = `Tabulacao_Ensaios_${safeClient}_${dateFormatted}.xlsx`;

  // Salvar o arquivo no dispositivo móvel / Android Downloads
  const fileBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  await saveFileLocally({
    filename: fileName,
    data: new Uint8Array(fileBytes),
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    title: `Planilha de Ensaios - ${clientName} (${selectedTests.length} itens)`,
    category: 'csv',
    openAfterSave: false
  });
}
