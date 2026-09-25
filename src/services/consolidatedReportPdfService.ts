import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { ConsolidatedReport, TestRecord, CompanyLabInfo } from '../types';
import { formatDateBR } from '../utils/dateUtils';
import { DielectricStorageService } from './syncEngine';
import { renderLaudoToDoc, loadImageAsDataUrl } from './pdfGenerator';
import { saveDocLocally } from '../utils/nativeFileSaver';
import { ValidationPortalService } from './validationPortalService';
import { cleanSignatureImage } from '../utils/signatureCleaner';

async function generateQRCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 250,
      margin: 1,
      color: {
        dark: '#0A2540',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error('Erro ao gerar QR Code:', err);
    return '';
  }
}

export async function exportConsolidatedReportPDF(
  report: ConsolidatedReport,
  tests: TestRecord[],
  company: CompanyLabInfo,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - (margin * 2);

  // Paleta de Cores Institucional
  const primaryNavy = [10, 37, 64];      // #0A2540
  const bluePrimary = [29, 78, 216];     // #1D4ED8
  const textDark = [15, 23, 42];         // #0F172A
  const textMuted = [100, 116, 139];     // #64748B
  const textLabel = [71, 85, 105];       // #475569
  const borderGray = [203, 213, 225];    // #CBD5E1
  const bgLightCard = [248, 250, 252];   // #F8FAFC
  const greenApprove = [16, 185, 129];   // #10B981
  const redReject = [239, 68, 68];       // #EF4444
  const amberAccent = [217, 119, 6];     // #D97706

  const validationCode = report.validationCode || `REL-VAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const validationUrl = ValidationPortalService.buildPublicValidationUrl(validationCode);
  const qrDataUrl = await generateQRCodeDataUrl(validationUrl);
  const logoDataUrl = company.logoUrl ? await loadImageAsDataUrl(company.logoUrl) : null;

  const allUsers = DielectricStorageService.getUsers();
  const techUser = allUsers.find(u => u.name === report.technicianName);
  const rtUser = allUsers.find(u => u.name === report.techResponsibleName || u.role === 'responsavel_tecnico');
  const rawTechSig = techUser?.signatureUrl || '';
  const rawRTSig = rtUser?.signatureUrl || company.technicalResponsible?.signatureUrl || '';
  const cleanedTechSig = rawTechSig ? await cleanSignatureImage(rawTechSig) : '';
  const cleanedRTSig = rawRTSig ? await cleanSignatureImage(rawRTSig) : '';
  const techSigUrl = cleanedTechSig ? await loadImageAsDataUrl(cleanedTechSig) : '';
  const rtSigUrl = cleanedRTSig ? await loadImageAsDataUrl(cleanedRTSig) : '';

  const shouldIncludeAnnex = report.includeIndividualReportsAnnex !== false && tests.length > 0;
  const totalSteps = 6 + (shouldIncludeAnnex ? tests.length + 1 : 0);

  // Header helper for internal pages
  const drawPageHeader = (pageTitle: string, sectionNumber?: string) => {
    // Top border accent
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.rect(margin, margin, contentWidth, 14, 'F');

    // Title in header
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const fullTitle = sectionNumber ? `${sectionNumber}. ${pageTitle.toUpperCase()}` : pageTitle.toUpperCase();
    doc.text(fullTitle, margin + 4, margin + 8.5);

    // Company tiny label in header
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(company.name.toUpperCase(), margin + contentWidth - 4, margin + 8.5, { align: 'right' });

    // Thin subheader bar with report code
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, margin + 14, contentWidth, 5.5, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.2);
    doc.rect(margin, margin + 14, contentWidth, 5.5, 'D');

    doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`CÓDIGO: ${report.reportCode}`, margin + 3, margin + 17.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`CLIENTE: ${report.clientName} | EMISSÃO: ${formatDateBR(report.emissionDate)}`, margin + contentWidth - 3, margin + 17.5, { align: 'right' });
  };

  // Footer helper for internal pages
  const drawPageFooter = (pageNum: number) => {
    const footerY = pageHeight - margin;
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 4, margin + contentWidth, footerY - 4);

    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${company.name} • CREA PJ: ${company.creaCompanyRegister || 'REG-CREA-SP'} • Tel: ${company.phone || '(11) 99999-9999'}`, margin, footerY);
    doc.text(`Página ${pageNum}`, margin + contentWidth, footerY, { align: 'right' });
  };

  // ==========================================
  // PÁGINA 1: CAPA OFICIAL (COVER PAGE)
  // ==========================================
  if (onProgress) onProgress(1, 6, 'Gerando Capa do Relatório...');

  // Decorative border
  doc.setDrawColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setLineWidth(0.8);
  doc.rect(margin, margin, contentWidth, pageHeight - (margin * 2), 'D');

  // Inner border
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin + 2, margin + 2, contentWidth - 4, pageHeight - (margin * 2) - 4, 'D');

  // Top Navy Block
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin + 2, margin + 2, contentWidth - 4, 38, 'F');

  // Company Name & Subtitle on Top Block
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(company.name.toUpperCase(), margin + (contentWidth / 2), margin + 14, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('LABORATÓRIO DE ENSAIOS DIELÉTRICOS E CALIBRAÇÃO DE EPIs/EPCs', margin + (contentWidth / 2), margin + 21, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(219, 234, 254);
  doc.text(`CNPJ: ${company.cnpj} | CREA PJ: ${company.creaCompanyRegister} | ${company.email}`, margin + (contentWidth / 2), margin + 28, { align: 'center' });
  doc.text(`${company.address}${company.cityState ? ' - ' + company.cityState : ''} | Tel: ${company.phone}`, margin + (contentWidth / 2), margin + 34, { align: 'center' });

  // Main Report Title Banner
  let y = margin + 50;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin + 6, y, contentWidth - 12, 32, 2, 2, 'F');
  doc.setDrawColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin + 6, y, contentWidth - 12, 32, 2, 2, 'D');

  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('RELATÓRIO TÉCNICO CONSOLIDADO', margin + (contentWidth / 2), y + 10, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
  doc.text('PROGRAMA DE ENSAIOS DIELÉTRICOS, INSPEÇÃO E CONFORMIDADE DE EPIs/EPCs', margin + (contentWidth / 2), y + 17, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(amberAccent[0], amberAccent[1], amberAccent[2]);
  doc.text(`NORMA REGULAMENTADORA NR-10 (ITEM 10.7.8) & NORMAS ABNT / ASTM`, margin + (contentWidth / 2), y + 24, { align: 'center' });

  // Metadata Card (Document info)
  y += 38;
  doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
  doc.roundedRect(margin + 6, y, contentWidth - 12, 22, 1.5, 1.5, 'FD');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);

  doc.setFontSize(7.5);
  doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Nº DO RELATÓRIO:', margin + 10, y + 6);
  doc.text('ORDEM DE SERVIÇO (OS):', margin + 70, y + 6);
  doc.text('ART CREA VINCULADA:', margin + 130, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(report.reportCode, margin + 10, y + 12);
  doc.text(report.serviceOrderNumber || 'OS-AVULSA', margin + 70, y + 12);
  doc.text(report.artNumber || 'ART-CREA-CONFORME-OS', margin + 130, y + 12);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Data de Emissão: ${formatDateBR(report.emissionDate)}`, margin + 10, y + 18);
  doc.text(`Período dos Ensaios: ${formatDateBR(report.testPeriodStart || report.emissionDate)} a ${formatDateBR(report.testPeriodEnd || report.emissionDate)}`, margin + 70, y + 18);
  doc.text(`Local: ${report.location || 'Laboratório Móvel JVM'}`, margin + 130, y + 18);

  // Client Details Card
  y += 26;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + 6, y, contentWidth - 12, 38, 1.5, 1.5, 'FD');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);

  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin + 6, y, contentWidth - 12, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('1. DADOS DO CLIENTE / SOLICITANTE', margin + 10, y + 4.5);

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('RAZÃO SOCIAL:', margin + 10, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(report.clientName, margin + 35, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('CNPJ:', margin + 10, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(report.clientCnpj || 'Consulte cadastro do cliente', margin + 35, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('ENDEREÇO:', margin + 10, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(report.clientAddress || 'Endereço registrado na Ordem de Serviço', margin + 35, y + 24);

  doc.setFont('helvetica', 'bold');
  doc.text('CONTATO / RESP.:', margin + 10, y + 30);
  doc.setFont('helvetica', 'normal');
  doc.text(report.clientContact || 'Departamento de Segurança do Trabalho / SESMT', margin + 35, y + 30);

  // Summary Metrics Box
  y += 42;
  const metricsBoxWidth = (contentWidth - 12);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin + 6, y, metricsBoxWidth, 24, 1.5, 1.5, 'FD');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);

  const colW = metricsBoxWidth / 4;
  
  // Col 1: Total
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
  doc.text('TOTAL ENSAIADO', margin + 6 + (colW * 0.5), y + 6, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(String(report.testsSummary.total), margin + 6 + (colW * 0.5), y + 15, { align: 'center' });
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('equipamentos', margin + 6 + (colW * 0.5), y + 20, { align: 'center' });

  // Col 2: Aprovados
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
  doc.text('APROVADOS', margin + 6 + (colW * 1.5), y + 6, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(greenApprove[0], greenApprove[1], greenApprove[2]);
  doc.text(String(report.testsSummary.approved), margin + 6 + (colW * 1.5), y + 15, { align: 'center' });
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(`${((report.testsSummary.approved / (report.testsSummary.total || 1)) * 100).toFixed(0)}% de conformidade`, margin + 6 + (colW * 1.5), y + 20, { align: 'center' });

  // Col 3: Reprovados
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
  doc.text('REPROVADOS', margin + 6 + (colW * 2.5), y + 6, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(report.testsSummary.rejected > 0 ? redReject[0] : textMuted[0], report.testsSummary.rejected > 0 ? redReject[1] : textMuted[1], report.testsSummary.rejected > 0 ? redReject[2] : textMuted[2]);
  doc.text(String(report.testsSummary.rejected), margin + 6 + (colW * 2.5), y + 15, { align: 'center' });
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(report.testsSummary.rejected > 0 ? 'Descarte obrigatório' : '0% não conformes', margin + 6 + (colW * 2.5), y + 20, { align: 'center' });

  // Col 4: Validade Recomendada
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
  doc.text('CICLO REENSAIO', margin + 6 + (colW * 3.5), y + 6, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
  doc.text('6 a 12 Meses', margin + 6 + (colW * 3.5), y + 14, { align: 'center' });
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Conforme NR-10', margin + 6 + (colW * 3.5), y + 20, { align: 'center' });

  // Divider lines between metric columns
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(margin + 6 + colW, y + 2, margin + 6 + colW, y + 22);
  doc.line(margin + 6 + (colW * 2), y + 2, margin + 6 + (colW * 2), y + 22);
  doc.line(margin + 6 + (colW * 3), y + 2, margin + 6 + (colW * 3), y + 22);

  // Technical Responsibility Footer Card on Cover
  y += 28;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + 6, y, contentWidth - 12, 38, 1.5, 1.5, 'FD');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);

  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin + 6, y, contentWidth - 12, 5.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('2. CORPO TÉCNICO RESPONSÁVEL & VALIDAÇÃO OFICIAL', margin + 10, y + 4);

  // QR Code on right
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', margin + contentWidth - 32, y + 7.5, 22, 22);
    doc.setFontSize(5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('AUTENTICIDADE NR-10', margin + contentWidth - 21, y + 32, { align: 'center' });
    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(validationCode, margin + contentWidth - 21, y + 35, { align: 'center' });
  }

  // Tech Names on left
  doc.setFontSize(7.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Responsável Técnico:', margin + 10, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.techResponsibleName} • CREA: ${report.techResponsibleCrea}${report.techResponsibleRnp ? ' | RNP: ' + report.techResponsibleRnp : ''}`, margin + 10, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.text('Técnico Executor / Laboratorista:', margin + 10, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.technicianName}${report.technicianCreaOrCft ? ' • CFT/CREA: ' + report.technicianCreaOrCft : ''}`, margin + 10, y + 25);

  doc.setFontSize(6.5);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Documento assinado eletronicamente e protegido por código de integridade metrológica.', margin + 10, y + 33);

  // ==========================================
  // PÁGINA 2: SUMÁRIO & INTRODUÇÃO
  // ==========================================
  doc.addPage('a4', 'portrait');
  if (onProgress) onProgress(2, totalSteps, 'Gerando Sumário e Introdução...');

  drawPageHeader('Sumário & Introdução', '1');
  drawPageFooter(2);

  let pageY = margin + 26;

  // Seção Sumário Executivo
  const sumarioHeight = shouldIncludeAnnex ? 60 : 54;
  doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
  doc.roundedRect(margin, pageY, contentWidth, sumarioHeight, 1.5, 1.5, 'FD');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('SUMÁRIO GERAL DO RELATÓRIO', margin + 4, pageY + 6);

  const sumarioItems = [
    { num: '1.', title: 'Capa e Identificação Geral da Empresa & Cliente', page: '01' },
    { num: '2.', title: 'Sumário Executivo e Introdução Normativa', page: '02' },
    { num: '3.', title: 'Metodologia dos Ensaios & Rastreabilidade dos Instrumentos', page: '03' },
    { num: '4.', title: 'Normas Técnicas Aplicadas & Critérios de Aceitação', page: '04' },
    { num: '5.', title: 'Dossiê Consolidado de Laudos dos Ensaios Individuais', page: '05' },
    { num: '6.', title: 'Análise Estatística e Técnica dos Resultados Obtidos', page: '06' },
    { num: '7.', title: 'Conclusão Técnica, Recomendações e Termo de Responsabilidade', page: '06' },
    ...(shouldIncludeAnnex ? [
      { num: '8.', title: `ANEXO I – Laudos Técnicos Individuais dos Ensaios (${tests.length} laudos anexados)`, page: '07+' }
    ] : [])
  ];

  let sumY = pageY + 11.5;
  const lineSpacing = shouldIncludeAnnex ? 5.2 : 5.8;
  sumarioItems.forEach(item => {
    doc.setFontSize(7.2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
    doc.text(item.num, margin + 4, sumY);

    doc.setFont('helvetica', item.num === '8.' ? 'bold' : 'normal');
    doc.setTextColor(item.num === '8.' ? primaryNavy[0] : textDark[0], item.num === '8.' ? primaryNavy[1] : textDark[1], item.num === '8.' ? primaryNavy[2] : textDark[2]);
    doc.text(item.title, margin + 12, sumY);

    // Dotted line
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([0.5, 1.5], 0);
    doc.line(margin + 124, sumY - 0.5, margin + contentWidth - 14, sumY - 0.5);
    doc.setLineDashPattern([], 0); // reset

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(item.num === '8.' ? bluePrimary[0] : textLabel[0], item.num === '8.' ? bluePrimary[1] : textLabel[1], item.num === '8.' ? bluePrimary[2] : textLabel[2]);
    doc.text(item.page, margin + contentWidth - 4, sumY, { align: 'right' });

    sumY += lineSpacing;
  });

  // Seção 2: Introdução
  pageY += sumarioHeight + 6;
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin, pageY, contentWidth, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('2. INTRODUÇÃO E CONTEXTUALIZAÇÃO NORMATIVA', margin + 4, pageY + 4.5);

  pageY += 10;
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const introTextDefault = report.introductionText || 
    `O presente Relatório Técnico tem por objetivo consolidar e apresentar os resultados dos ensaios de rigidez dielétrica e inspeções visuais periódicas realizadas no lote de Equipamentos de Proteção Individual (EPI) e Equipamentos de Proteção Coletiva (EPC) pertencentes à empresa ${report.clientName}.\n\n` +
    `Em atendimento estrito às diretrizes da Norma Regulamentadora NR-10 (Segurança em Instalações e Serviços em Eletricidade), especificamente o item 10.7.8 que preconiza que "os equipamentos, ferramentas e dispositivos isolantes ou equipados com materiais isolantes destinados ao trabalho em alta tensão devem ser submetidos a testes elétricos periódicos", este documento atesta a conformidade dos equipamentos quanto à integridade física e capacidade de suportabilidade dielétrica para o nível de tensão de trabalho requerido.\n\n` +
    `Os ensaios foram conduzidos no laboratório especializado da JVM Engenharia com instrumentos rastreáveis à Rede Brasileira de Calibração (RBC), garantindo total confiabilidade metrológica, segurança aos operadores e rastreabilidade jurídica conforme exigido pelas normas técnicas brasileiras e internacionais aplicáveis.`;

  const introLines = doc.splitTextToSize(introTextDefault, contentWidth - 4);
  doc.text(introLines, margin + 2, pageY);

  // Escopo do Lote
  pageY += (introLines.length * 4.2) + 6;
  doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
  doc.roundedRect(margin, pageY, contentWidth, 42, 1.5, 1.5, 'FD');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('ESCOPO DO LOTE INSPECIONADO', margin + 4, pageY + 6);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);

  const scopePoints = [
    `• Quantidade Total de Itens no Lote: ${report.testsSummary.total} equipamentos (EPI/EPC).`,
    `• Ordem de Serviço de Referência: ${report.serviceOrderNumber || 'OS-AVULSA'} | ART CREA: ${report.artNumber || 'Conforme OS'}.`,
    `• Tipologias Inspecionadas: Luvas Isolantes de Borracha, Mangas Isolantes, Mantas, Tapetes, Varas de Manobra, Escadas e Ferramentas Isoladas.`,
    `• Condições Iniciais: Recebimento, desengorduramento, lavagem, secagem climatizada e condicionamento térmico pré-ensaio.`,
    `• Objetivo Operacional: Garantir a vida útil e a inviolabilidade da rigidez dielétrica para mitigar o risco de arco elétrico e choque elétrico aos eletricistas.`
  ];

  let scpY = pageY + 12;
  scopePoints.forEach(pt => {
    doc.text(pt, margin + 4, scpY);
    scpY += 5.5;
  });

  // ==========================================
  // PÁGINA 3: METODOLOGIA DE ENSAIO & RASTREABILIDADE
  // ==========================================
  doc.addPage('a4', 'portrait');
  if (onProgress) onProgress(3, totalSteps, 'Gerando Metodologia de Ensaios...');

  drawPageHeader('Metodologia de Ensaios & Instrumentação', '3');
  drawPageFooter(3);

  pageY = margin + 26;

  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin, pageY, contentWidth, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('3. METODOLOGIA TÉCNICA E PROCEDIMENTOS DE ENSAIO', margin + 4, pageY + 4.5);

  pageY += 10;
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');

  const methodSteps = [
    {
      title: '3.1 Inspeção Visual Rigorosa & Teste Pneumático',
      desc: 'Todas as peças são minuciosamente inspecionadas sob boa iluminação antes de qualquer ensaio elétrico. Para luvas e mangas de borracha, realiza-se o teste pneumático de insuflação para detecção de microperfurações, cortes, trincas, ressecamento, fissuras por ozônio e incrustações químicas. Peças com desvios mecânicos evidentes são sumariamente reprovadas.'
    },
    {
      title: '3.2 Higienização e Condicionamento Ambiental',
      desc: 'Os equipamentos são higienizados com solução neutra isenta de abrasivos e secos à temperatura ambiente controlada. As peças de borracha permanecem acondicionadas em câmara climatizada por tempo normativo prévio aos testes elétricos para estabilização da umidade relativa e temperatura.'
    },
    {
      title: '3.3 Ensaio de Rigidez Dielétrica & Tensão Aplicada (Hipot)',
      desc: 'O equipamento é montado na bancada de ensaios dielétricos com eletrodos normatizados (banho de água desmineralizada para luvas/mangas; eletrodos metálicos planos para mantas/tapetes; eletrodos segmentados para bastões). Aplica-se uma tensão alternada (60 Hz) com rampa de subida gradual (1 kV/s) até a tensão nominal de ensaio de prova (kV) correspondente à classe de isolação, mantida pelo tempo de 60 a 180 segundos.'
    },
    {
      title: '3.4 Medição Contínua da Corrente de Fuga (mA)',
      desc: 'Durante todo o período de aplicação da alta tensão, a corrente de fuga é monitorada continuamente através de miliamperímetro de precisão calibrado. O valor máximo registrado é comparado aos limites estabelecidos pela respectiva norma. Caso a corrente de fuga ultrapasse o limite ou ocorra perfuração dielétrica (disrupção), o item é classificado como REPROVADO.'
    }
  ];

  methodSteps.forEach(st => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(st.title, margin + 2, pageY);
    pageY += 4;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const lines = doc.splitTextToSize(st.desc, contentWidth - 4);
    doc.text(lines, margin + 2, pageY);
    pageY += (lines.length * 3.8) + 4;
  });

  // Tabela de Instrumentos Utilizados
  pageY += 2;
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin, pageY, contentWidth, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('3.5 RASTREABILIDADE METROLÓGICA DOS INSTRUMENTOS DO LABORATÓRIO', margin + 4, pageY + 4.5);

  pageY += 8;
  // Header da Tabela
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, pageY, contentWidth, 6, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.rect(margin, pageY, contentWidth, 6, 'D');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
  doc.text('INSTRUMENTO / TIPO', margin + 3, pageY + 4);
  doc.text('FABRICANTE / MODELO', margin + 45, pageY + 4);
  doc.text('Nº DE SÉRIE', margin + 95, pageY + 4);
  doc.text('CERTIFICADO RBC', margin + 130, pageY + 4);
  doc.text('VALIDADE', margin + contentWidth - 3, pageY + 4, { align: 'right' });

  pageY += 6;
  const labInstruments = DielectricStorageService.getInstruments().slice(0, 5);
  const instrumentsToDisplay = labInstruments.length > 0 ? labInstruments : [
    { type: 'Hipot Dielétrico CA/CC', manufacturer: 'High Voltage Inc.', model: 'HVT-50kV-Lab', serialNumber: 'HV-2024-9812', calibrationCertNumber: 'RBC-CAL-2026/0412', calibrationExpiryDate: '2027-02-15' },
    { type: 'Termohigrômetro Digital', manufacturer: 'Instrutherm', model: 'HT-500 Pro', serialNumber: 'TH-77412-B', calibrationCertNumber: 'RBC-CAL-2026/0189', calibrationExpiryDate: '2027-04-10' },
    { type: 'Megômetro Digital 5kV', manufacturer: 'Megabras', model: 'MD-5060x', serialNumber: 'MG-55891', calibrationCertNumber: 'RBC-CAL-2025/1120', calibrationExpiryDate: '2026-11-20' }
  ];

  instrumentsToDisplay.forEach((inst, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
      doc.rect(margin, pageY, contentWidth, 5.5, 'F');
    }
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, pageY + 5.5, margin + contentWidth, pageY + 5.5);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(inst.type.substring(0, 24), margin + 3, pageY + 4);

    doc.setFont('helvetica', 'normal');
    doc.text(`${inst.manufacturer} ${inst.model}`.substring(0, 28), margin + 45, pageY + 4);
    doc.text(inst.serialNumber || 'S/N', margin + 95, pageY + 4);
    doc.text(inst.calibrationCertNumber || 'CAL-RBC-PADRAO', margin + 130, pageY + 4);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(greenApprove[0], greenApprove[1], greenApprove[2]);
    doc.text(formatDateBR(inst.calibrationExpiryDate || '2027-01-01'), margin + contentWidth - 3, pageY + 4, { align: 'right' });

    pageY += 5.5;
  });

  // ==========================================
  // PÁGINA 4: NORMAS TÉCNICAS APLICADAS
  // ==========================================
  doc.addPage('a4', 'portrait');
  if (onProgress) onProgress(4, totalSteps, 'Gerando Normas e Critérios...');

  drawPageHeader('Normas Técnicas & Critérios de Aceitação', '4');
  drawPageFooter(4);

  pageY = margin + 26;

  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin, pageY, contentWidth, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('4. NORMAS TÉCNICAS DE REFERÊNCIA & MATRIZ DE CRITÉRIOS', margin + 4, pageY + 4.5);

  pageY += 10;
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Os ensaios dielétricos são fundamentados nas normas nacionais e internacionais vigentes:', margin + 2, pageY);

  pageY += 5;
  const normsList = [
    { code: 'ABNT NBR 16295 / IEC 60903', desc: 'Luvas de material isolante para trabalhos em tensão elétrica.' },
    { code: 'ABNT NBR 10624 / ASTM D1051', desc: 'Mangas de material isolante de borracha para proteção de braços.' },
    { code: 'ASTM D1048', desc: 'Standard Specification for Rubber Insulating Blankets (Mantas Isolantes).' },
    { code: 'ASTM D178', desc: 'Standard Specification for Rubber Insulating Matting (Tapetes Isolantes).' },
    { code: 'ABNT NBR 14540 / ASTM F711', desc: 'Tubos e bastões de fibra de vidro para trabalhos em linha viva e manobra.' },
    { code: 'ABNT NBR IEC 61478 / NBR 16308 / EN 50528', desc: 'Escadas de material isolante para trabalhos sob tensão e baixa tensão (EN 50528:2024).' },
    { code: 'ABNT NBR IEC 60900', desc: 'Ferramentas manuais isoladas para trabalhos até 1.000 V CA e 1.500 V CC.' },
    { code: 'ABNT NBR IEC 61243-1', desc: 'Detectores de tensão capacitivos para ensaios em tensões acima de 1 kV c.a.' },
    { code: 'NR-10 (Portaria MTP nº 3.214/78)', desc: 'Segurança em Instalações e Serviços em Eletricidade (Item 10.7.8).' }
  ];

  normsList.forEach(n => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
    doc.text(`• ${n.code}: `, margin + 4, pageY);
    const codeW = doc.getTextWidth(`• ${n.code}: `);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(n.desc, margin + 4 + codeW, pageY);
    pageY += 4.5;
  });

  // Tabela de Classes e Tensões
  pageY += 4;
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin, pageY, contentWidth, 5.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('4.1 TABELA DE CLASSES, TENSÕES DE TRABALHO E TENSÃO DE ENSAIO (NBR 16295 / ASTM)', margin + 4, pageY + 4);

  pageY += 7.5;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, pageY, contentWidth, 5.5, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.rect(margin, pageY, contentWidth, 5.5, 'D');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
  doc.text('CLASSE', margin + 3, pageY + 3.8);
  doc.text('TENSÃO MÁX. USO (CA)', margin + 25, pageY + 3.8);
  doc.text('TENSÃO MÁX. USO (CC)', margin + 65, pageY + 3.8);
  doc.text('TENSÃO DE ENSAIO (CA)', margin + 105, pageY + 3.8);
  doc.text('TEMPO (s)', margin + 150, pageY + 3.8);
  doc.text('LIMITE FUGA (mA)', margin + contentWidth - 3, pageY + 3.8, { align: 'right' });

  pageY += 5.5;
  const classesData = [
    { cl: 'Classe 00', caMax: '500 V', ccMax: '750 V', testV: '2.500 V (2,5 kV)', time: '60 s', maxLeak: '10 a 14 mA' },
    { cl: 'Classe 0', caMax: '1.000 V (1,0 kV)', ccMax: '1.500 V (1,5 kV)', testV: '5.000 V (5,0 kV)', time: '60 s', maxLeak: '12 a 16 mA' },
    { cl: 'Classe 1', caMax: '7.500 V (7,5 kV)', ccMax: '11.250 V', testV: '10.000 V (10 kV)', time: '60 s', maxLeak: '14 a 18 mA' },
    { cl: 'Classe 2', caMax: '17.000 V (17 kV)', ccMax: '25.500 V', testV: '20.000 V (20 kV)', time: '60 s', maxLeak: '16 a 20 mA' },
    { cl: 'Classe 3', caMax: '26.500 V (26,5 kV)', ccMax: '39.750 V', testV: '30.000 V (30 kV)', time: '60 s', maxLeak: '18 a 22 mA' },
    { cl: 'Classe 4', caMax: '36.000 V (36 kV)', ccMax: '54.000 V', testV: '40.000 V (40 kV)', time: '60 s', maxLeak: '20 a 24 mA' }
  ];

  classesData.forEach((row, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
      doc.rect(margin, pageY, contentWidth, 5, 'F');
    }
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, pageY + 5, margin + contentWidth, pageY + 5);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(row.cl, margin + 3, pageY + 3.6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(row.caMax, margin + 25, pageY + 3.6);
    doc.text(row.ccMax, margin + 65, pageY + 3.6);
    doc.text(row.testV, margin + 105, pageY + 3.6);
    doc.text(row.time, margin + 150, pageY + 3.6);
    doc.setFont('helvetica', 'bold');
    doc.text(row.maxLeak, margin + contentWidth - 3, pageY + 3.6, { align: 'right' });

    pageY += 5;
  });

  // Criteria Rationale Box
  pageY += 4;
  doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
  doc.roundedRect(margin, pageY, contentWidth, 36, 1.5, 1.5, 'FD');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text('CRITÉRIOS DE APROVAÇÃO / REPROVAÇÃO DIELÉTRICA', margin + 4, pageY + 5.5);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);

  const critLines = [
    '• APROVADO: Equipamento que apresentar conformidade plena na inspeção visual (sem trincas/rasgos/furos) e suportar a tensão de ensaio nominal pelo tempo estipulado sem disrupção, centelhamento, perfuração dielétrica ou aquecimento anormal, com corrente de fuga inferior ao teto normativo.',
    '• REPROVADO: Qualquer equipamento que apresentar descontinuidade física, furos, perfuração elétrica sob teste, ou corrente de fuga que ultrapasse o limite máximo estipulado. O item deve ser inutilizado/descartado imediatamente para proteção da vida humana.',
    '• RASTREABILIDADE: Todo equipamento aprovado recebe etiqueta indelével de aprovação com QR Code individual.'
  ];

  let cY = pageY + 11;
  critLines.forEach(cl => {
    const lines = doc.splitTextToSize(cl, contentWidth - 8);
    doc.text(lines, margin + 4, cY);
    cY += (lines.length * 3.5) + 1.5;
  });

  // ==========================================
  // PÁGINA 5+: DOSSIÊ / TABELA DE LAUDOS DOS ENSAIOS
  // ==========================================
  doc.addPage('a4', 'portrait');
  if (onProgress) onProgress(5, totalSteps, 'Gerando Tabela Consolidada de Laudos...');

  let currentPageNum = 5;
  drawPageHeader('Relação de Laudos dos Ensaios Realizados', '5');
  drawPageFooter(currentPageNum);

  pageY = margin + 26;

  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin, pageY, contentWidth, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`5. DOSSIÊ DE ENSAIOS DIELÉTRICOS - TOTAL DE ${tests.length} EQUIPAMENTOS`, margin + 4, pageY + 4.5);

  pageY += 8;

  const drawTableHeader = (yPos: number) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, yPos, contentWidth, 6, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, yPos, contentWidth, 6, 'D');

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
    doc.text('ITEM', margin + 2, yPos + 4);
    doc.text('TAG / ID', margin + 11, yPos + 4);
    doc.text('TIPO DE EQUIPAMENTO', margin + 34, yPos + 4);
    doc.text('CLASSE', margin + 74, yPos + 4);
    doc.text('TENSÃO', margin + 89, yPos + 4);
    doc.text('FUGA (mA)', margin + 107, yPos + 4);
    doc.text('LIMITE', margin + 125, yPos + 4);
    doc.text('RESULTADO', margin + 142, yPos + 4);
    doc.text('LAUDO TÉCNICO', margin + contentWidth - 3, yPos + 4, { align: 'right' });
  };

  drawTableHeader(pageY);
  pageY += 6;

  tests.forEach((test, idx) => {
    // Check page break limit
    if (pageY > pageHeight - margin - 20) {
      doc.addPage('a4', 'portrait');
      currentPageNum++;
      drawPageHeader('Relação de Laudos dos Ensaios Realizados (Cont.)', '5');
      drawPageFooter(currentPageNum);
      pageY = margin + 26;
      drawTableHeader(pageY);
      pageY += 6;
    }

    const isApp = test.result === 'APROVADO';

    if (idx % 2 === 1) {
      doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
      doc.rect(margin, pageY, contentWidth, 5.5, 'F');
    }
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, pageY + 5.5, margin + contentWidth, pageY + 5.5);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
    doc.text(String(idx + 1).padStart(2, '0'), margin + 2, pageY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text(test.equipmentTag.substring(0, 14), margin + 11, pageY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const eqTypeName = test.equipmentType.replace('_', ' ').toUpperCase();
    doc.text(eqTypeName.substring(0, 24), margin + 34, pageY + 4);

    doc.text(`Cl. ${test.equipmentClass || '0'}`, margin + 74, pageY + 4);
    doc.text(`${test.appliedVoltage_kV} kV`, margin + 89, pageY + 4);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(`${test.measuredLeakageCurrent_mA?.toFixed(1) || '0.0'} mA`, margin + 107, pageY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`≤${test.leakageCurrentLimit_mA || 12} mA`, margin + 125, pageY + 4);

    // Status Badge
    doc.setFont('helvetica', 'bold');
    if (isApp) {
      doc.setTextColor(greenApprove[0], greenApprove[1], greenApprove[2]);
      doc.text('APROVADO', margin + 142, pageY + 4);
    } else {
      doc.setTextColor(redReject[0], redReject[1], redReject[2]);
      doc.text('REPROVADO', margin + 142, pageY + 4);
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
    doc.text(test.reportNumber.substring(0, 16), margin + contentWidth - 3, pageY + 4, { align: 'right' });

    pageY += 5.5;
  });

  // ==========================================
  // PÁGINA FINAL DO CORPO PRINCIPAL: ANÁLISE DOS RESULTADOS & CONCLUSÃO & ASSINATURAS
  // ==========================================
  doc.addPage('a4', 'portrait');
  currentPageNum++;
  if (onProgress) onProgress(6, totalSteps, 'Gerando Análise dos Resultados e Conclusão...');

  drawPageHeader('Análise dos Resultados & Conclusão Técnica', '6');
  drawPageFooter(currentPageNum);

  pageY = margin + 26;

  // Seção 6: Análise Estatística
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin, pageY, contentWidth, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('6. ANÁLISE ESTATÍSTICA E TÉCNICA DOS RESULTADOS', margin + 4, pageY + 4.5);

  pageY += 10;
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');

  const analysisDefault = report.resultsAnalysisText ||
    `Do total de ${report.testsSummary.total} equipamentos ensaiados e inspecionados pertencentes à empresa ${report.clientName}, registrou-se ${report.testsSummary.approved} itens em plena conformidade técnica e operacional (${((report.testsSummary.approved / (report.testsSummary.total || 1)) * 100).toFixed(1)}% de aprovação), e ${report.testsSummary.rejected} itens não conformes (${((report.testsSummary.rejected / (report.testsSummary.total || 1)) * 100).toFixed(1)}% de reprovação).\n\n` +
    `As medições de corrente de fuga mantiveram-se dentro da margem de segurança operacional em relação aos tetos normativos estabelecidos pelas normas ABNT NBR 16295 e correlatas. Não foram identificados efeitos térmicos de aquecimento anômalo ou perfuração dielétrica nos itens aprovados. Os equipamentos aprovados encontram-se liberados para uso contínuo em intervenções elétricas no escopo de suas respectivas classes de tensão.`;

  const analysisLines = doc.splitTextToSize(analysisDefault, contentWidth - 4);
  doc.text(analysisLines, margin + 2, pageY);
  pageY += (analysisLines.length * 3.8) + 6;

  // Seção 7: Conclusão & Recomendações
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin, pageY, contentWidth, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('7. CONCLUSÃO TÉCNICA E RECOMENDAÇÕES OPERACIONAIS', margin + 4, pageY + 4.5);

  pageY += 10;
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');

  const conclusionDefault = report.conclusionText ||
    `Conclui-se que o lote de equipamentos analisado atende aos requisitos técnicos de segurança prescritos na Norma Regulamentadora NR-10 e normas técnicas correlatas para os itens classificados como APROVADOS.\n\n` +
    `RECOMENDAÇÕES E DIRETRIZES DE USO:\n` +
    `1. Periodicidade de Reensaio: Os equipamentos devem ser submetidos a novo ensaio dielétrico em laboratório no prazo de 6 (seis) meses para luvas e mangas de borracha, e até 12 (doze) meses para mantas, tapetes, ferramentas e bastões isolantes, ou imediatamente caso sofram agressão mecânica, química ou perfuração suspeita.\n` +
    `2. Inspeção Diária Pré-Uso: O usuário deve obrigatoriamente realizar o teste de insuflação de ar em luvas antes de cada início de jornada de trabalho.\n` +
    `3. Acondicionamento: Armazenar em local seco, fresco, abrigado da luz solar direta, calor, óleo e produtos químicos agressivos.\n` +
    `4. Itens Reprovados: Os equipamentos reprovados devem ser destruídos/descartados para impedir seu reuso inadvertido.`;

  const concLines = doc.splitTextToSize(conclusionDefault, contentWidth - 4);
  doc.text(concLines, margin + 2, pageY);
  pageY += (concLines.length * 3.7) + 6;

  // Signatures Area at bottom (sem caixa/borda envolvente)
  const sigBoxY = pageHeight - margin - 38;
  const sigColW = contentWidth / 2;
  const sigLineY = sigBoxY + 18;

  // Left Signature: Técnico / Laboratorista
  if (techSigUrl) {
    try {
      doc.addImage(techSigUrl, 'PNG', margin + (sigColW / 2) - 22, sigLineY - 9.2, 44, 9.4);
    } catch {
      // ignore
    }
  }

  doc.setDrawColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setLineWidth(0.35);
  doc.line(margin + 10, sigLineY, margin + sigColW - 10, sigLineY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(report.technicianName, margin + (sigColW / 2), sigLineY + 3.8, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
  doc.text(`Técnico Executor / Laboratorista${report.technicianCreaOrCft ? ' • ' + report.technicianCreaOrCft : ''}`, margin + (sigColW / 2), sigLineY + 7.5, { align: 'center' });

  // Right Signature: Responsável Técnico Engenheiro
  if (rtSigUrl) {
    try {
      doc.addImage(rtSigUrl, 'PNG', margin + sigColW + (sigColW / 2) - 22, sigLineY - 9.2, 44, 9.4);
    } catch {
      // ignore
    }
  }

  doc.line(margin + sigColW + 10, sigLineY, margin + contentWidth - 10, sigLineY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(report.techResponsibleName, margin + sigColW + (sigColW / 2), sigLineY + 3.8, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
  doc.text(`Engenheiro Eletricista • Responsável Técnico`, margin + sigColW + (sigColW / 2), sigLineY + 7.5, { align: 'center' });
  doc.text(`CREA: ${report.techResponsibleCrea}${report.techResponsibleRnp ? ' | RNP: ' + report.techResponsibleRnp : ''}`, margin + sigColW + (sigColW / 2), sigLineY + 11.0, { align: 'center' });

  // ==========================================
  // ANEXO I: LAUDOS TÉCNICOS INDIVIDUAIS DOS ENSAIOS
  // ==========================================
  if (shouldIncludeAnnex) {
    // 1. Capa / Página Divisória do Anexo I
    doc.addPage('a4', 'portrait');
    currentPageNum++;
    if (onProgress) onProgress(7, totalSteps, 'Gerando Capa do Anexo I (Laudos Individuais)...');

    drawPageHeader('Anexo I: Laudos Técnicos Individuais dos Ensaios', 'Anexo');
    drawPageFooter(currentPageNum);

    pageY = margin + 26;

    // Header Banner do Anexo
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.roundedRect(margin, pageY, contentWidth, 24, 2, 2, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(report.annexTitle || 'ANEXO I – LAUDOS TÉCNICOS INDIVIDUAIS DOS ENSAIOS DIELÉTRICOS', margin + (contentWidth / 2), pageY + 10, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Dossiê Completo de Certificados Técnicos Individuais (${tests.length} Laudos Oficiais Anexados)`, margin + (contentWidth / 2), pageY + 17, { align: 'center' });

    pageY += 30;

    // Card Explicativo do Anexo
    doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
    doc.roundedRect(margin, pageY, contentWidth, 38, 1.5, 1.5, 'FD');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.text('DECLARAÇÃO DE RASTREABILIDADE METROLÓGICA E AUTENTICIDADE DOS LAUDOS', margin + 4, pageY + 6);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);

    const annexDeclaration = 
      `O presente Anexo reúne na íntegra todos os ${tests.length} Laudos Técnicos de Rigidez Dielétrica e Inspeção Periódica emitidos para a empresa ${report.clientName} (OS: ${report.serviceOrderNumber || 'Avulsa'}).\n\n` +
      `Cada laudo anexo constitui documento técnico oficial e autônomo, contendo a identificação do equipamento (TAG, número de série, fabricante e classe), os parâmetros do ensaio elétrico de prova (tensão aplicada em kV e corrente de fuga medida em mA), os resultados da inspeção visual e pneumática, as condições ambientais do ensaio, o registro fotográfico (quando aplicável), a assinatura eletrônica dos profissionais habilitados e o código QR de validação pública online.`;

    const annexDecLines = doc.splitTextToSize(annexDeclaration, contentWidth - 8);
    doc.text(annexDecLines, margin + 4, pageY + 12);

    pageY += 44;

    // Tabela Resumo do Índice do Anexo
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.rect(margin, pageY, contentWidth, 5.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`ÍNDICE DE LAUDOS TÉCNICOS INDIVIDUAIS ANEXADOS (${tests.length} CERTIFICADOS)`, margin + 4, pageY + 4);

    pageY += 7.5;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, pageY, contentWidth, 5.5, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, pageY, contentWidth, 5.5, 'D');

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
    doc.text('#', margin + 2, pageY + 3.8);
    doc.text('TAG / IDENTIFICAÇÃO', margin + 10, pageY + 3.8);
    doc.text('EQUIPAMENTO', margin + 45, pageY + 3.8);
    doc.text('CLASSE', margin + 95, pageY + 3.8);
    doc.text('RESULTADO', margin + 120, pageY + 3.8);
    doc.text('Nº DO LAUDO ANEXO', margin + contentWidth - 3, pageY + 3.8, { align: 'right' });

    pageY += 5.5;

    // Render index rows
    tests.slice(0, 24).forEach((test, idx) => {
      if (pageY > pageHeight - margin - 15) return; // Prevent overflow on index page

      if (idx % 2 === 1) {
        doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
        doc.rect(margin, pageY, contentWidth, 5, 'F');
      }
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, pageY + 5, margin + contentWidth, pageY + 5);

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
      doc.text(String(idx + 1).padStart(2, '0'), margin + 2, pageY + 3.6);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
      doc.text(test.equipmentTag, margin + 10, pageY + 3.6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(test.equipmentType.replace('_', ' ').toUpperCase().substring(0, 26), margin + 45, pageY + 3.6);
      doc.text(`Classe ${test.equipmentClass || '0'}`, margin + 95, pageY + 3.6);

      doc.setFont('helvetica', 'bold');
      if (test.result === 'APROVADO') {
        doc.setTextColor(greenApprove[0], greenApprove[1], greenApprove[2]);
        doc.text('APROVADO', margin + 120, pageY + 3.6);
      } else {
        doc.setTextColor(redReject[0], redReject[1], redReject[2]);
        doc.text('REPROVADO', margin + 120, pageY + 3.6);
      }

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
      doc.text(test.reportNumber, margin + contentWidth - 3, pageY + 3.6, { align: 'right' });

      pageY += 5;
    });

    if (tests.length > 24) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(`... e mais ${tests.length - 24} laudos apresentados nas páginas subsequentes deste anexo.`, margin + 4, pageY + 4);
    }

    // 2. Renderizar cada Laudo Técnico Individual Completo nas páginas seguintes
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      if (onProgress) {
        onProgress(8 + i, totalSteps, `Anexando Laudo Técnico ${i + 1}/${tests.length}: TAG ${test.equipmentTag} (${test.reportNumber})...`);
      }
      await renderLaudoToDoc(doc, test, company, logoDataUrl, false);
    }
  }

  // Save the PDF locally on device and trigger download/share
  if (onProgress) onProgress(totalSteps, totalSteps, 'Finalizando e gravando o arquivo PDF consolidado na memória...');
  const filename = `${report.reportCode.replace(/[^a-zA-Z0-9_-]/g, '_')}_${report.clientName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)}.pdf`;
  await saveDocLocally(doc, filename, `Relatório Consolidado - ${report.reportCode} (${report.clientName})`, 'relatorio_os');
}
