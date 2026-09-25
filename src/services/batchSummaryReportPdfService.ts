import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TestRecord, Client, CompanyLabInfo } from '../types';
import { DielectricStorageService } from './syncEngine';
import { formatDateBR, getTodayBR } from '../utils/dateUtils';
import { sanitizeForFilename, getEffectiveCollaborator } from './pdfGenerator';
import { getEquipmentTypeDescription, getApplicableNormsList } from './spreadsheetService';
import { saveDocLocally } from '../utils/nativeFileSaver';
import { cleanSignatureImage } from '../utils/signatureCleaner';

async function loadImageAsDataUrl(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 600;
        canvas.height = img.naturalHeight || 450;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } else {
          resolve(url);
        }
      } catch {
        resolve(url);
      }
    };
    img.onerror = () => {
      resolve('');
    };
    img.src = url;
  });
}

export function generateSummaryReportPdfFileName(tests: TestRecord[]): string {
  const primaryClientId = tests[0]?.clientId;
  const clients = DielectricStorageService.getClients();
  const matchedClient = clients.find(c => c.id === primaryClientId || c.razaoSocial === tests[0]?.clientName);
  const clientName = matchedClient?.razaoSocial || tests[0]?.clientName || 'Cliente';
  const safeClient = sanitizeForFilename(clientName);
  const dateFormatted = new Date().toISOString().slice(0, 10);
  return `Relatorio_Consolidado_Ensaios_${safeClient}_${dateFormatted}.pdf`;
}

export interface SummaryReportCustomOptions {
  reportCode?: string;
  reportTitle?: string;
  artNumber?: string;
  emissionDate?: string;
  techResponsibleName?: string;
  techResponsibleCrea?: string;
  techResponsibleRnp?: string;
}

/**
 * Gera e baixa o relatório em PDF com a tabulação dos ensaios organizados por colaborador,
 * cabeçalho completo do cliente e relação de normas técnicas utilizadas.
 */
export async function exportTestsSummaryReportPDF(
  selectedTests: TestRecord[],
  companyInfo?: CompanyLabInfo,
  clientsList?: Client[],
  customOptions?: SummaryReportCustomOptions
): Promise<void> {
  if (!selectedTests || selectedTests.length === 0) {
    throw new Error('Nenhum ensaio selecionado para emissão do relatório consolidado.');
  }

  const company = companyInfo || DielectricStorageService.getCompanyInfo();
  const clients = clientsList || DielectricStorageService.getClients();
  const workOrders = DielectricStorageService.getWorkOrders();
  const equipments = DielectricStorageService.getEquipment();

  // 1. Identificar dados do cliente
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

  // Ordens de serviço e ARTs vinculadas
  const osNumbers = Array.from(new Set(selectedTests.map(t => t.serviceOrderNumber).filter(Boolean))).join(', ') || 'N/A';
  const rawArt = Array.from(new Set(selectedTests.map(t => t.artNumber).filter(Boolean))).join(', ');
  const artNumbers = customOptions?.artNumber || rawArt || 'N/A';

  // Estatísticas do Lote
  const totalItems = selectedTests.length;
  const approvedItems = selectedTests.filter(t => t.result === 'APROVADO').length;
  const reprovedItems = totalItems - approvedItems;
  const approvalRate = totalItems > 0 ? ((approvedItems / totalItems) * 100).toFixed(1) : '0.0';

  // Normas aplicadas
  const normsList = getApplicableNormsList(selectedTests);

  // Inicializar documento PDF em Paisagem (A4 Landscape - 297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 10;
  const usableWidth = pageWidth - (margin * 2);

  // Carregar Logo se houver
  const logoDataUrl = company.logoUrl ? await loadImageAsDataUrl(company.logoUrl) : null;

  // Carregar Assinatura do RT se houver
  const allUsers = DielectricStorageService.getUsers();
  const rtUser = allUsers.find(u => u.name === customOptions?.techResponsibleName || u.name === company.technicalResponsible?.name || u.role === 'responsavel_tecnico');
  const rawRTSig = rtUser?.signatureUrl || company.technicalResponsible?.signatureUrl || '';
  const cleanedRTSig = rawRTSig ? await cleanSignatureImage(rawRTSig) : '';
  const rtSigUrl = cleanedRTSig ? await loadImageAsDataUrl(cleanedRTSig) : null;

  // =========================================================================
  // CABEÇALHO DO LABORATÓRIO E TÍTULO DO RELATÓRIO
  // =========================================================================
  let currentY = 10;
  const headerHeight = 26;

  // Barra de topo decorativa
  doc.setFillColor(10, 37, 64); // #0A2540
  doc.roundedRect(margin, currentY, usableWidth, headerHeight, 1.5, 1.5, 'F');

  // Logo ou Caixa de Nome do Laboratório (Área Esquerda: 30x20mm)
  doc.setFillColor(15, 30, 50);
  doc.roundedRect(margin + 2, currentY + 3, 30, 20, 1.5, 1.5, 'F');
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.2);
  doc.roundedRect(margin + 2, currentY + 3, 30, 20, 1.5, 1.5, 'D');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin + 3, currentY + 4, 28, 18);
    } catch {
      // Fallback em caso de falha de imagem
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text('JVM', margin + 17, currentY + 11, { align: 'center' });
      doc.setFontSize(5);
      doc.setTextColor(56, 189, 248);
      doc.text('ENGENHARIA', margin + 17, currentY + 15.5, { align: 'center' });
      doc.text('LAB. DIELÉTRICO', margin + 17, currentY + 19, { align: 'center' });
    }
  } else {
    // Emblema vetorial refinado e elegante
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('JVM', margin + 17, currentY + 11, { align: 'center' });
    doc.setFontSize(5);
    doc.setTextColor(56, 189, 248); // sky-400
    doc.text('ENGENHARIA', margin + 17, currentY + 15.5, { align: 'center' });
    doc.text('LAB. DIELÉTRICO', margin + 17, currentY + 19, { align: 'center' });
  }

  // Bloco Central de Títulos e Identificação (Área: margin + 35 até margin + 225)
  const textStartX = margin + 35;
  
  // Linha 1: Título Principal do Relatório
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  const mainTitle = customOptions?.reportTitle || 'RELATÓRIO TÉCNICO SIMPLIFICADO & TABULAÇÃO DE ENSAIOS DIELÉTRICOS';
  doc.text(mainTitle, textStartX, currentY + 7.5);

  // Linha 2: Razão Social e Credenciais Oficiais
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(226, 232, 240); // slate-200
  const labSub = `${company.legalName || company.name || 'JVM Engenharia'} | CNPJ: ${company.cnpj || ''} | Registro CREA: ${company.creaCompanyRegister || 'N/A'}`;
  doc.text(labSub, textStartX, currentY + 13);

  // Linha 3: Endereço e Contatos
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(203, 213, 225); // slate-300
  const labAddress = `Endereço: ${company.address || ''}, ${company.number || 'S/N'} - ${company.city || ''}/${company.state || ''} | Tel: ${company.phone || ''} | E-mail: ${company.email || ''}`;
  doc.text(labAddress, textStartX, currentY + 18);

  // Linha 4: Normas e Enquadramento Técnico
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(186, 230, 253); // sky-200
  doc.text('Conformidade NR-10 (item 10.7.8) • ABNT NBR 16295 • ASTM F496/F479/F478 • Rastreabilidade RBC', textStartX, currentY + 22.5);

  // Badge de Data / Emissão à direita (Área: 44x20mm)
  const badgeWidth = 44;
  const badgeX = pageWidth - margin - badgeWidth - 2;
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(badgeX, currentY + 3, badgeWidth, 20, 1.5, 1.5, 'F');
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.2);
  doc.roundedRect(badgeX, currentY + 3, badgeWidth, 20, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(56, 189, 248); // sky-400
  doc.text(customOptions?.reportCode || 'EMISSÃO DO LOTE', badgeX + (badgeWidth / 2), currentY + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  const displayDate = customOptions?.emissionDate ? formatDateBR(customOptions.emissionDate) : getTodayBR();
  doc.text(displayDate, badgeX + (badgeWidth / 2), currentY + 13.5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(203, 213, 225);
  const itemsText = totalItems === 1 ? '1 item ensaiado' : `${totalItems} itens ensaiados`;
  doc.text(itemsText, badgeX + (badgeWidth / 2), currentY + 18.5, { align: 'center' });

  currentY += headerHeight + 3;

  // =========================================================================
  // FUNÇÃO AUXILIAR: TARJA DE TÍTULO DE SEÇÃO COM AJUSTE AUTOMÁTICO DE LARGURA
  // =========================================================================
  const drawSectionBadge = (title: string, yPos: number, minWidth?: number): number => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const textWidth = doc.getTextWidth(title);
    const paddingX = 4;
    const badgeWidth = Math.max(minWidth || 0, textWidth + paddingX * 2);
    const badgeHeight = 6;

    // Tarja de fundo
    doc.setFillColor(15, 23, 42); // slate-900 (#0F172A)
    doc.roundedRect(margin, yPos, badgeWidth, badgeHeight, 1.2, 1.2, 'F');

    // Texto perfeitamente centralizado verticalmente na tarja
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + paddingX, yPos + 4.2);

    return badgeHeight;
  };

  // =========================================================================
  // SEÇÃO 1: DADOS DO CLIENTE / SOLICITANTE
  // =========================================================================
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(margin, currentY, usableWidth, 24, 1.5, 1.5, 'F');
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, usableWidth, 24, 1.5, 1.5, 'D');

  // Cabeçalho da seção com tarja dinâmica
  drawSectionBadge('1. DADOS DO CLIENTE / SOLICITANTE', currentY);

  // Linha 1 do Cliente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Razão Social:', margin + 4, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(clientName.substring(0, 50), margin + 24, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('CNPJ / CPF:', margin + 110, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(clientCnpj, margin + 128, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Inscrição Estadual:', margin + 180, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(clientIE, margin + 207, currentY + 10);

  // Linha 2 do Cliente
  doc.setFont('helvetica', 'bold');
  doc.text('Endereço:', margin + 4, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(clientAddress.substring(0, 75), margin + 20, currentY + 15);

  doc.setFont('helvetica', 'bold');
  doc.text('Contato / Resp.:', margin + 180, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text(clientContact.substring(0, 35), margin + 203, currentY + 15);

  // Linha 3 do Cliente (Rastreabilidade e Resumo)
  doc.setFont('helvetica', 'bold');
  doc.text('Ordem de Serviço (OS):', margin + 4, currentY + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(osNumbers, margin + 38, currentY + 20);

  doc.setFont('helvetica', 'bold');
  doc.text('ART Vinculada:', margin + 95, currentY + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(artNumbers, margin + 118, currentY + 20);

  doc.setFont('helvetica', 'bold');
  doc.text('Resumo do Lote:', margin + 180, currentY + 20);
  doc.setFont('helvetica', 'bold');
  if (reprovedItems === 0) {
    doc.setTextColor(22, 101, 52); // green-800
    doc.text(`${approvedItems} Aprovados (${approvalRate}%) - 100% CONFORME`, margin + 205, currentY + 20);
  } else {
    doc.setTextColor(153, 27, 27); // red-800
    doc.text(`${approvedItems} Aprovados | ${reprovedItems} Reprovados (${approvalRate}% aprov.)`, margin + 205, currentY + 20);
  }

  currentY += 27;

  // =========================================================================
  // SEÇÃO 2: RELAÇÃO DE NORMAS TÉCNICAS E CRITÉRIOS DE CONFORMIDADE
  // =========================================================================
  drawSectionBadge('2. RELAÇÃO DE NORMAS TÉCNICAS E CRITÉRIOS DE CONFORMIDADE APLICADOS', currentY);

  currentY += 7.5;

  const normsTableBody = normsList.map((norm, idx) => [
    `2.${idx + 1}`,
    norm.code,
    norm.name,
    norm.equipmentTypes,
    norm.scope
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Item', 'Código da Norma', 'Denominação Técnica', 'Equipamentos Abrangidos', 'Escopo & Parâmetros do Ensaio']],
    body: normsTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'left',
      cellPadding: 1.5
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [30, 41, 59],
      cellPadding: 1.5,
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 38, fontStyle: 'bold', textColor: [2, 132, 199] },
      2: { cellWidth: 58 },
      3: { cellWidth: 55 },
      4: { cellWidth: 'auto' }
    },
    styles: {
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      overflow: 'linebreak'
    },
    didDrawPage: () => {
      // Rodapé da página
      renderPdfFooter(doc, pageWidth, pageHeight, margin, company);
    }
  });

  // Atualizar Y após tabela de normas
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Se o espaço restante for insuficiente para iniciar a tabela de ensaios, quebra de página
  if (currentY > pageHeight - 45) {
    doc.addPage('a4', 'landscape');
    currentY = 15;
  }

  // =========================================================================
  // SEÇÃO 3: TABULAÇÃO DOS EQUIPAMENTOS ENSAIADOS (POR COLABORADOR)
  // =========================================================================
  drawSectionBadge('3. TABULAÇÃO DOS EQUIPAMENTOS ENSAIADOS (ORGANIZADOS POR COLABORADOR / USUÁRIO)', currentY);

  currentY += 7.5;

  // Preparar os dados agrupados/ordenados por Colaborador
  interface PreparedTableItem {
    collaboratorName: string;
    collaboratorRegistration: string;
    collaboratorSector: string;
    reportNumber: string;
    certificateNumber: string;
    equipmentTag: string;
    equipmentTypeName: string;
    caNumber: string;
    dielectricClass: string;
    dimensionOrLength: string;
    appliedVoltage_kV: number;
    voltageType: string;
    measuredLeakage_mA: number;
    leakageLimit_mA: number;
    testDate: string;
    retestDueDate: string;
    result: string;
  }

  const preparedItems: PreparedTableItem[] = selectedTests.map(test => {
    const matchingOS = workOrders.find(o => o.id === test.serviceOrderId || o.osNumber === test.serviceOrderNumber);
    const matchingEq = equipments.find(e => e.id === test.equipmentId || e.tag === test.equipmentTag);

    const collaboratorName = getEffectiveCollaborator(test) || 'Colaborador Não Especificado / Geral';
    const collaboratorRegistration = test.collaboratorRegistration || matchingOS?.collaboratorRegistration || matchingEq?.collaboratorRegistration || '-';
    const collaboratorSector = test.collaboratorSector || matchingOS?.collaboratorSector || matchingEq?.collaboratorSector || matchingEq?.sector || 'Geral';

    let dimensionOrLength = '-';
    if (test.gloveLength_mm) {
      dimensionOrLength = `${test.gloveLength_mm}mm`;
    } else if (test.blanketDimensions) {
      dimensionOrLength = test.blanketDimensions;
    } else if (test.mattingDimensions) {
      dimensionOrLength = test.mattingDimensions;
    } else if (matchingEq?.sizeOrLength) {
      dimensionOrLength = matchingEq.sizeOrLength;
    }

    return {
      collaboratorName,
      collaboratorRegistration,
      collaboratorSector,
      reportNumber: test.reportNumber || test.testNumber,
      certificateNumber: test.certificateNumber || (test.result === 'APROVADO' ? '-' : 'N/A'),
      equipmentTag: test.equipmentTag || '-',
      equipmentTypeName: getEquipmentTypeDescription(test.equipmentType, matchingEq?.customTypeName),
      caNumber: test.equipmentCa || matchingEq?.caNumber || '-',
      dielectricClass: `Cl. ${test.equipmentClass || '0'}`,
      dimensionOrLength,
      appliedVoltage_kV: test.appliedVoltage_kV || 0,
      voltageType: test.voltageType || 'AC',
      measuredLeakage_mA: Number(test.measuredLeakageCurrent_mA?.toFixed(2)) || 0,
      leakageLimit_mA: Number(test.leakageCurrentLimit_mA?.toFixed(2)) || 0,
      testDate: formatDateBR(test.testDate),
      retestDueDate: formatDateBR(test.retestDueDate),
      result: test.result
    };
  });

  // Ordenação por Colaborador -> Tag -> Laudo
  preparedItems.sort((a, b) => {
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

  // Montar linhas da tabela com a coluna de Colaborador / Usuário
  const testsTableBody: any[] = [];

  preparedItems.forEach(item => {
    const isApproved = item.result === 'APROVADO';
    const collabDisplay = item.collaboratorRegistration && item.collaboratorRegistration !== '-'
      ? `${item.collaboratorName}\n(Matr: ${item.collaboratorRegistration})`
      : item.collaboratorName;

    testsTableBody.push([
      {
        content: collabDisplay,
        styles: { fontStyle: 'bold', textColor: [15, 23, 42] }
      },
      {
        content: item.reportNumber,
        styles: { fontStyle: 'bold', halign: 'center', textColor: [10, 37, 64] }
      },
      item.equipmentTag,
      item.equipmentTypeName,
      item.caNumber,
      item.dielectricClass,
      `${item.appliedVoltage_kV} kV (${item.voltageType})`,
      `${item.measuredLeakage_mA.toFixed(2)} mA`,
      `${item.leakageLimit_mA.toFixed(2)} mA`,
      item.testDate,
      item.retestDueDate,
      {
        content: item.result,
        styles: {
          textColor: isApproved ? [22, 101, 52] : [185, 28, 28],
          fontStyle: 'bold',
          halign: 'center'
        }
      }
    ]);
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [[
      'Colaborador / Usuário',
      'Nº Laudo',
      'Tag / Ident.',
      'Tipo de Equipamento',
      'CA (MTE)',
      'Classe',
      'Tensão Aplicada',
      'Fuga Medida',
      'Limite Máx.',
      'Data Ensaio',
      'Validade',
      'Resultado'
    ]],
    body: testsTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [10, 37, 64], // #0A2540
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      cellPadding: 1.8
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [30, 41, 59],
      cellPadding: 1.5,
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 38 },                                       // Colaborador / Usuário
      1: { cellWidth: 24, fontStyle: 'bold', halign: 'center' },   // Nº Laudo
      2: { cellWidth: 22, fontStyle: 'bold', halign: 'center' },   // Tag
      3: { cellWidth: 46 },                                       // Tipo
      4: { cellWidth: 15, halign: 'center' },                     // CA
      5: { cellWidth: 14, halign: 'center' },                     // Classe
      6: { cellWidth: 24, halign: 'center' },                     // Tensão
      7: { cellWidth: 20, halign: 'right' },                      // Fuga Medida
      8: { cellWidth: 20, halign: 'right' },                      // Limite
      9: { cellWidth: 18, halign: 'center' },                     // Data
      10: { cellWidth: 18, halign: 'center' },                    // Validade
      11: { cellWidth: 18, halign: 'center' }                     // Resultado
    },
    styles: {
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      overflow: 'linebreak'
    },
    didDrawPage: () => {
      renderPdfFooter(doc, pageWidth, pageHeight, margin, company);
    }
  });

  // Resumo final de assinaturas e responsabilidade
  let finalY = (doc as any).lastAutoTable.finalY + 6;
  if (finalY > pageHeight - 34) {
    doc.addPage('a4', 'landscape');
    finalY = 15;
  }

  // Caixa de Totais e Assinatura Técnica
  const summaryBoxHeight = 25;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, finalY, usableWidth, summaryBoxHeight, 1.5, 1.5, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, finalY, usableWidth, summaryBoxHeight, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTALIZAÇÃO DO LOTE DE ENSAIOS DIELÉTRICOS:', margin + 4, finalY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(`Total de Equipamentos: ${totalItems} | Aprovados: ${approvedItems} (${approvalRate}%) | Reprovados: ${reprovedItems}`, margin + 4, finalY + 11.5);
  doc.text(`Os ensaios foram executados em conformidade com a NR-10 (item 10.7.8) e as normas vigentes.`, margin + 4, finalY + 16);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(`Instrumentos calibrados na RBC. Equipamentos aprovados aptos para intervenções elétricas.`, margin + 4, finalY + 20.5);

  // Bloco de Assinatura do Responsável Técnico (perfeitamente contido dentro das margens)
  const signAreaWidth = 100;
  const signCenterX = pageWidth - margin - (signAreaWidth / 2) - 4; // x = 233mm
  const lineHalfWidth = 36;
  const rtSigLineY = finalY + 11.5;

  if (rtSigUrl) {
    try {
      doc.addImage(rtSigUrl, 'PNG', signCenterX - 22, rtSigLineY - 9.2, 44, 9.4);
    } catch {
      // ignore
    }
  }

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.35);
  doc.line(signCenterX - lineHalfWidth, rtSigLineY, signCenterX + lineHalfWidth, rtSigLineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  const techName = customOptions?.techResponsibleName || company.technicalResponsible?.name || 'Responsável Técnico / Engenheiro Eletricista';
  const techTitle = company.technicalResponsible?.title || 'Engenheiro Eletricista e de Segurança do Trabalho';
  const creaNum = customOptions?.techResponsibleCrea || company.technicalResponsible?.creaNumber || company.creaCompanyRegister || 'N/A';
  const rnpNum = customOptions?.techResponsibleRnp || company.technicalResponsible?.rnp;
  
  // Nome do Responsável Técnico
  doc.text(techName, signCenterX, rtSigLineY + 3.8, { align: 'center' });

  // Título e Registro Técnico separados em linhas dedicadas para não transbordar o card
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  doc.text(techTitle, signCenterX, rtSigLineY + 7.2, { align: 'center' });
  doc.text(`CREA: ${creaNum}${rnpNum ? ' | RNP: ' + rnpNum : ''}`, signCenterX, rtSigLineY + 10.5, { align: 'center' });

  // Numerar páginas de forma precisa
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 5, pageHeight - 5, { align: 'right' });
  }

  // Baixar o arquivo PDF e salvar na memória local do celular / tablet
  const fileName = generateSummaryReportPdfFileName(selectedTests);
  await saveDocLocally(doc, fileName, `Relatório Consolidado de Ensaios (${selectedTests.length} itens)`, 'relatorio_os');
}

function renderPdfFooter(doc: jsPDF, pageWidth: number, pageHeight: number, margin: number, company: CompanyLabInfo) {
  const footerY = pageHeight - 6;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184); // slate-400
  const footerText = `${company.name || 'Laboratório de Ensaios'} • Sistema de Gestão Laboratorial Dielétrica Conforme NR-10 • Documento Técnico Oficial`;
  doc.text(footerText, margin, footerY + 1);
}
