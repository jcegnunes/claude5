import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { TestRecord, CompanyLabInfo } from '../types';
import { getASTMD178Entry } from './astmBlanketMattingService';
import { TABELA_4_NBR_16295, getClosestGloveLength } from './nbr16295Service';
import { DielectricStorageService } from './syncEngine';
import { ValidationPortalService } from './validationPortalService';
import { formatDateBR, nc } from '../utils/dateUtils';
import { generateGaugeCanvasDataUrl } from '../utils/gaugeUtils';
import { saveDocLocally } from '../utils/nativeFileSaver';
import { cleanSignatureImage } from '../utils/signatureCleaner';

export async function loadImageAsDataUrl(url: string): Promise<string> {
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

export async function generateQRCodeDataUrl(text: string): Promise<string> {
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

/**
 * Normaliza e formata o nome de exibição de ferramentas manuais isoladas,
 * garantindo a correta separação das palavras, remoção de sublinhados e
 * padronização de nomenclatura técnica.
 */
export function formatToolDisplayName(name?: string, type?: string): string {
  if (!name && !type) return 'Ferramenta Manual Isolada 1000V';
  const raw = (name || type || '').trim();
  
  const presetMap: Record<string, string> = {
    arco_serra_isolado: 'Chave Arco Serra com Cabo Isolado',
    chave_ajustavel: 'Chave Isolada Tipo Ajustável',
    chave_allen: 'Chave Isolada Tipo Allen',
    chave_boca: 'Chave Isolada Tipo Boca',
    chave_canhao: 'Chave Isolada Tipo Canhão',
    faca_isolada: 'Chave Isolada Tipo Faca',
    chave_bit_isolado: 'Chave Bit para Ferramenta Isolado',
    detector_tensao_caneta: 'Detector de Tensão Tipo Caneta',
    chave_fenda: 'Chave de Fenda Isolada 1000V',
    chave_philips: 'Chave Philips / Cruzada Isolada 1000V',
    alicate_universal: 'Alicate Universal Isolado 1000V',
    alicate_corte: 'Alicate de Corte Diagonal Isolado 1000V',
    alicate_bico: 'Alicate de Bico Meia-Cana Isolado 1000V',
    chave_inglesa: 'Chave Inglesa Ajustável Isolada 1000V',
    chave_estrela_boca: 'Chave Estrela / Fixa Combinada Isolada 1000V',
    ferramenta_isolada: 'Ferramenta Manual Isolada 1000V'
  };

  const lower = raw.toLowerCase();
  if (presetMap[lower]) {
    return presetMap[lower];
  }

  return raw
    .replace(/_/g, ' ')
    .replace(/([a-zA-ZÀ-ÿ0-9])\(/g, '$1 (')
    .replace(/\)([a-zA-ZÀ-ÿ0-9])/g, ') $1')
    .replace(/([a-zA-ZÀ-ÿ])\//g, '$1 / ')
    .replace(/\/([a-zA-ZÀ-ÿ])/g, ' / $1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Retorna a descrição por extenso do tipo de equipamento dielétrico
 */
export function formatEquipmentType(type?: string, customName?: string): string {
  if (customName && customName.trim()) return customName.trim().toUpperCase();
  if (!type) return 'EQUIPAMENTO DIELÉTRICO';
  const map: Record<string, string> = {
    luva_isolante: 'LUVA ISOLANTE DE BORRACHA',
    manga_isolante: 'MANGA ISOLANTE DE BORRACHA',
    bota_dielétrica: 'BOTA DIELÉTRICA',
    capacete_classe_b: 'CAPACETE CLASSE B',
    manta_isolante: 'MANTA ISOLANTE DE BORRACHA',
    tapete_isolante: 'TAPETE ISOLANTE DE BORRACHA',
    escada_isolada: 'ESCADA ISOLADA DE FIBRA',
    bastao_manobra: 'BASTÃO DE MANOBRA',
    vara_manobra: 'VARA DE MANOBRA TELESCÓPICA',
    ponteira_prova: 'PONTEIRA DE PROVA',
    detector_tensao: 'DETECTOR DE TENSÃO',
    ferramenta_isolada: 'FERRAMENTA MANUAL ISOLADA',
    arco_serra_isolado: 'CHAVE ARCO SERRA COM CABO ISOLADO',
    chave_ajustavel: 'CHAVE ISOLADA TIPO AJUSTÁVEL',
    chave_allen: 'CHAVE ISOLADA TIPO ALLEN',
    chave_boca: 'CHAVE ISOLADA TIPO BOCA',
    chave_canhao: 'CHAVE ISOLADA TIPO CANHÃO',
    faca_isolada: 'CHAVE ISOLADA TIPO FACA',
    chave_bit_isolado: 'CHAVE BIT PARA FERRAMENTA ISOLADO',
    detector_tensao_caneta: 'DETECTOR DE TENSÃO TIPO CANETA',
    chave_fenda: 'CHAVE DE FENDA ISOLADA',
    chave_philips: 'CHAVE PHILIPS / CRUZADA ISOLADA',
    alicate_universal: 'ALICATE UNIVERSAL ISOLADO',
    alicate_corte: 'ALICATE DE CORTE DIAGONAL ISOLADO',
    alicate_bico: 'ALICATE DE BICO MEIA-CANA ISOLADO',
    chave_inglesa: 'CHAVE INGLESA AJUSTÁVEL ISOLADA',
    chave_estrela_boca: 'CHAVE ESTRELA / COMBINADA ISOLADA',
    outro: 'OUTRO EQUIPAMENTO'
  };
  return map[type.toLowerCase().trim()] || type.replace(/_/g, ' ').toUpperCase();
}

export async function renderLaudoToDoc(
  doc: jsPDF, 
  test: TestRecord, 
  company: CompanyLabInfo, 
  logoDataUrl: string | null,
  isFirstPageInDoc: boolean = true
): Promise<void> {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 9;
  const contentWidth = pageWidth - (margin * 2);
  const pageBottomLimit = pageHeight - 12;

  // Track starting page for this specific laudo within doc
  const startPageNum = isFirstPageInDoc ? 1 : doc.getNumberOfPages() + 1;
  if (!isFirstPageInDoc) {
    doc.addPage('a4', 'portrait');
  }

  // Generate QR Code for validation URL
  const validationUrl = ValidationPortalService.buildPublicValidationUrl(test.validationCode);
  const qrDataUrl = await generateQRCodeDataUrl(validationUrl);

  // Paleta de Cores IDÊNTICA ao Laudo Web
  const primaryNavy = [10, 37, 64];      // #0A2540
  const bluePrimary = [29, 78, 216];     // #1D4ED8 (blue-700)
  const textDark = [15, 23, 42];         // #0F172A (slate-900)
  const textMuted = [100, 116, 139];     // #64748B (slate-500)
  const textLabel = [71, 85, 105];       // #475569 (slate-600)
  const borderGray = [203, 213, 225];    // #CBD5E1 (slate-300)
  const bgLightCard = [248, 250, 252];   // #F8FAFC (slate-50)
  const greenApprove = [16, 185, 129];   // #10B981 (emerald-500)
  const redReject = [239, 68, 68];       // #EF4444 (red-500)
  const amberArt = [217, 119, 6];        // #D97706 (amber-600)

  // ART da OS ou do Teste
  const workOrders = DielectricStorageService.getWorkOrders();
  const matchingOS = workOrders.find(os => os.id === test.serviceOrderId || os.osNumber === test.serviceOrderNumber);
  const effectiveArtNumber = test.artNumber || matchingOS?.artNumber || '';

  const isApproved = test.result === 'APROVADO';
  const isGlove = Boolean(test.equipmentType === 'luva_isolante' || test.gloveLength_mm);
  const selectedGloveClass = (test.equipmentClass || '0').trim();
  const selectedGloveLength = getClosestGloveLength(test.gloveLength_mm || 360);
  const gloveTableEntry = TABELA_4_NBR_16295.find(r => r.classe === selectedGloveClass);
  const normLeakageLimit = (isGlove && gloveTableEntry && gloveTableEntry.limitesFugaAC_mA[selectedGloveLength] !== null)
    ? gloveTableEntry.limitesFugaAC_mA[selectedGloveLength]! * 2
    : test.equipmentType === 'tapete_isolante'
    ? (test.leakageCurrentLimit_mA || 100)
    : (test.leakageCurrentLimit_mA || 10);
  const normApplicableDisplay = isGlove
    ? (test.normCode && (test.normCode.includes('16295') || test.normCode.includes('16259') || test.normCode.includes('IEC 60903')) ? 'NBR 16295 Tabela 4' : (test.normCode || 'NBR 16295 Tabela 4'))
    : (test.normCode || 'Norma Geral NR-10');

  // Pre-load photo URLs & Signatures
  const loadedPhotos = (test.photos && test.photos.length > 0)
    ? await Promise.all(
        test.photos.map(async (ph) => ({
          ...ph,
          dataUrl: await loadImageAsDataUrl(ph.url)
        }))
      )
    : [];

  const allUsers = DielectricStorageService.getUsers();
  const techUser = allUsers.find(u => u.id === test.technicianId || u.name === test.technicianName);
  const rtUser = allUsers.find(u => u.id === test.techResponsibleId || u.name === test.techResponsibleName || u.role === 'responsavel_tecnico');

  const rawTechSig = test.technicianSignature?.signatureImage || techUser?.signatureUrl || '';
  const rawRTSig = test.techResponsibleSignature?.signatureImage || rtUser?.signatureUrl || company.technicalResponsible?.signatureUrl || '';

  const cleanedTechSig = rawTechSig ? await cleanSignatureImage(rawTechSig) : '';
  const cleanedRTSig = rawRTSig ? await cleanSignatureImage(rawRTSig) : '';

  const technicianSigUrl = cleanedTechSig 
    ? await loadImageAsDataUrl(cleanedTechSig)
    : '';

  const techResponsibleSigUrl = cleanedRTSig
    ? await loadImageAsDataUrl(cleanedRTSig)
    : '';

  let y = margin;

  // Mini-cabeçalho no topo de páginas seguintes (anexo de fotos)
  const drawRunningHeader = (): void => {
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.rect(margin, y, contentWidth, 5.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    doc.text(`${company.name.toUpperCase()} • LAUDO TÉCNICO Nº ${test.reportNumber} • OS: ${test.serviceOrderNumber}`, margin + 3, y + 3.8);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(`TAG: ${test.equipmentTag} (${formatEquipmentType(test.equipmentType)})`, pageWidth - margin - 3, y + 3.8, { align: 'right' });
    y += 7.5;
  };

  // Helper para desenhar a barra de título da seção
  const drawSectionHeader = (title: string, subtitleRight?: string): void => {
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.roundedRect(margin, y, contentWidth, 4.8, 0.8, 0.8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text(title.toUpperCase(), margin + 3, y + 3.4);

    if (subtitleRight) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(255, 255, 255);
      doc.text(subtitleRight.toUpperCase(), pageWidth - margin - 3, y + 3.4, { align: 'right' });
    }
    y += 4.8;
  };

  // ================= 1. CABEÇALHO PRINCIPAL DA EMPRESA (IDÊNTICO AO WEB) =================
  const headerTopY = y;
  const headerHeight = 21;

  // Lado Esquerdo: Logotipo / Badge JVM + Dados Cadastrais
  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, headerTopY, 24, 18, 1.2, 1.2, 'F');
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.roundedRect(margin, headerTopY, 24, 18, 1.2, 1.2, 'D');
      doc.addImage(logoDataUrl, 'PNG', margin + 1.2, headerTopY + 1.2, 21.6, 15.6, undefined, 'FAST');
    } catch {
      // Fallback para Badge JVM
      doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
      doc.roundedRect(margin, headerTopY, 18, 18, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('JVM', margin + 9, headerTopY + 11.5, { align: 'center' });
    }
  } else {
    doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.roundedRect(margin, headerTopY, 18, 18, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('JVM', margin + 9, headerTopY + 11.5, { align: 'center' });
  }

  const textLeftX = logoDataUrl ? margin + 27 : margin + 21;
  
  // Nome da Empresa
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(company.name.toUpperCase(), textLeftX, headerTopY + 4.0);

  // Razão Social & Registros
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
  doc.text(company.legalName || 'JVM ENGENHARIA E TREINAMENTOS LTDA', textLeftX, headerTopY + 7.6);

  doc.setFontSize(6.4);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`${company.creaCompanyRegister} • CNPJ: ${company.cnpj}`, textLeftX, headerTopY + 10.8);

  // Endereço Completo
  const addressLine = [
    company.address,
    company.number && !company.address?.includes(company.number) ? company.number : '',
    company.neighborhood && !company.address?.includes(company.neighborhood) ? company.neighborhood : '',
    company.city ? `${company.city} - ${company.state || 'SP'}` : company.cityState,
    company.cep ? `CEP: ${company.cep}` : ''
  ].filter(Boolean).join(' • ');

  const splitAddr = doc.splitTextToSize(addressLine, 98);
  doc.text(splitAddr, textLeftX, headerTopY + 14.2);

  // Lado Direito: Identificador Oficial e Metadados do Laudo
  const rightBoxX = pageWidth - margin - 56;
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.text('IDENTIFICADOR OFICIAL', rightBoxX, headerTopY + 3.4);

  doc.setTextColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
  doc.setFontSize(10.0);
  doc.text(test.reportNumber, rightBoxX, headerTopY + 7.6);

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'bold');
  doc.text(`OS: ${test.serviceOrderNumber}`, rightBoxX, headerTopY + 11.4);

  let rightSubY = headerTopY + 14.8;
  if (effectiveArtNumber) {
    // Badge da ART
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(245, 158, 11);  // amber-500
    doc.roundedRect(rightBoxX, rightSubY - 2.8, 54, 4.2, 0.6, 0.6, 'FD');
    doc.setTextColor(146, 64, 14);   // amber-800
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.text(`ART: ${effectiveArtNumber}`, rightBoxX + 2, rightSubY + 0.2);
    rightSubY += 4.8;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.0);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Emissão: ${formatDateBR(test.testDate)} às ${test.testTime || '09:00'}`, rightBoxX, rightSubY);

  // Linha divisória inferior do cabeçalho
  y = headerTopY + headerHeight;
  doc.setDrawColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(0.2);
  y += 2.2;

  // ================= SEÇÃO 1: IDENTIFICAÇÃO DO CLIENTE E DO EQUIPAMENTO =================
  drawSectionHeader('1. Identificação do Cliente e do Equipamento Dielétrico', `Data do Ensaio: ${formatDateBR(test.testDate)}`);

  // Grid estruturado em Box IDÊNTICO ao Web
  const clientFields: Array<{ label: string; value: string; isHighlight?: boolean; isMono?: boolean; fullWidth?: boolean }> = [
    { label: 'Cliente:', value: nc(test.clientName), isHighlight: true },
    { label: 'Ordem de Serviço (OS):', value: nc(test.serviceOrderNumber), isHighlight: true, isMono: true },
    { label: 'Local do Ensaio:', value: nc(test.location, 'Laboratório Móvel JVM') },
    { label: 'Tipo de Equipamento:', value: formatEquipmentType(test.equipmentType), isHighlight: true },
    { label: 'Tag / Patrimônio:', value: nc(test.equipmentTag), isHighlight: true, isMono: true },
    { label: 'Classe Dielétrica:', value: `Classe ${test.equipmentClass}`, isHighlight: true },
    { label: 'Nº de Série:', value: nc(test.equipmentSerial), isMono: true },
    { label: 'Certificado de Aprovação (CA):', value: nc(test.equipmentCa) },
    ...(test.equipmentType === 'luva_isolante' || test.gloveLength_mm
      ? [{ label: 'Comprimento da Luva (NBR 16295):', value: `${test.gloveLength_mm || 360} mm`, isMono: true, isHighlight: true }]
      : test.blanketDimensions
      ? [{ label: 'Dimensões da Manta:', value: nc(test.blanketDimensions) }]
      : test.mattingDimensions
      ? [{ label: 'Dimensões do Tapete:', value: nc(test.mattingDimensions) }]
      : [{ label: 'Comprimento / Dimensão:', value: test.gloveLength_mm ? `${test.gloveLength_mm} mm` : 'N/C' }]
    )
  ];

  // Campos específicos de mantas, tapetes, ART, etc. (inseridos antes dos dados do colaborador)
  if (test.blanketStyle) {
    clientFields.push({
      label: 'Estilo da Manta (ASTM D1048):',
      value: `${test.blanketStyle} ${test.blanketType ? `• ${test.blanketType}` : ''}`
    });
  }
  if (test.blanketDimensions && test.equipmentType !== 'manta_isolante') {
    clientFields.push({ label: 'Dimensões da Manta:', value: nc(test.blanketDimensions) });
  }
  if (test.flashoverClearance_mm) {
    clientFields.push({ label: 'Folga Anti-Flashover:', value: `${test.flashoverClearance_mm} mm`, isMono: true });
  }
  if (test.mattingSurface) {
    clientFields.push({ label: 'Superfície do Tapete (ASTM D178):', value: nc(test.mattingSurface) });
  }
  if (test.mattingThickness_mm !== undefined) {
    const astm = getASTMD178Entry(test.equipmentClass);
    const minStr = astm ? ` (Mín. Tab 2: ${astm.espessuraMinima_mm} mm)` : '';
    clientFields.push({
      label: 'Espessura Medida do Tapete:',
      value: `${test.mattingThickness_mm} mm${minStr}`,
      isMono: true
    });
  }
  if (test.mattingDimensions && test.equipmentType !== 'tapete_isolante') {
    clientFields.push({ label: 'Dimensões do Tapete:', value: nc(test.mattingDimensions) });
  }
  if (effectiveArtNumber) {
    clientFields.push({ label: 'Nº da ART (CREA/CFT):', value: nc(effectiveArtNumber), isHighlight: true, isMono: true });
  }

  // Preencher células vazias para que a linha do Colaborador sempre comece no início de uma nova linha (coluna 1)
  while (clientFields.length % 3 !== 0) {
    clientFields.push({ label: '', value: '' });
  }

  // DADOS DO COLABORADOR: Sempre na última linha do cabeçalho em 3 colunas completas
  clientFields.push(
    { label: 'Colaborador / Usuário:', value: nc(test.collaboratorName || matchingOS?.collaboratorName), isHighlight: true },
    { label: 'Matrícula Funcional:', value: nc(test.collaboratorRegistration || matchingOS?.collaboratorRegistration), isMono: true },
    { label: 'Setor / Lotação:', value: nc(test.collaboratorSector || matchingOS?.collaboratorSector) }
  );

  // Renderizar o Grid de 3 colunas
  const numCols = 3;
  const colW = (contentWidth - 4) / numCols;
  const rowHeight = 6.0;
  const numRows = Math.ceil(clientFields.length / numCols);
  const cardBoxHeight = numRows * rowHeight + 1.8;

  // Background Box
  doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
  doc.roundedRect(margin, y, contentWidth, cardBoxHeight, 1, 1, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, cardBoxHeight, 1, 1, 'D');

  clientFields.forEach((field, index) => {
    if (!field.label) return;
    const r = Math.floor(index / numCols);
    const c = index % numCols;
    const itemX = margin + 2.5 + (c * (colW + 1.5));
    const itemY = y + 1.2 + (r * rowHeight);

    // Label
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.text(field.label, itemX, itemY + 1.8);

    // Value
    if (field.isHighlight && field.label.includes('Tag')) {
      doc.setTextColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
      doc.setFont('helvetica', 'bold');
    } else if (field.isHighlight) {
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont('helvetica', 'bold');
    }
    doc.setFontSize(6.8);
    const valText = doc.splitTextToSize(field.value, colW - 3);
    doc.text(valText[0] || '', itemX, itemY + 4.6);
  });

  y += cardBoxHeight + 2.0;

  // Se houver ferramentas isoladas (Sub-tabela completa de 8 colunas idêntica ao web)
  if (test.isolatedTools && test.isolatedTools.length > 0) {
    const totalTools = test.isolatedTools.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
    const approvedTools = test.isolatedTools.filter(t => (t.result || 'APROVADO') === 'APROVADO').length;
    const rejectedTools = test.isolatedTools.filter(t => t.result === 'REPROVADO').length;

    // Header da sub-tabela em tom laranja
    doc.setFillColor(255, 247, 237); // orange-50
    doc.setDrawColor(254, 215, 170); // orange-200
    doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'FD');

    doc.setFillColor(249, 115, 22); // orange-500 bullet
    doc.circle(margin + 4, y + 4, 1.2, 'F');

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text('Discriminação e Avaliação Individual das Ferramentas Manuais Isoladas (NBR 9699 / IEC 60900)', margin + 7, y + 3.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
    doc.text('Ensaio de rigidez dielétrica individual aplicado a 10,0 kV CA e inspeção visual de integridade', margin + 7, y + 6.8);

    // Badges resumo no canto direito
    const badgeSummaryText = `Total: ${totalTools} un  |  ${approvedTools} Aprovada(s) ${rejectedTools > 0 ? ` |  ${rejectedTools} Reprovada(s)` : ''}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(154, 52, 18);
    doc.text(badgeSummaryText, pageWidth - margin - 3, y + 5.2, { align: 'right' });

    y += 9;

    // Tabela de Ferramentas
    const tColW = [7, 54, 24, 11, 21, 21, 22, contentWidth - (7 + 54 + 24 + 11 + 21 + 21 + 22)];
    const tColX = [
      margin,
      margin + tColW[0],
      margin + tColW[0] + tColW[1],
      margin + tColW[0] + tColW[1] + tColW[2],
      margin + tColW[0] + tColW[1] + tColW[2] + tColW[3],
      margin + tColW[0] + tColW[1] + tColW[2] + tColW[3] + tColW[4],
      margin + tColW[0] + tColW[1] + tColW[2] + tColW[3] + tColW[4] + tColW[5],
      margin + tColW[0] + tColW[1] + tColW[2] + tColW[3] + tColW[4] + tColW[5] + tColW[6]
    ];

    // Table Header
    doc.setFillColor(254, 237, 213); // orange-100
    doc.rect(margin, y, contentWidth, 4.5, 'F');
    doc.setTextColor(124, 45, 18);   // orange-950
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);

    doc.text('#', tColX[0] + tColW[0] / 2, y + 3.1, { align: 'center' });
    doc.text('Ferramenta & Especificação', tColX[1] + 2, y + 3.1);
    doc.text('Fabricante', tColX[2] + 2, y + 3.1);
    doc.text('Qtd', tColX[3] + tColW[3] / 2, y + 3.1, { align: 'center' });
    doc.text('Insp. Visual', tColX[4] + tColW[4] / 2, y + 3.1, { align: 'center' });
    doc.text('Ensaio 10kV', tColX[5] + tColW[5] / 2, y + 3.1, { align: 'center' });
    doc.text('Parecer', tColX[6] + tColW[6] / 2, y + 3.1, { align: 'center' });
    doc.text('Observações / Motivo', tColX[7] + 2, y + 3.1);

    y += 4.5;

    test.isolatedTools.forEach((tool, idx) => {
      const isToolAppr = (tool.result || 'APROVADO') === 'APROVADO';
      const rowBg = isToolAppr ? (idx % 2 === 1 ? [255, 255, 255] : [254, 252, 249]) : [254, 242, 242];
      const rowH = 5.6;

      doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
      doc.rect(margin, y, contentWidth, rowH, 'F');
      doc.setDrawColor(240, 240, 240);
      doc.line(margin, y + rowH, pageWidth - margin, y + rowH);

      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);

      // Index
      doc.text(String(idx + 1), tColX[0] + tColW[0] / 2, y + 3.5, { align: 'center' });

      // Name & Specification with guaranteed word separation
      const formattedToolName = formatToolDisplayName(tool.toolName, tool.toolType);
      const cleanSpec = (tool.sizeOrSpec || '').trim().replace(/_/g, ' ');

      if (cleanSpec) {
        // Linha 1: Nome da ferramenta em negrito
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.4);
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        const splitName = doc.splitTextToSize(formattedToolName, tColW[1] - 3);
        doc.text(splitName[0] || formattedToolName, tColX[1] + 2, y + 2.5);

        // Linha 2: Especificação / Dimensão com texto legível e espaçado
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4.7);
        doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
        const splitSpec = doc.splitTextToSize(cleanSpec, tColW[1] - 3);
        doc.text(splitSpec[0] || cleanSpec, tColX[1] + 2, y + 4.8);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.6);
        doc.setTextColor(textDark[0], textDark[1], textDark[2]);
        const splitName = doc.splitTextToSize(formattedToolName, tColW[1] - 3);
        if (splitName.length > 1) {
          doc.text(splitName[0], tColX[1] + 2, y + 2.5);
          doc.text(splitName[1], tColX[1] + 2, y + 4.8);
        } else {
          doc.text(splitName[0] || formattedToolName, tColX[1] + 2, y + 3.5);
        }
      }

      // Manufacturer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.6);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      const splitMfg = doc.splitTextToSize(nc(tool.manufacturer), tColW[2] - 3);
      doc.text(splitMfg[0] || nc(tool.manufacturer), tColX[2] + 2, y + 3.5);

      // Quantity
      doc.setFont('helvetica', 'bold');
      doc.text(`${tool.quantity} un`, tColX[3] + tColW[3] / 2, y + 3.5, { align: 'center' });

      // Visual Inspection Badge
      const isVisualOk = tool.visualInspection !== 'nao_conforme';
      doc.setTextColor(isVisualOk ? 6 : 185, isVisualOk ? 95 : 28, isVisualOk ? 70 : 28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.6);
      doc.text(isVisualOk ? 'Conforme' : 'Não Conf.', tColX[4] + tColW[4] / 2, y + 3.5, { align: 'center' });

      // Dielectric 10kV Badge
      const isDielectricOk = tool.dielectricResult !== 'nao_conforme';
      doc.setTextColor(isDielectricOk ? 6 : 185, isDielectricOk ? 95 : 28, isDielectricOk ? 70 : 28);
      doc.text(isDielectricOk ? 'Conforme' : 'Disrupção', tColX[5] + tColW[5] / 2, y + 3.5, { align: 'center' });

      // Parecer Individual
      if (isToolAppr) {
        doc.setFillColor(greenApprove[0], greenApprove[1], greenApprove[2]);
        doc.roundedRect(tColX[6] + 1.5, y + 1.1, tColW[6] - 3, 3.4, 0.5, 0.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('APROVADO', tColX[6] + tColW[6] / 2, y + 3.5, { align: 'center' });
      } else {
        doc.setFillColor(redReject[0], redReject[1], redReject[2]);
        doc.roundedRect(tColX[6] + 1.5, y + 1.1, tColW[6] - 3, 3.4, 0.5, 0.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('REPROVADO', tColX[6] + tColW[6] / 2, y + 3.5, { align: 'center' });
      }

      // Observation
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.4);
      doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
      const obsText = tool.defectReason || (isToolAppr ? 'Aprovado sem restrições' : 'Não atendeu à NBR 9699');
      const splitObs = doc.splitTextToSize(obsText, tColW[7] - 3);
      doc.text(splitObs[0] || obsText, tColX[7] + 2, y + 3.5);

      y += rowH;
    });

    y += 2.5;
  }

  // ================= SEÇÃO 2: REFERÊNCIA NORMATIVA E CONDIÇÕES AMBIENTAIS =================
  drawSectionHeader('2. Referência Normativa e Condições Ambientais');

  // Grid de Condições Ambientais Box
  doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
  doc.roundedRect(margin, y, contentWidth, 10.0, 1, 1, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, 10.0, 1, 1, 'D');

  // Norma Regulamentadora
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.text('Norma Regulamentadora / Técnica:', margin + 3, y + 3.2);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text(normApplicableDisplay, margin + 3, y + 7.5);

  // Procedimento
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.text('Procedimento de Ensaio:', margin + 85, y + 3.2);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text(test.procedureCode || 'PR-JVM-LAB-01', margin + 85, y + 7.5);

  // Temperatura
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.text('Temperatura Ambiente:', margin + 125, y + 3.2);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text(`${test.environmental.temperatureC}°C`, margin + 125, y + 7.5);

  // Umidade
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.text('Umidade Relativa:', margin + 158, y + 3.2);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text(`${test.environmental.relativeHumidityPercent}% UR`, margin + 158, y + 7.5);

  y += 12.0;

  // TABELA 4 DA ABNT NBR 16295 / IEC 60903 PARA LUVAS ISOLANTES (IDÊNTICO AO WEB COM DESTAQUE)
  if (isGlove) {
    // Header da Tabela 4
    doc.setFillColor(239, 246, 255); // blue-50
    doc.setDrawColor(191, 219, 254); // blue-200
    doc.roundedRect(margin, y, contentWidth, 5.0, 0.8, 0.8, 'FD');

    doc.setFillColor(37, 99, 235); // blue-600 dot
    doc.circle(margin + 3.5, y + 2.5, 1.0, 'F');

    doc.setTextColor(30, 58, 138); // blue-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.text('TABELA 4 DA ABNT NBR 16295 / IEC 60903 – ENSAIOS DE PROVA E RIGIDEZ DIELÉTRICA', margin + 6, y + 3.4);

    const gloveBadgeText = `Luva Ensaiada: Classe ${selectedGloveClass} - ${selectedGloveLength} mm`;
    const badgeWidth = doc.getTextWidth(gloveBadgeText) + 4;
    doc.setFillColor(219, 234, 254); // blue-100
    doc.roundedRect(pageWidth - margin - badgeWidth - 2, y + 0.8, badgeWidth, 3.4, 0.6, 0.6, 'F');
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 78, 216);
    doc.text(gloveBadgeText, pageWidth - margin - 2 - (badgeWidth / 2), y + 3.2, { align: 'center' });

    y += 5.4;

    // Sub-colunas da Tabela 4
    const gColW = [16, 26, 24, 20, 20, 20, 22, contentWidth - (16 + 26 + 24 + 20 + 20 + 20 + 22)];
    const gColX = [
      margin,
      margin + gColW[0],
      margin + gColW[0] + gColW[1],
      margin + gColW[0] + gColW[1] + gColW[2],
      margin + gColW[0] + gColW[1] + gColW[2] + gColW[3],
      margin + gColW[0] + gColW[1] + gColW[2] + gColW[3] + gColW[4],
      margin + gColW[0] + gColW[1] + gColW[2] + gColW[3] + gColW[4] + gColW[5],
      margin + gColW[0] + gColW[1] + gColW[2] + gColW[3] + gColW[4] + gColW[5] + gColW[6]
    ];

    // Double Header Table
    doc.setFillColor(224, 231, 255); // indigo-100
    doc.rect(margin, y, contentWidth, 3.2, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.2);

    doc.text('Classe', gColX[0] + gColW[0] / 2, y + 2.3, { align: 'center' });
    doc.text('Tensão Máx. Uso', gColX[1] + gColW[1] / 2, y + 2.3, { align: 'center' });
    doc.text('Tensão Prova CA', gColX[2] + gColW[2] / 2, y + 2.3, { align: 'center' });
    doc.text('280 mm', gColX[3] + gColW[3] / 2, y + 2.3, { align: 'center' });
    doc.text('360 mm', gColX[4] + gColW[4] / 2, y + 2.3, { align: 'center' });
    doc.text('410 mm', gColX[5] + gColW[5] / 2, y + 2.3, { align: 'center' });
    doc.text('>= 460 mm', gColX[6] + gColW[6] / 2, y + 2.3, { align: 'center' });
    doc.text('Tensão Rigidez', gColX[7] + gColW[7] / 2, y + 2.3, { align: 'center' });

    y += 3.2;

    const gloveRowsToDisplay = TABELA_4_NBR_16295.filter((r) => r.classe === selectedGloveClass);
    const tableRows = gloveRowsToDisplay.length > 0 ? gloveRowsToDisplay : TABELA_4_NBR_16295;

    tableRows.forEach((row) => {
      const gRowHeight = 3.6;

      doc.setFillColor(219, 234, 254); // blue-100 destacado
      doc.rect(margin, y, contentWidth, gRowHeight, 'F');
      doc.setDrawColor(59, 130, 246);  // blue-500
      doc.rect(margin, y, contentWidth, gRowHeight, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.4);
      doc.setTextColor(30, 58, 138);

      // Classe
      doc.text(`Classe ${row.classe}`, gColX[0] + gColW[0] / 2, y + 2.5, { align: 'center' });

      // Tensão Uso
      doc.text(`${row.tensaoMaximaUsoAC_kV.toFixed(1)} kV`, gColX[1] + gColW[1] / 2, y + 2.5, { align: 'center' });

      // Tensão Prova
      doc.text(`${row.tensaoProvaAC_kV.toFixed(1)} kV`, gColX[2] + gColW[2] / 2, y + 2.5, { align: 'center' });

      // Colunas de Comprimento
      const lengths = [280, 360, 410, 460] as const;
      lengths.forEach((len, lIdx) => {
        const val = row.limitesFugaAC_mA[len];
        const isTargetCell = selectedGloveLength === len && val !== null;
        const cellX = gColX[3 + lIdx];
        const cellW = gColW[3 + lIdx];

        if (isTargetCell) {
          doc.setFillColor(29, 78, 216); // blue-700
          doc.roundedRect(cellX + 1, y + 0.4, cellW - 2, gRowHeight - 0.8, 0.4, 0.4, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.text(`${val * 2} mA [2 Luv]`, cellX + cellW / 2, y + 2.5, { align: 'center' });
        } else {
          doc.setTextColor(val !== null ? 30 : 160, val !== null ? 58 : 85, val !== null ? 138 : 105);
          doc.setFont('helvetica', 'bold');
          doc.text(val !== null ? `${val} mA` : 'N/a', cellX + cellW / 2, y + 2.5, { align: 'center' });
        }
      });

      // Tensão Rigidez
      doc.setTextColor(30, 58, 138);
      doc.setFont('helvetica', 'bold');
      doc.text(`${row.tensaoRigidezAC_kV.toFixed(1)} kV`, gColX[7] + gColW[7] / 2, y + 2.5, { align: 'center' });

      y += gRowHeight;
    });

    // Nota explicativa
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 3.4, 'F');
    doc.setTextColor(textLabel[0], textLabel[1], textLabel[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.7);
    const effectiveGloveLimit = test.leakageCurrentLimit_mA || normLeakageLimit;
    const singleLimitStr = gloveTableEntry?.limitesFugaAC_mA[selectedGloveLength] !== null ? `${gloveTableEntry?.limitesFugaAC_mA[selectedGloveLength]} mA` : 'N/a';
    doc.text(`Critério Operativo: Luva Classe ${selectedGloveClass} (${selectedGloveLength} mm) -> Tensão de Prova: ${test.appliedVoltage_kV} kV CA | Limite Máx Fuga (2 Luvas Simultâneas): ${effectiveGloveLimit} mA (${singleLimitStr} x 2).`, margin + 3, y + 2.4);
    doc.text('Nota: Ensaio realizado em 2 luvas simultâneas na cuba (dobro do limite unitário da Tab. 4). N/a = Não aplicável.', pageWidth - margin - 3, y + 2.4, { align: 'right' });

    y += 4.8;
  }

  // ================= SEÇÃO 3: PARÂMETROS E RESULTADOS DAS MEDIÇÕES ELÉTRICAS =================
  drawSectionHeader('3. Parâmetros e Resultados das Medições Elétricas');

  // ================= INDICADORES GRÁFICOS TIPO VELOCÍMETRO (DENTRO DA SEÇÃO 3) =================
  const appliedV = test.appliedVoltage_kV || 0;
  const voltageScale = Math.max(15, Math.ceil(appliedV * 1.35 / 5) * 5);
  const leakVal = test.measuredLeakageCurrent_mA || 0;
  const effectiveLimit = normLeakageLimit || test.leakageCurrentLimit_mA || 10;
  const leakScale = Math.max(10, Math.ceil(Math.max(effectiveLimit * 1.35, leakVal * 1.25) / 5) * 5);
  const leakPercent = ((leakVal / effectiveLimit) * 100).toFixed(1);
  const isLeakOk = leakVal <= effectiveLimit;

  const gaugeVoltageDataUrl = generateGaugeCanvasDataUrl({
    title: 'Tensão de Ensaio Aplicada',
    value: appliedV,
    unit: `kV ${test.voltageType || 'CA'}`,
    maxScale: voltageScale,
    type: 'voltage',
    statusLabel: 'TENSÃO DE PROVA NOMINAL',
    subtext: `Duração: ${test.applicationDurationSeconds}s contínuos (${test.voltageType})`
  });

  const gaugeLeakageDataUrl = generateGaugeCanvasDataUrl({
    title: 'Corrente de Fuga Medida',
    value: leakVal,
    unit: test.currentUnit || 'mA',
    maxScale: leakScale,
    limit: effectiveLimit,
    isConforming: isLeakOk,
    type: 'current',
    statusLabel: isLeakOk ? 'CONFORME (ABAIXO DO LIMITE)' : 'NÃO CONFORME (ULTRAPASSOU)',
    subtext: `Limite Máximo Normativo: ${effectiveLimit} mA (${leakPercent}% atingido)`
  });

  if (gaugeVoltageDataUrl && gaugeLeakageDataUrl) {
    const gWidth = (contentWidth - 4) / 2;
    const gHeight = 31.0;

    try {
      y += 1.0;
      doc.addImage(gaugeVoltageDataUrl, 'PNG', margin, y, gWidth, gHeight);
      doc.addImage(gaugeLeakageDataUrl, 'PNG', margin + gWidth + 4, y, gWidth, gHeight);
      y += gHeight + 2.0;
    } catch (err) {
      console.warn('Erro ao inserir gauges no PDF:', err);
    }
  }

  // Table Columns
  const mColW = [50, 65, 45, contentWidth - (50 + 65 + 45)];
  const mColX = [margin, margin + mColW[0], margin + mColW[0] + mColW[1], margin + mColW[0] + mColW[1] + mColW[2]];

  // Table Header
  doc.setFillColor(226, 232, 240); // slate-200
  doc.rect(margin, y, contentWidth, 4.0, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.rect(margin, y, contentWidth, 4.0, 'D');

  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);

  doc.text('Parâmetro de Ensaio', mColX[0] + 3, y + 2.8);
  doc.text('Exigência Normativa', mColX[1] + 3, y + 2.8);
  doc.text('Valor Medido', mColX[2] + 3, y + 2.8);
  doc.text('Avaliação', mColX[3] + mColW[3] / 2, y + 2.8, { align: 'center' });

  y += 4.0;

  // Linhas das Medições
  const measurementRows: Array<{
    param: string;
    norm: string;
    measured: string;
    isConforming: boolean;
  }> = [
    {
      param: 'Tensão de Ensaio Aplicada',
      norm: isGlove 
        ? `${gloveTableEntry ? gloveTableEntry.tensaoProvaAC_kV.toFixed(1) : test.appliedVoltage_kV.toFixed(1)} kV CA (Tab. 4 - Cl. ${selectedGloveClass})` 
        : `${test.appliedVoltage_kV} kV (${test.voltageType}) – ${normApplicableDisplay}`,
      measured: `${test.appliedVoltage_kV} kV ${test.voltageType}`,
      isConforming: true
    },
    {
      param: 'Tempo de Aplicação da Tensão',
      norm: isGlove 
        ? '60 segundos contínuos (ABNT NBR 16295 / IEC 60903)' 
        : `${test.applicationDurationSeconds} segundos contínuos (${normApplicableDisplay})`,
      measured: `${test.applicationDurationSeconds} s`,
      isConforming: true
    },
    {
      param: 'Corrente de Fuga',
      norm: isGlove 
        ? `Máximo ${normLeakageLimit} mA (Tab. 4 - Cl. ${selectedGloveClass} / ${selectedGloveLength} mm)` 
        : test.equipmentType === 'tapete_isolante'
        ? `Máximo ${normLeakageLimit} mA (Limite adotado – ASTM D178-22)`
        : test.equipmentType === 'ferramenta_isolada'
        ? `Máximo ${test.leakageCurrentLimit_mA} mA (${(test.isolatedTools?.reduce((acc, t) => acc + (Number(t.quantity) || 1), 0) || 1)} un x 1,0 mA - NBR 9699)`
        : `Máximo ${test.leakageCurrentLimit_mA} ${test.currentUnit} (${normApplicableDisplay})`,
      measured: `${test.measuredLeakageCurrent_mA} ${test.currentUnit}`,
      isConforming: test.measuredLeakageCurrent_mA <= normLeakageLimit
    },
    {
      param: 'Rigidez / Suportabilidade à Perfuração',
      norm: isGlove 
        ? `Sem disrupção (Tab. 4 - Rigidez: ${gloveTableEntry ? gloveTableEntry.tensaoRigidezAC_kV.toFixed(1) + ' kV CA' : 'NBR 16295'})` 
        : `Sem disrupção, perfuração ou centelhamento (${normApplicableDisplay})`,
      measured: test.withstandWithoutPuncture ? 'Sem perfuração dielétrica' : 'Ocorreu disrupção',
      isConforming: test.withstandWithoutPuncture
    }
  ];

  if (test.equipmentType === 'tapete_isolante' && test.mattingThickness_mm !== undefined) {
    const astm = getASTMD178Entry(test.equipmentClass);
    const minReq = astm ? astm.espessuraMinima_mm : 3.2;
    measurementRows.push({
      param: 'Espessura Físico-Mecânica (ASTM D178-22)',
      norm: `Mínimo de ${minReq} mm (Tabela 2 - Classe ${test.equipmentClass})`,
      measured: `${test.mattingThickness_mm} mm`,
      isConforming: test.mattingThickness_mm >= minReq
    });
  }

  measurementRows.forEach((r, idx) => {
    const isEven = idx % 2 === 1;
    const rowH = 3.8;
    doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
    doc.rect(margin, y, contentWidth, rowH, 'F');
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, y, contentWidth, rowH, 'D');

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.text(r.param, mColX[0] + 3, y + 2.6);

    doc.setFont('helvetica', 'bold');
    doc.text(doc.splitTextToSize(r.norm, mColW[1] - 4)[0], mColX[1] + 3, y + 2.6);

    doc.setTextColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
    doc.text(r.measured, mColX[2] + 3, y + 2.6);

    if (r.isConforming) {
      doc.setFillColor(209, 250, 229); // emerald-100
      doc.roundedRect(mColX[3] + (mColW[3] - 20) / 2, y + 0.6, 20, 2.6, 0.4, 0.4, 'F');
      doc.setTextColor(6, 95, 70);     // emerald-800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.2);
      doc.text('CONFORME', mColX[3] + mColW[3] / 2, y + 2.5, { align: 'center' });
    } else {
      doc.setFillColor(254, 226, 226); // red-100
      doc.roundedRect(mColX[3] + (mColW[3] - 24) / 2, y + 0.6, 24, 2.6, 0.4, 0.4, 'F');
      doc.setTextColor(153, 27, 27);    // red-800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.2);
      doc.text('NÃO CONFORME', mColX[3] + mColW[3] / 2, y + 2.5, { align: 'center' });
    }

    y += rowH;
  });

  y += 2.0;

  // ================= SEÇÃO 4: INSPEÇÃO VISUAL E FÍSICO-MECÂNICA (LISTA COMPLETA IDÊNTICA AO WEB) =================
  const checkList = test.visualInspection && test.visualInspection.length > 0
    ? test.visualInspection
    : [
        { id: '1', item: 'Furos, cortes, rasgos ou perfurações na superfície', status: 'conforme' as const },
        { id: '2', item: 'Deformações, bolhas, trincas ou rachaduras por ozônio', status: 'conforme' as const },
        { id: '3', item: 'Ressecamento, endurecimento ou perda de elasticidade', status: 'conforme' as const },
        { id: '4', item: 'Isenção de contaminação condutiva, óleo, graxa ou partículas', status: 'conforme' as const },
        { id: '5', item: 'Legibilidade das inscrições obrigatórias, Classe, Tag e CA', status: 'conforme' as const }
      ];

  // Grid de 2 colunas para itens da inspeção visual para economia vertical harmoniosa
  const vColW = (contentWidth - 4) / 2;
  const vItemHeight = 3.8;
  const vNumRows = Math.ceil(checkList.length / 2);
  const vTotalCardHeight = vNumRows * vItemHeight + 1.5;

  drawSectionHeader('4. Inspeção Visual e Físico-Mecânica');

  doc.setFillColor(bgLightCard[0], bgLightCard[1], bgLightCard[2]);
  doc.roundedRect(margin, y, contentWidth, vTotalCardHeight, 1, 1, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, y, contentWidth, vTotalCardHeight, 1, 1, 'D');

  checkList.forEach((chk, cIdx) => {
    const col = cIdx % 2;
    const row = Math.floor(cIdx / 2);
    const itemX = margin + 3 + col * (vColW + 2);
    const itemY = y + 1.0 + row * vItemHeight;

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.6);
    const itemLabel = doc.splitTextToSize(chk.item, vColW - 24)[0];
    doc.text(itemLabel, itemX, itemY + 2.6);

    // Badge
    const statusText = chk.status === 'conforme' ? 'CONFORME' : chk.status === 'nao_conforme' ? 'NÃO CONFORME' : 'N/C';
    const statusBg = chk.status === 'conforme' ? [209, 250, 229] : chk.status === 'nao_conforme' ? [254, 226, 226] : [241, 245, 249];
    const statusColor = chk.status === 'conforme' ? [6, 95, 70] : chk.status === 'nao_conforme' ? [153, 27, 27] : [71, 85, 105];

    doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
    doc.roundedRect(itemX + vColW - 22, itemY + 0.3, 19, 3.0, 0.4, 0.4, 'F');
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.8);
    doc.text(statusText, itemX + vColW - 12.5, itemY + 2.3, { align: 'center' });
  });

  y += vTotalCardHeight + 2.0;

  // ================= SEÇÃO 5: PARECER TÉCNICO CONCLUSIVO =================
  const hasDualOpinions = test.equipmentType === 'ferramenta_isolada' && test.isolatedTools && 
    test.isolatedTools.some(t => (t.result || 'APROVADO') === 'APROVADO' && t.visualInspection !== 'nao_conforme' && t.dielectricResult !== 'nao_conforme') &&
    test.isolatedTools.some(t => t.result === 'REPROVADO' || t.visualInspection === 'nao_conforme' || t.dielectricResult === 'nao_conforme');

  const approvedToolsList = test.isolatedTools?.filter(t => (t.result || 'APROVADO') === 'APROVADO' && t.visualInspection !== 'nao_conforme' && t.dielectricResult !== 'nao_conforme') || [];
  const reprovedToolsList = test.isolatedTools?.filter(t => t.result === 'REPROVADO' || t.visualInspection === 'nao_conforme' || t.dielectricResult === 'nao_conforme') || [];

  if (hasDualOpinions) {
    const boxW = (contentWidth - 3) / 2;

    // Parecer 1: Aprovadas text & tools listing
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    const approvedText = test.approvedOpinion || 
      `As ${approvedToolsList.length} ferramenta(s) aprovadas foram ensaiadas individualmente a 10.000 V CA por 180s (NBR 9699 / IEC 60900), apresentando plena integridade da isolação e suportabilidade dielétrica sem perfuração.`;
    const splitApproved = doc.splitTextToSize(approvedText, boxW - 6);

    const approvedItemsSummary = approvedToolsList.map(t => `• ${t.quantity}x ${formatToolDisplayName(t.toolName, t.toolType)}${t.sizeOrSpec ? ` (${t.sizeOrSpec.replace(/_/g, ' ')})` : ''} - ${nc(t.manufacturer)}`).join('\n');
    const splitApprovedItems = doc.splitTextToSize(approvedItemsSummary, boxW - 6);

    // Parecer 2: Reprovadas text & tools listing
    const reprovedText = test.reprovedOpinion || 
      `As ${reprovedToolsList.length} ferramenta(s) reprovadas NÃO atenderam aos critérios da NBR 9699 / IEC 60900. Determinada segregação imediata, etiqueta vermelha e descarte/destruição compulsória conforme NR-10.`;
    const splitReproved = doc.splitTextToSize(reprovedText, boxW - 6);

    const reprovedItemsSummary = reprovedToolsList.map(t => `• ${t.quantity}x ${formatToolDisplayName(t.toolName, t.toolType)}: ${t.defectReason || 'Reprovado no ensaio 10kV / visual'}`).join('\n');
    const splitReprovedItems = doc.splitTextToSize(reprovedItemsSummary, boxW - 6);

    const maxApprovedLines = splitApproved.length + (approvedToolsList.length > 0 ? splitApprovedItems.length + 1 : 0);
    const maxReprovedLines = splitReproved.length + (reprovedToolsList.length > 0 ? splitReprovedItems.length + 1 : 0);
    const maxLines = Math.max(maxApprovedLines, maxReprovedLines);

    const dualBoxHeight = Math.max(20.0, 5.5 + (maxLines * 2.3) + 6.0);

    // Header for Dual Opinion Section
    doc.setFillColor(10, 37, 64);
    doc.roundedRect(margin, y, contentWidth, 4.5, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text('5. PARECERES TÉCNICOS CONCLUSIVOS (EMISSÃO DUPLA - APROVADAS & REPROVADAS)', margin + 3, y + 3.2);
    doc.setFontSize(5.6);
    doc.text(`Lote Misto: ${approvedToolsList.length} Aprovada(s) / ${reprovedToolsList.length} Reprovada(s)`, pageWidth - margin - 3, y + 3.2, { align: 'right' });
    y += 5.2;

    // Render Box 1 (Emerald - Approved)
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(margin, y, boxW, dualBoxHeight, 1.0, 1.0, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(6, 95, 70);
    doc.text(`PARECER 1: APROVADAS (${approvedToolsList.length} un)`, margin + 3, y + 3.6);

    let curApprY = y + 6.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(splitApproved, margin + 3, curApprY);
    curApprY += splitApproved.length * 2.3 + 0.8;

    if (approvedToolsList.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.2);
      doc.setTextColor(6, 95, 70);
      doc.text('Itens Homologados e Aptos:', margin + 3, curApprY);
      curApprY += 2.3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.0);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(splitApprovedItems, margin + 3, curApprY);
    }

    const dualDivY = y + dualBoxHeight - 4.8;
    doc.setDrawColor(167, 243, 208);
    doc.line(margin + 3, dualDivY, margin + boxW - 3, dualDivY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(6, 95, 70);
    doc.text(`Validade: ${formatDateBR(test.retestDueDate)} (12 meses)`, margin + 3, dualDivY + 3.2);

    // Render Box 2 (Red - Reproved)
    const box2X = margin + boxW + 3;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(239, 68, 68);
    doc.roundedRect(box2X, y, boxW, dualBoxHeight, 1.0, 1.0, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(153, 27, 27);
    doc.text(`PARECER 2: REPROVADAS (${reprovedToolsList.length} un)`, box2X + 3, y + 3.6);

    let curReprY = y + 6.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.4);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(splitReproved, box2X + 3, curReprY);
    curReprY += splitReproved.length * 2.3 + 0.8;

    if (reprovedToolsList.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.2);
      doc.setTextColor(153, 27, 27);
      doc.text('Itens Condenados / Motivo de Avaria:', box2X + 3, curReprY);
      curReprY += 2.3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.0);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.text(splitReprovedItems, box2X + 3, curReprY);
    }

    doc.setDrawColor(254, 202, 202);
    doc.line(box2X + 3, dualDivY, box2X + boxW - 3, dualDivY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(153, 27, 27);
    doc.text('Ação: Segregação & Descarte NR-10', box2X + 3, dualDivY + 3.2);

    y += dualBoxHeight + 2.0;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);

    let baseRationale = test.resultRationale || 'Equipamento ensaiado e aprovado em conformidade com as exigências normativas aplicáveis.';
    
    // Se for ferramenta isolada com lista de ferramentas, adicionar detalhamento de itens
    let toolItemsText = '';
    if (test.equipmentType === 'ferramenta_isolada' && test.isolatedTools && test.isolatedTools.length > 0) {
      const totalPieces = test.isolatedTools.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
      const toolsSummary = test.isolatedTools.map(t => `${t.quantity}x ${formatToolDisplayName(t.toolName, t.toolType)}${t.sizeOrSpec ? ` (${t.sizeOrSpec.replace(/_/g, ' ')})` : ''} [${nc(t.manufacturer)}]`).join(', ');
      toolItemsText = `Itens ensaiados (${totalPieces} un): ${toolsSummary}.`;
    }

    const splitRationale = doc.splitTextToSize(baseRationale, contentWidth - 8);
    const splitTools = toolItemsText ? doc.splitTextToSize(toolItemsText, contentWidth - 8) : [];

    const rationaleLineHeight = 2.4;
    const rationaleBlockHeight = (splitRationale.length + (splitTools.length > 0 ? splitTools.length + 1 : 0)) * rationaleLineHeight;
    const conclusionBoxHeight = Math.max(13.5, 4.0 + rationaleBlockHeight + 5.5);

    if (isApproved) {
      doc.setFillColor(236, 253, 245); // emerald-50
      doc.setDrawColor(16, 185, 129);  // emerald-500
    } else {
      doc.setFillColor(254, 242, 242); // red-50
      doc.setDrawColor(239, 68, 68);   // red-500
    }
    doc.roundedRect(margin, y, contentWidth, conclusionBoxHeight, 1.0, 1.0, 'FD');

    // Cabeçalho do parecer
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    const toolQtySuffix = (test.equipmentType === 'ferramenta_isolada' && test.isolatedTools && test.isolatedTools.length > 0)
      ? ` (${test.isolatedTools.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} FERRAMENTAS ISOLADAS)`
      : '';

    if (isApproved) {
      doc.setTextColor(6, 95, 70); // emerald-800
      doc.text(`5. PARECER TÉCNICO CONCLUSIVO: APROVADO${toolQtySuffix}`, margin + 3.5, y + 3.6);
    } else {
      doc.setTextColor(153, 27, 27); // red-800
      doc.text(`5. PARECER TÉCNICO CONCLUSIVO: REPROVADO${toolQtySuffix}`, margin + 3.5, y + 3.6);
    }

    // Texto do Parecer Técnico
    let curRatY = y + 6.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(splitRationale, margin + 3.5, curRatY);
    curRatY += splitRationale.length * rationaleLineHeight;

    if (splitTools.length > 0) {
      curRatY += 0.8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.4);
      doc.setTextColor(isApproved ? 6 : 153, isApproved ? 95 : 27, isApproved ? 70 : 27);
      doc.text(splitTools, margin + 3.5, curRatY);
      curRatY += splitTools.length * rationaleLineHeight;
    }

    // Linha divisória inferior calculada dinamicamente
    const dividerY = y + conclusionBoxHeight - 4.8;
    doc.setDrawColor(isApproved ? 167 : 254, isApproved ? 243 : 202, isApproved ? 208 : 202);
    doc.line(margin + 3.5, dividerY, pageWidth - margin - 3.5, dividerY);

    // Linha da Validade / Reensaio Obrigatório
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text('Validade do Ensaio / Próximo Reensaio Obrigatório:', margin + 3.5, dividerY + 3.2);

    // Retest date box
    const retestText = formatDateBR(test.retestDueDate);
    const badgeDateW = 22;
    const badgeDateH = 3.2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(pageWidth - margin - badgeDateW - 2.5, dividerY + 0.8, badgeDateW, badgeDateH, 0.5, 0.5, 'FD');
    doc.setTextColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.text(retestText, pageWidth - margin - 2.5 - (badgeDateW / 2), dividerY + 0.8 + 2.2, { align: 'center' });

    y += conclusionBoxHeight + 2.0;
  }

  // ================= SEÇÃO 6: ASSINATURAS E VALIDAÇÃO DIGITAL (3 COLUNAS IDÊNTICAS AO WEB - PÁGINA 1) =================
  const sigColW = (contentWidth - 8) / 3;
  const sigLineY = y + 10.5;

  // 1. Analista Executor
  const techX = margin;
  if (technicianSigUrl) {
    try {
      doc.addImage(technicianSigUrl, 'PNG', techX + 4, sigLineY - 9.2, sigColW - 8, 9.4);
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.8);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('Assinatura Eletrônica Registrada', techX + sigColW / 2, sigLineY - 2.0, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Assinatura Eletrônica Registrada', techX + sigColW / 2, sigLineY - 2.0, { align: 'center' });
  }

  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.35);
  doc.line(techX + 3, sigLineY, techX + sigColW - 3, sigLineY);

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text(test.technicianName, techX + sigColW / 2, sigLineY + 3.2, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(test.technicianCftOrCrea || 'Analista Executor', techX + sigColW / 2, sigLineY + 6.0, { align: 'center' });

  // 2. Responsável Técnico
  const rtX = margin + sigColW + 4;
  if (techResponsibleSigUrl) {
    try {
      doc.addImage(techResponsibleSigUrl, 'PNG', rtX + 4, sigLineY - 9.2, sigColW - 8, 9.4);
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.8);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text('Assinatura Eletrônica Registrada', rtX + sigColW / 2, sigLineY - 2.0, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Assinatura Eletrônica Registrada', rtX + sigColW / 2, sigLineY - 2.0, { align: 'center' });
  }

  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.35);
  doc.line(rtX + 3, sigLineY, rtX + sigColW - 3, sigLineY);

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text(test.techResponsibleName, rtX + sigColW / 2, sigLineY + 3.2, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`${test.techResponsibleCrea} • Responsável Técnico`, rtX + sigColW / 2, sigLineY + 6.0, { align: 'center' });

  // 3. Validação Digital QR Code
  const qrX = margin + (sigColW * 2) + 8;
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', qrX + (sigColW - 4) / 2 - 6.25, y + 0.5, 12.5, 12.5);
  }
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.8);
  doc.text('VALIDAÇÃO DIGITAL', qrX + (sigColW - 4) / 2, y + 14.5, { align: 'center' });

  doc.setTextColor(bluePrimary[0], bluePrimary[1], bluePrimary[2]);
  doc.setFontSize(5.2);
  doc.text(test.validationCode, qrX + (sigColW - 4) / 2, y + 17.5, { align: 'center' });

  y += 21.0;

  // ================= SEÇÃO 7: REGISTRO FOTOGRÁFICO NA PÁGINA 02 EM DIANTE (4 FOTOS POR PÁGINA) =================
  if (loadedPhotos.length > 0) {
    // Dimensões padronizadas para grade 2x2 (exatamente 4 fotos por página A4)
    const pColW = (contentWidth - 6) / 2; // ~94 mm de largura por card
    const pCardH = 118;                   // 118 mm de altura por card
    const pImgH = 86;                     // 86 mm de altura para imagem em alta definição
    const pImgW = pColW - 4;              // 90 mm de largura da imagem
    const rowGap = 6;
    const colGap = 6;

    // Iterar de 4 em 4 fotos (Cada lote de até 4 fotos ocupa 1 página A4 dedicada)
    for (let pageBatchIdx = 0; pageBatchIdx < loadedPhotos.length; pageBatchIdx += 4) {
      doc.addPage('a4', 'portrait');
      y = margin;
      drawRunningHeader();

      const pageNumForPhotos = Math.floor(pageBatchIdx / 4) + 1;
      const totalPhotoPages = Math.ceil(loadedPhotos.length / 4);
      const headerSubtitle = totalPhotoPages > 1 
        ? `Fotos ${pageBatchIdx + 1} a ${Math.min(pageBatchIdx + 4, loadedPhotos.length)} de ${loadedPhotos.length} (Anexo ${pageNumForPhotos}/${totalPhotoPages})`
        : `${loadedPhotos.length} registro(s) anexado(s)`;

      drawSectionHeader('7. Registro Fotográfico do Ensaio Dielétrico (Anexo Fotográfico)', headerSubtitle);

      const current4Photos = loadedPhotos.slice(pageBatchIdx, pageBatchIdx + 4);

      // Renderizar em até 2 linhas de 2 fotos (totalizando 4 fotos por página)
      for (let rIdx = 0; rIdx < current4Photos.length; rIdx += 2) {
        const rowPhotos = current4Photos.slice(rIdx, rIdx + 2);
        const rowY = y;

        rowPhotos.forEach((photo, cIdx) => {
          const cardX = margin + cIdx * (pColW + colGap);
          const cardY = rowY;

          // Container Card
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(cardX, cardY, pColW, pCardH, 1.5, 1.5, 'F');
          doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
          doc.roundedRect(cardX, cardY, pColW, pCardH, 1.5, 1.5, 'D');

          // Category Header
          const catMap: Record<string, string> = {
            antes: '1. INSPEÇÃO VISUAL PRELIMINAR',
            durante: '2. ENSAIO HIPOT / ALTA TENSÃO',
            depois: '3. INSPEÇÃO PÓS-ENSAIO',
            disrupcao: '4. DISRUPÇÃO / AVARIA / DEFEITO',
            outro: 'EVIDÊNCIA FOTOGRÁFICA'
          };
          const catText = catMap[photo.category] || photo.category.toUpperCase();

          doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
          doc.rect(cardX, cardY, pColW, 5.0, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.8);
          doc.text(catText, cardX + 2.5, cardY + 3.5);

          // Photo Image (Alta Resolução com preservação de borda e fundo)
          if (photo.dataUrl) {
            try {
              doc.addImage(photo.dataUrl, 'JPEG', cardX + 2, cardY + 6.0, pImgW, pImgH);
            } catch {
              doc.setFillColor(240, 243, 246);
              doc.rect(cardX + 2, cardY + 6.0, pImgW, pImgH, 'F');
              doc.setTextColor(140, 150, 160);
              doc.setFontSize(7);
              doc.text('Imagem indisponível', cardX + pColW / 2, cardY + 45, { align: 'center' });
            }
          }

          // Divisória sutil acima da legenda
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.line(cardX + 2, cardY + pImgH + 7.5, cardX + pColW - 2, cardY + pImgH + 7.5);

          // Caption / Legenda explicativa
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.2);
          doc.setTextColor(textDark[0], textDark[1], textDark[2]);
          const captionText = photo.caption || 'Registro fotográfico da inspeção / ensaio dielétrico.';
          const captionLines = doc.splitTextToSize(captionText, pColW - 6);
          doc.text(captionLines.slice(0, 2), cardX + 3, cardY + pImgH + 11.5);

          // Timestamp / Identificação do Técnico no rodapé do card
          doc.setFontSize(5.2);
          doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
          const photoTime = photo.timestamp ? new Date(photo.timestamp).toLocaleString('pt-BR') : formatDateBR(test.testDate);
          doc.text(`${photoTime} • ${photo.userName || test.technicianName}`, cardX + 3, cardY + pCardH - 2.5);
        });

        y += pCardH + rowGap;
      }
    }
  }

  // ================= RODAPÉ EM TODAS AS PÁGINAS =================
  const endPageNum = doc.getNumberOfPages();
  const totalPagesInLaudo = endPageNum - startPageNum + 1;

  for (let p = startPageNum; p <= endPageNum; p++) {
    doc.setPage(p);
    const laudoPageIdx = p - startPageNum + 1;

    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFontSize(5.8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Documento emitido eletronicamente pela plataforma JVM Dielectric Lab • Hash: ${test.documentHash ? test.documentHash.substring(0, 24) : 'SEC-JVM-2026'}...`,
      margin,
      pageHeight - 6.5
    );

    doc.setFont('helvetica', 'bold');
    doc.text(
      `Página ${laudoPageIdx} de ${totalPagesInLaudo}`,
      pageWidth - margin,
      pageHeight - 6.5,
      { align: 'right' }
    );
  }
}

export function sanitizeForFilename(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '') // remove caracteres inválidos para sistema de arquivos
    .replace(/\s+/g, '_')           // substitui espaços por sublinhados
    .replace(/_+/g, '_')            // consolida múltiplos sublinhados
    .replace(/^[._]+|[._]+$/g, ''); // remove pontos e sublinhados nas pontas
}

export function getEffectiveCollaborator(test: TestRecord): string {
  if (test.collaboratorName && test.collaboratorName.trim() && test.collaboratorName !== 'Não especificado') {
    return test.collaboratorName.trim();
  }
  try {
    const workOrders = DielectricStorageService.getWorkOrders();
    const os = workOrders.find(o => o.id === test.serviceOrderId || o.osNumber === test.serviceOrderNumber);
    if (os?.collaboratorName && os.collaboratorName.trim() && os.collaboratorName !== 'Não especificado') {
      return os.collaboratorName.trim();
    }
    const equipments = DielectricStorageService.getEquipment();
    const eq = equipments.find(e => e.id === test.equipmentId || e.tag === test.equipmentTag);
    if (eq?.collaboratorName && eq.collaboratorName.trim() && eq.collaboratorName !== 'Não especificado') {
      return eq.collaboratorName.trim();
    }
  } catch (e) {
    console.warn('Erro ao obter colaborador vinculado:', e);
  }
  return '';
}

export function generateLaudoFileName(test: TestRecord): string {
  const safeReportNum = sanitizeForFilename(test.reportNumber || 'LAUDO');
  const safeTag = sanitizeForFilename(test.equipmentTag || 'EQUIP');
  const collaborator = getEffectiveCollaborator(test);
  const safeCollaborator = sanitizeForFilename(collaborator);

  if (safeCollaborator) {
    return `Laudo_Tecnico_${safeReportNum}_${safeTag}_${safeCollaborator}.pdf`;
  }
  return `Laudo_Tecnico_${safeReportNum}_${safeTag}.pdf`;
}

export function generateCertificadoFileName(test: TestRecord): string {
  const safeCertNum = sanitizeForFilename(test.certificateNumber || test.reportNumber || 'CERT');
  const safeTag = sanitizeForFilename(test.equipmentTag || 'EQUIP');
  const collaborator = getEffectiveCollaborator(test);
  const safeCollaborator = sanitizeForFilename(collaborator);

  if (safeCollaborator) {
    return `Certificado_${safeCertNum}_${safeTag}_${safeCollaborator}.pdf`;
  }
  return `Certificado_${safeCertNum}_${safeTag}.pdf`;
}

export async function exportLaudoPDF(test: TestRecord, company: CompanyLabInfo): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  const logoDataUrl = company.logoUrl ? await loadImageAsDataUrl(company.logoUrl) : null;
  await renderLaudoToDoc(doc, test, company, logoDataUrl, true);
  const filename = generateLaudoFileName(test);
  await saveDocLocally(doc, filename, `Laudo Técnico - ${test.equipmentTag} (${test.reportNumber})`, 'laudo');
}

export async function renderCertificadoToDoc(
  doc: jsPDF,
  test: TestRecord,
  company: CompanyLabInfo,
  logoDataUrl: string | null,
  isFirstPageInDoc: boolean = true
): Promise<void> {
  const pageWidth = 210;
  const pageHeight = 148;
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);

  if (!isFirstPageInDoc) {
    doc.addPage([210, 148], 'landscape');
  }

  const validationUrl = ValidationPortalService.buildPublicValidationUrl(test.validationCode);
  const qrDataUrl = await generateQRCodeDataUrl(validationUrl);

  const primaryNavy = [10, 37, 64];
  const secondaryBlue = [0, 102, 204];
  const orange = [255, 107, 0];
  const green = [0, 140, 60];

  // Outer Border & Gold/Navy accents
  doc.setDrawColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setLineWidth(1.2);
  doc.roundedRect(margin, margin, contentWidth, pageHeight - (margin * 2), 4, 4, 'D');

  doc.setDrawColor(orange[0], orange[1], orange[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin + 2, margin + 2, contentWidth - 4, pageHeight - (margin * 2) - 4, 3, 3, 'D');

  // Header Banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(margin + 2.5, margin + 2.5, contentWidth - 5, 20, 'F');

  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 5, margin + 4.5, 24, 16, 1.5, 1.5, 'F');
      doc.addImage(logoDataUrl, 'PNG', margin + 6, margin + 5.5, 22, 14, undefined, 'FAST');
    } catch (e) {
      console.warn('Erro ao inserir logo no PDF do certificado:', e);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(company.name.toUpperCase(), pageWidth / 2, margin + 10, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  const certHeader = company.certificateEmissionSettings?.headerCustomTitle || 'CERTIFICADO DE CONFORMIDADE E ENSAIO DIELÉTRICO DE EPI / EPC';
  doc.text(certHeader, pageWidth / 2, margin + 15, { align: 'center' });
  doc.text(`NR-10 | ${company.creaCompanyRegister} | CNPJ: ${company.cnpj}`, pageWidth / 2, margin + 19, { align: 'center' });

  // Certificate Number
  let y = margin + 28;
  doc.setTextColor(secondaryBlue[0], secondaryBlue[1], secondaryBlue[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`CERTIFICADO Nº: ${test.certificateNumber || test.reportNumber}`, pageWidth / 2, y, { align: 'center' });

  // Main Info Box
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');

  const approvalStatement = company.certificateEmissionSettings?.defaultApprovalText || 
    'Certificamos que o equipamento abaixo discriminado foi submetido a ensaio dielétrico de rotina / periódico em estrita conformidade com as normas técnicas da ABNT, IEC e diretrizes da NR-10:';
  const splitApproval = doc.splitTextToSize(approvalStatement, contentWidth - 20);
  doc.text(splitApproval, margin + 10, y);
  y += (splitApproval.length * 3.8);

  // Equipment Details Card
  y += 5;
  doc.setFillColor(245, 248, 252);
  doc.roundedRect(margin + 8, y, contentWidth - 16, 32, 2, 2, 'F');
  doc.setDrawColor(210, 225, 240);
  doc.roundedRect(margin + 8, y, contentWidth - 16, 32, 2, 2, 'D');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Cliente:`, margin + 12, y + 6);
  doc.text(`Equipamento:`, margin + 12, y + 12);
  doc.text(`Tag / Patrimônio:`, margin + 12, y + 18);
  doc.text(`Norma Aplicável:`, margin + 12, y + 24);

  doc.setFont('helvetica', 'normal');
  doc.text(`${test.clientName}`, margin + 40, y + 6);
  
  let equipDescription = `${formatEquipmentType(test.equipmentType)} (Classe ${test.equipmentClass}) - CA: ${test.equipmentCa || 'N/A'}`;
  if (test.equipmentType === 'luva_isolante') {
    equipDescription = `LUVA ISOLANTE NBR 16295 Cl ${test.equipmentClass} (${test.gloveLength_mm || 360}mm) - CA: ${test.equipmentCa || 'N/A'}`;
  } else if (test.equipmentType === 'manta_isolante' && (test.blanketStyle || test.blanketDimensions)) {
    equipDescription = `MANTA ISOLANTE ASTM D1048 Cl ${test.equipmentClass} ${test.blanketStyle || ''} ${test.blanketDimensions ? `(${test.blanketDimensions})` : ''} - CA: ${test.equipmentCa || 'N/A'}`;
  } else if (test.equipmentType === 'tapete_isolante') {
    const astm = getASTMD178Entry(test.equipmentClass);
    const thickText = test.mattingThickness_mm ? `- ${test.mattingThickness_mm}mm` : (astm ? `- ${astm.espessuraMinima_mm}mm` : '');
    equipDescription = `TAPETE ISOLANTE ASTM D178-22 Cl ${test.equipmentClass} ${test.mattingSurface ? `(${test.mattingSurface})` : ''} ${thickText} - CA: ${test.equipmentCa || 'N/A'}`;
  } else if (test.equipmentType === 'ferramenta_isolada') {
    const approvedTools = test.isolatedTools ? test.isolatedTools.filter(t => (t.result || 'APROVADO') === 'APROVADO' && t.visualInspection !== 'nao_conforme' && t.dielectricResult !== 'nao_conforme') : [];
    const appCount = approvedTools.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
    const toolNamesStr = approvedTools.map(t => formatToolDisplayName(t.toolName, t.toolType)).slice(0, 3).join(', ') + (approvedTools.length > 3 ? '...' : '');
    equipDescription = `FERRAMENTAS ISOLADAS 1000V NBR 9699 (${appCount} peças aprovadas: ${toolNamesStr || 'Conforme'})`;
  }
  doc.text(equipDescription, margin + 40, y + 12);
  doc.text(`${test.equipmentTag} | Nº Série: ${test.equipmentSerial || 'N/A'}`, margin + 40, y + 18);
  const tagNorm = (test.equipmentType === 'luva_isolante' || test.gloveLength_mm) ? 'NBR 16295 Tabela 4' : (test.normCode || 'Norma Técnica');
  doc.text(`${tagNorm} (Tensão de Ensaio: ${test.appliedVoltage_kV} kV ${test.voltageType})`, margin + 40, y + 24);

  // Result Badge & Next Retest Date
  y += 37;
  doc.setFillColor(235, 250, 240);
  doc.setDrawColor(green[0], green[1], green[2]);
  doc.roundedRect(margin + 8, y, 70, 16, 2, 2, 'FD');

  doc.setTextColor(green[0], green[1], green[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const certBadgeStatus = (test.equipmentType === 'ferramenta_isolada' && test.isolatedTools)
    ? `STATUS: APROVADO (${test.isolatedTools.filter(t => (t.result || 'APROVADO') === 'APROVADO' && t.visualInspection !== 'nao_conforme' && t.dielectricResult !== 'nao_conforme').reduce((s, i) => s + (Number(i.quantity) || 1), 0)} PEÇAS)`
    : `STATUS: APROVADO`;
  doc.text(certBadgeStatus, margin + 12, y + 6.5);
  doc.setFontSize(7.5);
  doc.text(`Data do Ensaio: ${formatDateBR(test.testDate)}`, margin + 12, y + 12);

  // Retest Date Box
  doc.setFillColor(255, 248, 235);
  doc.setDrawColor(orange[0], orange[1], orange[2]);
  doc.roundedRect(margin + 82, y, 65, 16, 2, 2, 'FD');

  doc.setTextColor(200, 80, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`PRÓXIMO REENSAIO OBRIGATÓRIO:`, margin + 85, y + 5.5);
  doc.setFontSize(10);
  doc.text(`${formatDateBR(test.retestDueDate)}`, margin + 85, y + 12);

  // QR Code on bottom right
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 35, y - 5, 24, 24);
    doc.setFontSize(5.5);
    doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
    doc.setFont('helvetica', 'bold');
    doc.text('VALIDAR AUTENTICIDADE', pageWidth - margin - 35, y + 21);
    doc.text(test.validationCode, pageWidth - margin - 32, y + 24);
  }

  // Footer signature line
  y += 18;
  const allUsersCert = DielectricStorageService.getUsers();
  const rtUserCert = allUsersCert.find(u => u.id === test.techResponsibleId || u.name === test.techResponsibleName || u.role === 'responsavel_tecnico');
  const rawRTSigCert = test.techResponsibleSignature?.signatureImage || rtUserCert?.signatureUrl || company.technicalResponsible?.signatureUrl || '';
  const cleanedRTSigCert = rawRTSigCert ? await cleanSignatureImage(rawRTSigCert) : '';
  const rtSigCertUrl = cleanedRTSigCert ? await loadImageAsDataUrl(cleanedRTSigCert) : '';

  const certSigLineY = y + 1.5;

  if (rtSigCertUrl) {
    try {
      doc.addImage(rtSigCertUrl, 'PNG', margin + 12, certSigLineY - 8.2, 38, 8.4);
    } catch (e) {
      console.warn('Erro ao inserir assinatura RT no certificado:', e);
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Assinatura Eletrônica Registrada', margin + 31, certSigLineY - 1.5, { align: 'center' });
  }

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.line(margin + 10, certSigLineY, margin + 75, certSigLineY);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.text(`Responsável Técnico: ${test.techResponsibleName} (${test.techResponsibleCrea})`, margin + 10, certSigLineY + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Consulte a autenticidade deste certificado escaneando o QR Code ou em ${ValidationPortalService.buildPublicValidationUrl(test.validationCode)}`, margin + 10, certSigLineY + 7.5);
}

export async function exportCertificadoPDF(test: TestRecord, company: CompanyLabInfo): Promise<void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5' // 210 x 148 mm
  });
  const logoDataUrl = company.logoUrl ? await loadImageAsDataUrl(company.logoUrl) : null;
  await renderCertificadoToDoc(doc, test, company, logoDataUrl, true);
  const filename = generateCertificadoFileName(test);
  await saveDocLocally(doc, filename, `Certificado de Conformidade - ${test.equipmentTag} (${test.certificateNumber || test.reportNumber})`, 'certificado');
}

/**
 * Emite múltiplos laudos técnicos consolidados em um único arquivo PDF
 */
export async function exportMultipleLaudosCombinedPDF(
  tests: TestRecord[], 
  company: CompanyLabInfo,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  if (!tests || tests.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const logoDataUrl = company.logoUrl ? await loadImageAsDataUrl(company.logoUrl) : null;
  const total = tests.length;

  for (let i = 0; i < total; i++) {
    const test = tests[i];
    if (onProgress) {
      onProgress(i + 1, total, `Gerando laudo ${i + 1} de ${total}: ${test.equipmentTag}...`);
    }
    await renderLaudoToDoc(doc, test, company, logoDataUrl, i === 0);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const filename = `Laudos_Dieletricos_Compilado_${tests.length}_itens_${todayStr}.pdf`;
  await saveDocLocally(doc, filename, `Compilado de Laudos Técnicos (${tests.length} itens)`, 'laudo');
}

/**
 * Emite múltiplos certificados de conformidade consolidados em um único arquivo PDF
 */
export async function exportMultipleCertificadosCombinedPDF(
  tests: TestRecord[], 
  company: CompanyLabInfo,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  const approvedTests = tests.filter(t => t.result === 'APROVADO');
  if (approvedTests.length === 0) {
    throw new Error('Nenhum dos ensaios selecionados possui resultado APROVADO para emissão de certificado.');
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5'
  });

  const logoDataUrl = company.logoUrl ? await loadImageAsDataUrl(company.logoUrl) : null;
  const total = approvedTests.length;

  for (let i = 0; i < total; i++) {
    const test = approvedTests[i];
    if (onProgress) {
      onProgress(i + 1, total, `Gerando certificado ${i + 1} de ${total}: ${test.equipmentTag}...`);
    }
    await renderCertificadoToDoc(doc, test, company, logoDataUrl, i === 0);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const filename = `Certificados_Conformidade_Compilado_${approvedTests.length}_itens_${todayStr}.pdf`;
  await saveDocLocally(doc, filename, `Compilado de Certificados (${approvedTests.length} itens)`, 'certificado');
}

/**
 * Baixa múltiplos laudos técnicos como arquivos individuais (.pdf)
 */
export async function exportMultipleLaudosIndividualPDF(
  tests: TestRecord[], 
  company: CompanyLabInfo,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  const total = tests.length;
  for (let i = 0; i < total; i++) {
    const test = tests[i];
    if (onProgress) {
      onProgress(i + 1, total, `Baixando laudo ${i + 1} de ${total}: ${test.reportNumber}...`);
    }
    await exportLaudoPDF(test, company);
    // Intervalo suave para o navegador gerenciar múltiplos downloads sem bloqueio
    await new Promise(res => setTimeout(res, 350));
  }
}

/**
 * Baixa múltiplos certificados como arquivos individuais (.pdf)
 */
export async function exportMultipleCertificadosIndividualPDF(
  tests: TestRecord[], 
  company: CompanyLabInfo,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  const approvedTests = tests.filter(t => t.result === 'APROVADO');
  if (approvedTests.length === 0) {
    throw new Error('Nenhum dos ensaios selecionados possui resultado APROVADO para emissão de certificado.');
  }
  const total = approvedTests.length;
  for (let i = 0; i < total; i++) {
    const test = approvedTests[i];
    if (onProgress) {
      onProgress(i + 1, total, `Baixando certificado ${i + 1} de ${total}: ${test.equipmentTag}...`);
    }
    await exportCertificadoPDF(test, company);
    await new Promise(res => setTimeout(res, 350));
  }
}

/**
 * Emite folha de etiquetas térmicas e adesivas em lote (50x30mm) com QR Code para todos os testes selecionados
 */
export async function exportMultipleEtiquetasPDF(
  tests: TestRecord[],
  company: CompanyLabInfo,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  if (!tests || tests.length === 0) return;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [60, 40] // Formato padrão de etiqueta térmica 60x40mm
  });

  const total = tests.length;

  for (let i = 0; i < total; i++) {
    const test = tests[i];
    if (onProgress) {
      onProgress(i + 1, total, `Gerando etiqueta ${i + 1} de ${total}: ${test.equipmentTag}...`);
    }

    if (i > 0) {
      doc.addPage([60, 40], 'landscape');
    }

    const validationUrl = ValidationPortalService.buildPublicValidationUrl(test.validationCode);
    const qrDataUrl = await generateQRCodeDataUrl(validationUrl);

    // Outer border
    doc.setDrawColor(10, 37, 64);
    doc.setLineWidth(0.4);
    doc.roundedRect(1.5, 1.5, 57, 37, 1.5, 1.5, 'D');

    // Header strip
    doc.setFillColor(10, 37, 64);
    doc.rect(1.5, 1.5, 57, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(company.name.toUpperCase().substring(0, 24), 3, 5.5);

    // Tag & Equipment
    doc.setTextColor(10, 37, 64);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`TAG: ${test.equipmentTag}`, 3, 12);

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${test.equipmentType.toUpperCase().replace('_', ' ')} (CL. ${test.equipmentClass})`, 3, 15.5);
    doc.text(`Cliente: ${test.clientName.substring(0, 22)}`, 3, 19);

    // Status Badge
    const isApp = test.result === 'APROVADO';
    if (isApp) {
      doc.setFillColor(235, 250, 240);
      doc.setDrawColor(0, 140, 60);
      doc.setTextColor(0, 140, 60);
    } else {
      doc.setFillColor(255, 235, 235);
      doc.setDrawColor(220, 40, 40);
      doc.setTextColor(220, 40, 40);
    }
    doc.roundedRect(3, 21.5, 30, 6, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(isApp ? 'STATUS: APROVADO' : 'STATUS: REPROVADO', 5, 25.5);

    // Dates
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.text(`Ensaio: ${formatDateBR(test.testDate)}`, 3, 31);
    doc.setFont('helvetica', 'bold');
    doc.text(`Reensaio: ${formatDateBR(test.retestDueDate)}`, 3, 34.5);
    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Laudo: ${test.reportNumber}`, 3, 37.5);

    // QR Code on right
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', 36, 10, 21, 21);
      doc.setFontSize(4);
      doc.setTextColor(10, 37, 64);
      doc.setFont('helvetica', 'bold');
      doc.text(test.validationCode, 46.5, 33, { align: 'center' });
      doc.text('VALIDAR NR-10', 46.5, 36, { align: 'center' });
    }
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const filename = `Etiquetas_Termicas_Lote_${tests.length}_itens_${todayStr}.pdf`;
  await saveDocLocally(doc, filename, `Lote de Etiquetas Térmicas (${tests.length} itens)`, 'etiqueta');
}
