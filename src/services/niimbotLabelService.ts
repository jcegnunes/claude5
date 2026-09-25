import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { TestRecord, CompanyLabInfo } from '../types';
import { formatDateBR } from '../utils/dateUtils';
import { saveDocLocally } from '../utils/nativeFileSaver';
import { ValidationPortalService } from './validationPortalService';

export type NiimbotRollSize = '50x30' | '50x50' | '50x40' | '40x30' | '50x80';

export interface NiimbotRollConfig {
  id: NiimbotRollSize;
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
  recommendedFor: string;
  dpi: number;
}

export const NIIMBOT_ROLL_CONFIGS: Record<NiimbotRollSize, NiimbotRollConfig> = {
  '50x30': {
    id: '50x30',
    name: '50 x 30 mm (Padrão Niimbot B1)',
    widthMm: 50,
    heightMm: 30,
    description: 'Tamanho padrão e mais utilizado na impressora Niimbot B1.',
    recommendedFor: 'Luvas, Mangas, Capacetes e Ferramental NR-10',
    dpi: 203
  },
  '50x50': {
    id: '50x50',
    name: '50 x 50 mm (Quadrada / QR Code Grande)',
    widthMm: 50,
    heightMm: 50,
    description: 'Etiqueta quadrada com maior área para QR Code e especificações.',
    recommendedFor: 'Tapetes, Mantas e Coberturas Isolantes',
    dpi: 203
  },
  '50x40': {
    id: '50x40',
    name: '50 x 40 mm (Intermediária)',
    widthMm: 50,
    heightMm: 40,
    description: 'Excelente equilíbrio entre detalhes técnicos e rastreabilidade.',
    recommendedFor: 'Varas de Manobra e Conjuntos de Aterramento',
    dpi: 203
  },
  '40x30': {
    id: '40x30',
    name: '40 x 30 mm (Compacta)',
    widthMm: 40,
    heightMm: 30,
    description: 'Formato compacto para ferramentas menores e alicates isolados.',
    recommendedFor: 'Alicates, Chaves Isoladas e Ferramentas 1000V',
    dpi: 203
  },
  '50x80': {
    id: '50x80',
    name: '50 x 80 mm (Estendida / Envoltória)',
    widthMm: 50,
    heightMm: 80,
    description: 'Formato longo ideal para envelopamento de bastões e cabos.',
    recommendedFor: 'Bastões Telescópicos, Varas e Cabos de Aterramento',
    dpi: 203
  }
};

/**
 * Gera QR Code em base64 com alto contraste (Preto puro sobre Branco)
 */
export async function generateNiimbotQRCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error('Erro ao gerar QR Code para Niimbot:', err);
    return '';
  }
}

/**
 * Renderiza uma etiqueta Niimbot B1 em um elemento HTMLCanvasElement de alta resolução (203 DPI / 2x Supersampled)
 */
export async function renderNiimbotLabelToCanvas(
  test: TestRecord,
  company: CompanyLabInfo,
  rollSize: NiimbotRollSize = '50x30'
): Promise<HTMLCanvasElement> {
  const config = NIIMBOT_ROLL_CONFIGS[rollSize] || NIIMBOT_ROLL_CONFIGS['50x30'];
  
  // Scale factor for supersampling (2x for ultra sharp text rendering)
  const scale = 3;
  const dotsPerMm = (config.dpi / 25.4); // ~8 dots/mm for 203 DPI
  const widthPx = Math.round(config.widthMm * dotsPerMm * scale);
  const heightPx = Math.round(config.heightMm * dotsPerMm * scale);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas');

  // Background - Pure White
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Outer border with 0.8mm margin
  const marginPx = Math.round(1 * dotsPerMm * scale);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.round(0.4 * dotsPerMm * scale);
  ctx.strokeRect(marginPx, marginPx, widthPx - marginPx * 2, heightPx - marginPx * 2);

  const validationUrl = ValidationPortalService.buildPublicValidationUrl(test.validationCode);
  const qrDataUrl = await generateNiimbotQRCodeDataUrl(validationUrl);

  const isApproved = test.result === 'APROVADO';

  if (rollSize === '50x30') {
    // 50x30mm Layout (Standard Niimbot B1)
    render50x30Layout(ctx, test, company, widthPx, heightPx, marginPx, scale, dotsPerMm, qrDataUrl, isApproved);
  } else if (rollSize === '50x50') {
    // 50x50mm Square Layout
    render50x50Layout(ctx, test, company, widthPx, heightPx, marginPx, scale, dotsPerMm, qrDataUrl, isApproved);
  } else if (rollSize === '50x40') {
    // 50x40mm Layout
    render50x40Layout(ctx, test, company, widthPx, heightPx, marginPx, scale, dotsPerMm, qrDataUrl, isApproved);
  } else if (rollSize === '40x30') {
    // 40x30mm Compact Layout
    render40x30Layout(ctx, test, company, widthPx, heightPx, marginPx, scale, dotsPerMm, qrDataUrl, isApproved);
  } else {
    // 50x80mm Extended Layout
    render50x80Layout(ctx, test, company, widthPx, heightPx, marginPx, scale, dotsPerMm, qrDataUrl, isApproved);
  }

  return canvas;
}

// -----------------------------------------------------------------------------
// LAYOUT 50 x 30 mm (Standard Niimbot B1)
// -----------------------------------------------------------------------------
function render50x30Layout(
  ctx: CanvasRenderingContext2D,
  test: TestRecord,
  company: CompanyLabInfo,
  w: number,
  h: number,
  m: number,
  s: number,
  d: number,
  qrDataUrl: string,
  isApproved: boolean
) {
  // Top Header Banner (Pure Black)
  const headerHeight = Math.round(5.5 * d * s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(m, m, w - m * 2, headerHeight);

  // Header Text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(2.6 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const companyTitle = (company.name || 'JVM ENGENHARIA').toUpperCase();
  ctx.fillText(companyTitle.length > 20 ? companyTitle.substring(0, 20) + '...' : companyTitle, m + 2 * s * d, m + headerHeight / 2);

  ctx.textAlign = 'right';
  ctx.font = `bold ${Math.round(2.2 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('NR-10', w - m - 2 * s * d, m + headerHeight / 2);

  // Left Content Area
  const leftX = m + 2 * s * d;
  let curY = m + headerHeight + 2.5 * s * d;

  // TAG (High visibility)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(3.6 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`TAG: ${test.equipmentTag}`, leftX, curY);

  curY += 4.0 * s * d;

  // Equipment Type & Class
  ctx.font = `bold ${Math.round(2.2 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  const eqDesc = `${test.equipmentType.replace(/_/g, ' ')} (CL. ${test.equipmentClass})`.toUpperCase();
  ctx.fillText(eqDesc.length > 26 ? eqDesc.substring(0, 26) : eqDesc, leftX, curY);

  curY += 3.0 * s * d;

  // Client / User
  ctx.font = `normal ${Math.round(2.0 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  const clientStr = `Cli: ${test.clientName}`.toUpperCase();
  ctx.fillText(clientStr.length > 28 ? clientStr.substring(0, 28) : clientStr, leftX, curY);

  curY += 3.2 * s * d;

  // Status Badge (Black filled for APROVADO, Double Border for REPROVADO)
  const badgeW = 27 * s * d;
  const badgeH = 4.2 * s * d;
  if (isApproved) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(leftX, curY, badgeW, badgeH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(2.4 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('STATUS: APROVADO', leftX + badgeW / 2, curY + 0.8 * s * d);
  } else {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.2 * s;
    ctx.strokeRect(leftX, curY, badgeW, badgeH);
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(2.3 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('STATUS: REPROVADO', leftX + badgeW / 2, curY + 0.8 * s * d);
  }

  curY += 5.2 * s * d;

  // Dates & Technical Info
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';
  ctx.font = `normal ${Math.round(1.9 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Ensaio: ${formatDateBR(test.testDate)} (${test.appliedVoltage_kV}kV)`, leftX, curY);

  curY += 2.6 * s * d;

  // Retest Expiration (High emphasis)
  ctx.font = `bold ${Math.round(2.3 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`VALIDADE: ${formatDateBR(test.retestDueDate)}`, leftX, curY);

  // QR Code on the Right
  const qrSize = Math.round(15.5 * d * s);
  const qrX = w - m - qrSize - 1.5 * s * d;
  const qrY = m + headerHeight + 1.2 * s * d;

  if (qrDataUrl) {
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  // QR Code Sub-text
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(1.8 * d * s)}px "Courier New", monospace`;
  ctx.fillText(test.validationCode, qrX + qrSize / 2, qrY + qrSize + 0.8 * s * d);

  ctx.font = `bold ${Math.round(1.5 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('VALIDAR NR-10', qrX + qrSize / 2, qrY + qrSize + 2.8 * s * d);
}

// -----------------------------------------------------------------------------
// LAYOUT 50 x 50 mm (Square)
// -----------------------------------------------------------------------------
function render50x50Layout(
  ctx: CanvasRenderingContext2D,
  test: TestRecord,
  company: CompanyLabInfo,
  w: number,
  h: number,
  m: number,
  s: number,
  d: number,
  qrDataUrl: string,
  isApproved: boolean
) {
  // Top Header Banner
  const headerHeight = Math.round(6.5 * d * s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(m, m, w - m * 2, headerHeight);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(2.8 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText((company.name || 'JVM ENGENHARIA').toUpperCase(), m + 2 * s * d, m + headerHeight / 2);

  ctx.textAlign = 'right';
  ctx.font = `bold ${Math.round(2.3 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('LAUDO NR-10', w - m - 2 * s * d, m + headerHeight / 2);

  // TAG & Basic Info
  let curY = m + headerHeight + 3 * s * d;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(4.0 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`TAG: ${test.equipmentTag}`, m + 2.5 * s * d, curY);

  curY += 4.5 * s * d;
  ctx.font = `bold ${Math.round(2.4 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`${test.equipmentType.replace(/_/g, ' ')} • CLASSE ${test.equipmentClass}`.toUpperCase(), m + 2.5 * s * d, curY);

  curY += 3.2 * s * d;
  ctx.font = `normal ${Math.round(2.2 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Cliente: ${test.clientName}`, m + 2.5 * s * d, curY);

  // Center QR Code
  const qrSize = Math.round(19 * d * s);
  const qrX = (w - qrSize) / 2;
  curY += 4.0 * s * d;

  if (qrDataUrl) {
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    ctx.drawImage(qrImg, qrX, curY, qrSize, qrSize);
  }

  curY += qrSize + 1.5 * s * d;

  // Status and Dates
  const badgeW = 34 * s * d;
  const badgeH = 4.8 * s * d;
  const badgeX = (w - badgeW) / 2;
  if (isApproved) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(badgeX, curY, badgeW, badgeH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(2.6 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('STATUS: APROVADO', w / 2, curY + 1.0 * s * d);
  } else {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * s;
    ctx.strokeRect(badgeX, curY, badgeW, badgeH);
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(2.6 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('STATUS: REPROVADO', w / 2, curY + 1.0 * s * d);
  }

  curY += 6.2 * s * d;
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(2.4 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Ensaio: ${formatDateBR(test.testDate)}  |  VALIDADE: ${formatDateBR(test.retestDueDate)}`, w / 2, curY);

  curY += 3.0 * s * d;
  ctx.font = `normal ${Math.round(1.8 * d * s)}px "Courier New", monospace`;
  ctx.fillText(`Laudo: ${test.reportNumber} • Cód: ${test.validationCode}`, w / 2, curY);
}

// -----------------------------------------------------------------------------
// LAYOUT 50 x 40 mm
// -----------------------------------------------------------------------------
function render50x40Layout(
  ctx: CanvasRenderingContext2D,
  test: TestRecord,
  company: CompanyLabInfo,
  w: number,
  h: number,
  m: number,
  s: number,
  d: number,
  qrDataUrl: string,
  isApproved: boolean
) {
  // Header
  const headerHeight = Math.round(6 * d * s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(m, m, w - m * 2, headerHeight);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(2.6 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText((company.name || 'JVM ENGENHARIA').toUpperCase(), m + 2 * s * d, m + headerHeight / 2);

  ctx.textAlign = 'right';
  ctx.font = `bold ${Math.round(2.2 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('ENSAIO NR-10', w - m - 2 * s * d, m + headerHeight / 2);

  const leftX = m + 2 * s * d;
  let curY = m + headerHeight + 2.5 * s * d;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(3.8 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`TAG: ${test.equipmentTag}`, leftX, curY);

  curY += 4.2 * s * d;
  ctx.font = `bold ${Math.round(2.2 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`${test.equipmentType.replace(/_/g, ' ')} (CLASSE ${test.equipmentClass})`.toUpperCase(), leftX, curY);

  curY += 3.0 * s * d;
  ctx.font = `normal ${Math.round(2.0 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Cliente: ${test.clientName}`, leftX, curY);

  curY += 3.0 * s * d;
  ctx.fillText(`Tensão: ${test.appliedVoltage_kV} kV ${test.voltageType} • Fuga: ${test.measuredLeakageCurrent_mA}mA`, leftX, curY);

  curY += 3.6 * s * d;
  // Status Badge
  const badgeW = 28 * s * d;
  const badgeH = 4.5 * s * d;
  if (isApproved) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(leftX, curY, badgeW, badgeH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(2.4 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('STATUS: APROVADO', leftX + badgeW / 2, curY + 0.9 * s * d);
  } else {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.2 * s;
    ctx.strokeRect(leftX, curY, badgeW, badgeH);
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(2.4 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('STATUS: REPROVADO', leftX + badgeW / 2, curY + 0.9 * s * d);
  }

  curY += 5.5 * s * d;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';
  ctx.font = `normal ${Math.round(2.0 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Data Ensaio: ${formatDateBR(test.testDate)}`, leftX, curY);

  curY += 2.8 * s * d;
  ctx.font = `bold ${Math.round(2.4 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`VALIDADE: ${formatDateBR(test.retestDueDate)}`, leftX, curY);

  curY += 2.8 * s * d;
  ctx.font = `normal ${Math.round(1.8 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Laudo: ${test.reportNumber}`, leftX, curY);

  // QR Code on the Right
  const qrSize = Math.round(17.5 * d * s);
  const qrX = w - m - qrSize - 1.5 * s * d;
  const qrY = m + headerHeight + 3.0 * s * d;

  if (qrDataUrl) {
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(1.9 * d * s)}px "Courier New", monospace`;
  ctx.fillText(test.validationCode, qrX + qrSize / 2, qrY + qrSize + 1.0 * s * d);

  ctx.font = `bold ${Math.round(1.6 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('VALIDAR NR-10', qrX + qrSize / 2, qrY + qrSize + 3.2 * s * d);
}

// -----------------------------------------------------------------------------
// LAYOUT 40 x 30 mm (Compact)
// -----------------------------------------------------------------------------
function render40x30Layout(
  ctx: CanvasRenderingContext2D,
  test: TestRecord,
  company: CompanyLabInfo,
  w: number,
  h: number,
  m: number,
  s: number,
  d: number,
  qrDataUrl: string,
  isApproved: boolean
) {
  // Top Header
  const headerHeight = Math.round(5 * d * s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(m, m, w - m * 2, headerHeight);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(2.3 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('JVM ENGENHARIA • NR-10', w / 2, m + headerHeight / 2);

  const leftX = m + 1.5 * s * d;
  let curY = m + headerHeight + 2.0 * s * d;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(3.0 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`TAG: ${test.equipmentTag}`, leftX, curY);

  curY += 3.5 * s * d;
  ctx.font = `bold ${Math.round(1.9 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`CLASSE ${test.equipmentClass} • ${test.appliedVoltage_kV}kV`, leftX, curY);

  curY += 2.8 * s * d;
  const badgeW = 20 * s * d;
  const badgeH = 3.6 * s * d;
  if (isApproved) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(leftX, curY, badgeW, badgeH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(2.0 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('APROVADO', leftX + badgeW / 2, curY + 0.6 * s * d);
  } else {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.0 * s;
    ctx.strokeRect(leftX, curY, badgeW, badgeH);
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(2.0 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('REPROVADO', leftX + badgeW / 2, curY + 0.6 * s * d);
  }

  curY += 4.5 * s * d;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';
  ctx.font = `normal ${Math.round(1.7 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Ensaio: ${formatDateBR(test.testDate)}`, leftX, curY);

  curY += 2.4 * s * d;
  ctx.font = `bold ${Math.round(2.0 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`VAL: ${formatDateBR(test.retestDueDate)}`, leftX, curY);

  // QR Code on right
  const qrSize = Math.round(13 * d * s);
  const qrX = w - m - qrSize - 1.2 * s * d;
  const qrY = m + headerHeight + 1.5 * s * d;

  if (qrDataUrl) {
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(1.5 * d * s)}px "Courier New", monospace`;
  ctx.fillText(test.validationCode, qrX + qrSize / 2, qrY + qrSize + 0.8 * s * d);
}

// -----------------------------------------------------------------------------
// LAYOUT 50 x 80 mm (Extended Wrap)
// -----------------------------------------------------------------------------
function render50x80Layout(
  ctx: CanvasRenderingContext2D,
  test: TestRecord,
  company: CompanyLabInfo,
  w: number,
  h: number,
  m: number,
  s: number,
  d: number,
  qrDataUrl: string,
  isApproved: boolean
) {
  // Top Header
  const headerHeight = Math.round(8 * d * s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(m, m, w - m * 2, headerHeight);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(3.0 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(company.name.toUpperCase(), w / 2, m + headerHeight / 2);

  let curY = m + headerHeight + 4 * s * d;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(4.4 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`TAG: ${test.equipmentTag}`, w / 2, curY);

  curY += 5.5 * s * d;
  ctx.font = `bold ${Math.round(2.6 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`${test.equipmentType.replace(/_/g, ' ')}`.toUpperCase(), w / 2, curY);

  curY += 3.5 * s * d;
  ctx.font = `bold ${Math.round(2.2 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`CLASSE ${test.equipmentClass} • TENSÃO: ${test.appliedVoltage_kV} kV`, w / 2, curY);

  curY += 3.5 * s * d;
  ctx.font = `normal ${Math.round(2.0 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Cliente: ${test.clientName}`, w / 2, curY);

  // Center Big QR
  const qrSize = Math.round(22 * d * s);
  const qrX = (w - qrSize) / 2;
  curY += 4.5 * s * d;

  if (qrDataUrl) {
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    ctx.drawImage(qrImg, qrX, curY, qrSize, qrSize);
  }

  curY += qrSize + 2 * s * d;
  ctx.font = `bold ${Math.round(2.2 * d * s)}px "Courier New", monospace`;
  ctx.fillText(test.validationCode, w / 2, curY);

  curY += 4.5 * s * d;
  const badgeW = 36 * s * d;
  const badgeH = 5.5 * s * d;
  const badgeX = (w - badgeW) / 2;
  if (isApproved) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(badgeX, curY, badgeW, badgeH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(2.8 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText('STATUS: APROVADO', w / 2, curY + 1.2 * s * d);
  } else {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5 * s;
    ctx.strokeRect(badgeX, curY, badgeW, badgeH);
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(2.8 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText('STATUS: REPROVADO', w / 2, curY + 1.2 * s * d);
  }

  curY += 8.0 * s * d;
  ctx.fillStyle = '#000000';
  ctx.font = `normal ${Math.round(2.2 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Data do Ensaio: ${formatDateBR(test.testDate)}`, w / 2, curY);

  curY += 3.5 * s * d;
  ctx.font = `bold ${Math.round(2.6 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`VALIDADE: ${formatDateBR(test.retestDueDate)}`, w / 2, curY);

  curY += 3.5 * s * d;
  ctx.font = `normal ${Math.round(1.8 * d * s)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(`Laudo: ${test.reportNumber}`, w / 2, curY);
}

/**
 * Baixa etiqueta individual como imagem PNG de alta resolução 203 DPI
 */
export async function exportNiimbotPNG(
  test: TestRecord,
  company: CompanyLabInfo,
  rollSize: NiimbotRollSize = '50x30'
): Promise<void> {
  const canvas = await renderNiimbotLabelToCanvas(test, company, rollSize);
  const dataUrl = canvas.toDataURL('image/png');
  
  const link = document.createElement('a');
  link.download = `Etiqueta_Niimbot_${rollSize}_${test.equipmentTag}_${test.reportNumber}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Baixa arquivo ZIP contendo todas as etiquetas em PNG (1:1 203 DPI) para importação em lote no software Niimbot
 */
export async function exportNiimbotBatchZIP(
  tests: TestRecord[],
  company: CompanyLabInfo,
  rollSize: NiimbotRollSize = '50x30',
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  if (!tests || tests.length === 0) return;

  const zip = new JSZip();
  const folder = zip.folder(`Etiquetas_Niimbot_${rollSize}`);
  const total = tests.length;

  for (let i = 0; i < total; i++) {
    const test = tests[i];
    if (onProgress) {
      onProgress(i + 1, total, `Renderizando etiqueta ${i + 1} de ${total}: ${test.equipmentTag}...`);
    }

    const canvas = await renderNiimbotLabelToCanvas(test, company, rollSize);
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    
    folder?.file(`Etiqueta_${i + 1}_${test.equipmentTag}_${test.reportNumber}.png`, base64Data, { base64: true });
  }

  // Also include CSV in the zip for easy Niimbot Excel import
  const csvContent = generateNiimbotCSVContent(tests, company);
  zip.file(`Dados_Lote_Niimbot_${tests.length}_itens.csv`, '\uFEFF' + csvContent);

  // Also include JCPS project template
  try {
    const jcpsProject = await buildNiimbotJCPSObject(tests, company, rollSize);
    zip.file(`Projeto_Niimbot_${rollSize}_${tests.length}_itens.jcps`, JSON.stringify(jcpsProject, null, 2));
  } catch (err) {
    console.warn('Erro ao embutir JCPS no ZIP:', err);
  }

  if (onProgress) {
    onProgress(total, total, 'Compactando arquivo ZIP...');
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const todayStr = new Date().toISOString().split('T')[0];
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Etiquetas_Niimbot_B1_${rollSize}_${tests.length}_itens_${todayStr}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gera arquivo CSV compatível com o módulo de impressão em lote / Excel do software NIIMBOT
 */
export function generateNiimbotCSVContent(tests: TestRecord[], company: CompanyLabInfo): string {
  const headers = [
    'TAG',
    'NUM_LAUDO',
    'NUM_CERTIFICADO',
    'CLIENTE',
    'COLABORADOR',
    'EQUIPAMENTO',
    'CLASSE',
    'TENSAO_KV',
    'CORRENTE_MA',
    'DATA_ENSAIO',
    'VALIDADE_REENSAIO',
    'STATUS',
    'ANALISTA_EXECUTOR',
    'RESPONSAVEL_TECNICO',
    'CREA_RT',
    'CODIGO_VALIDACAO',
    'URL_VALIDACAO_QR'
  ];

  const rows = tests.map(t => [
    `"${t.equipmentTag}"`,
    `"${t.reportNumber}"`,
    `"${t.certificateNumber || 'N/A'}"`,
    `"${t.clientName.replace(/"/g, '""')}"`,
    `"${(t.collaboratorName || '').replace(/"/g, '""')}"`,
    `"${t.equipmentType.replace(/_/g, ' ').toUpperCase()}"`,
    `"${t.equipmentClass}"`,
    `"${t.appliedVoltage_kV} kV"`,
    `"${t.measuredLeakageCurrent_mA} ${t.currentUnit}"`,
    `"${formatDateBR(t.testDate)}"`,
    `"${formatDateBR(t.retestDueDate)}"`,
    `"${t.result}"`,
    `"${t.technicianName.replace(/"/g, '""')}"`,
    `"${(t.techResponsibleName || company.technicalResponsible?.name || '').replace(/"/g, '""')}"`,
    `"${t.techResponsibleCrea || company.technicalResponsible?.creaNumber || ''}"`,
    `"${t.validationCode}"`,
    `"${ValidationPortalService.buildPublicValidationUrl(t.validationCode)}"`
  ]);

  return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
}

/**
 * Interface dos elementos para o formato de projeto .JCPS (Jingchen Print Schema / Niimbot Project)
 */
export interface NiimbotJCPSElement {
  id: string;
  type: 'text' | 'qrcode' | 'barcode' | 'line' | 'rect' | 'image';
  x: number; // mm
  y: number; // mm
  width: number; // mm
  height: number; // mm
  content?: string;
  variableBinding?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'bold' | 'normal';
  textAlign?: 'left' | 'center' | 'right';
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  rotation?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  base64Image?: string;
}

export interface NiimbotJCPSProject {
  schema: string;
  app: string;
  version: string;
  createdAt: string;
  generator: string;
  device: {
    brand: string;
    model: string;
    dpi: number;
    printType: string;
    connection: string;
  };
  paper: {
    name: string;
    width: number;
    height: number;
    unit: 'mm';
    orientation: 'landscape' | 'portrait';
    type: string;
    margin: number;
  };
  canvas: {
    widthPx: number;
    heightPx: number;
    dpi: number;
    scale: number;
    backgroundColor: string;
  };
  metadata: {
    title: string;
    standard: string;
    client: string;
    tag: string;
    reportNumber: string;
    certificateNumber?: string;
    generatedAt: string;
  };
  template: {
    id: string;
    title: string;
    elements: NiimbotJCPSElement[];
  };
  preview?: string;
  dataSource?: {
    columns: string[];
    records: Record<string, string>[];
  };
  pages?: Array<{
    pageIndex: number;
    testId: string;
    reportNumber: string;
    tag: string;
    preview?: string;
    data: Record<string, string>;
  }>;
}

/**
 * Constrói o objeto de projeto .JCPS estruturado para um ou múltiplos ensaios
 */
export async function buildNiimbotJCPSObject(
  tests: TestRecord[],
  company: CompanyLabInfo,
  rollSize: NiimbotRollSize = '50x30'
): Promise<NiimbotJCPSProject> {
  const config = NIIMBOT_ROLL_CONFIGS[rollSize] || NIIMBOT_ROLL_CONFIGS['50x30'];
  const firstTest = tests[0];
  const isApproved = firstTest.result === 'APROVADO';
  const validationUrl = ValidationPortalService.buildPublicValidationUrl(firstTest.validationCode);

  // Render thumbnail for preview
  let previewDataUrl = '';
  try {
    const canvas = await renderNiimbotLabelToCanvas(firstTest, company, rollSize);
    previewDataUrl = canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('Não foi possível gerar preview para JCPS:', err);
  }

  // Define layout elements in mm based on roll size
  const elements: NiimbotJCPSElement[] = [
    // Header Banner Background
    {
      id: 'elem_header_bg',
      type: 'rect',
      x: 1.0,
      y: 1.0,
      width: config.widthMm - 2.0,
      height: 5.5,
      backgroundColor: '#000000'
    },
    // Header Company Title
    {
      id: 'elem_header_title',
      type: 'text',
      x: 2.0,
      y: 2.0,
      width: config.widthMm - 16.0,
      height: 4.0,
      content: (company.name || 'JVM ENGENHARIA').toUpperCase(),
      fontSize: 8,
      fontWeight: 'bold',
      textAlign: 'left',
      textColor: '#FFFFFF'
    },
    // Header Standard Tag
    {
      id: 'elem_header_norm',
      type: 'text',
      x: config.widthMm - 14.0,
      y: 2.0,
      width: 12.0,
      height: 4.0,
      content: 'NR-10',
      fontSize: 8,
      fontWeight: 'bold',
      textAlign: 'right',
      textColor: '#FFFFFF'
    },
    // TAG Field
    {
      id: 'elem_tag',
      type: 'text',
      x: 2.0,
      y: 7.5,
      width: config.widthMm - 20.0,
      height: 4.5,
      content: `TAG: ${firstTest.equipmentTag}`,
      variableBinding: '{TAG}',
      fontSize: 10,
      fontWeight: 'bold',
      textAlign: 'left',
      textColor: '#000000'
    },
    // Equipment & Class Field
    {
      id: 'elem_equipment',
      type: 'text',
      x: 2.0,
      y: 12.0,
      width: config.widthMm - 20.0,
      height: 3.5,
      content: `${firstTest.equipmentType.replace(/_/g, ' ')} (CL. ${firstTest.equipmentClass})`.toUpperCase(),
      variableBinding: '{EQUIPAMENTO}',
      fontSize: 7,
      fontWeight: 'bold',
      textAlign: 'left',
      textColor: '#000000'
    },
    // Client Field
    {
      id: 'elem_client',
      type: 'text',
      x: 2.0,
      y: 15.5,
      width: config.widthMm - 20.0,
      height: 3.2,
      content: `Cli: ${firstTest.clientName}`.toUpperCase(),
      variableBinding: '{CLIENTE}',
      fontSize: 6.5,
      fontWeight: 'normal',
      textAlign: 'left',
      textColor: '#000000'
    },
    // Status Badge
    {
      id: 'elem_status_badge',
      type: 'rect',
      x: 2.0,
      y: 19.0,
      width: 26.0,
      height: 4.2,
      backgroundColor: isApproved ? '#000000' : '#FFFFFF',
      borderColor: '#000000',
      borderWidth: isApproved ? 0 : 1
    },
    {
      id: 'elem_status_text',
      type: 'text',
      x: 2.0,
      y: 19.8,
      width: 26.0,
      height: 3.2,
      content: `STATUS: ${firstTest.result}`,
      variableBinding: '{STATUS}',
      fontSize: 7.5,
      fontWeight: 'bold',
      textAlign: 'center',
      textColor: isApproved ? '#FFFFFF' : '#000000'
    },
    // Test Date & Voltage
    {
      id: 'elem_test_date',
      type: 'text',
      x: 2.0,
      y: 24.2,
      width: config.widthMm - 20.0,
      height: 2.8,
      content: `Ensaio: ${formatDateBR(firstTest.testDate)} (${firstTest.appliedVoltage_kV}kV)`,
      variableBinding: '{DATA_ENSAIO}',
      fontSize: 6,
      fontWeight: 'normal',
      textAlign: 'left',
      textColor: '#000000'
    },
    // Retest Due Date (Validade)
    {
      id: 'elem_retest_date',
      type: 'text',
      x: 2.0,
      y: 27.0,
      width: config.widthMm - 20.0,
      height: 3.0,
      content: `VALIDADE: ${formatDateBR(firstTest.retestDueDate)}`,
      variableBinding: '{VALIDADE_REENSAIO}',
      fontSize: 7.5,
      fontWeight: 'bold',
      textAlign: 'left',
      textColor: '#000000'
    },
    // QR Code
    {
      id: 'elem_qrcode',
      type: 'qrcode',
      x: config.widthMm - 17.5,
      y: 7.5,
      width: 16.0,
      height: 16.0,
      content: validationUrl,
      variableBinding: '{URL_VALIDACAO_QR}',
      errorCorrectionLevel: 'M'
    },
    // Validation Code Sub-text
    {
      id: 'elem_val_code',
      type: 'text',
      x: config.widthMm - 17.5,
      y: 24.0,
      width: 16.0,
      height: 2.5,
      content: `Cod: ${firstTest.validationCode.substring(0, 10)}`,
      variableBinding: '{CODIGO_VALIDACAO}',
      fontSize: 5,
      fontWeight: 'bold',
      textAlign: 'center',
      textColor: '#000000'
    },
    // Report Number Sub-text
    {
      id: 'elem_report_sub',
      type: 'text',
      x: config.widthMm - 17.5,
      y: 26.8,
      width: 16.0,
      height: 2.5,
      content: `L: ${firstTest.reportNumber}`,
      variableBinding: '{NUM_LAUDO}',
      fontSize: 5,
      fontWeight: 'normal',
      textAlign: 'center',
      textColor: '#000000'
    }
  ];

  // Records data source table
  const columns = [
    'TAG',
    'NUM_LAUDO',
    'NUM_CERTIFICADO',
    'CLIENTE',
    'COLABORADOR',
    'EQUIPAMENTO',
    'CLASSE',
    'TENSAO_KV',
    'CORRENTE_MA',
    'DATA_ENSAIO',
    'VALIDADE_REENSAIO',
    'STATUS',
    'ANALISTA_EXECUTOR',
    'RESPONSAVEL_TECNICO',
    'CREA_RT',
    'CODIGO_VALIDACAO',
    'URL_VALIDACAO_QR'
  ];

  const records = tests.map(t => ({
    TAG: t.equipmentTag,
    NUM_LAUDO: t.reportNumber,
    NUM_CERTIFICADO: t.certificateNumber || 'N/A',
    CLIENTE: t.clientName,
    COLABORADOR: t.collaboratorName || '',
    EQUIPAMENTO: `${t.equipmentType.replace(/_/g, ' ').toUpperCase()} (CL. ${t.equipmentClass})`,
    CLASSE: t.equipmentClass,
    TENSAO_KV: `${t.appliedVoltage_kV} kV`,
    CORRENTE_MA: `${t.measuredLeakageCurrent_mA} ${t.currentUnit}`,
    DATA_ENSAIO: formatDateBR(t.testDate),
    VALIDADE_REENSAIO: formatDateBR(t.retestDueDate),
    STATUS: t.result,
    ANALISTA_EXECUTOR: t.technicianName,
    RESPONSAVEL_TECNICO: t.techResponsibleName || company.technicalResponsible?.name || '',
    CREA_RT: t.techResponsibleCrea || company.technicalResponsible?.creaNumber || '',
    CODIGO_VALIDACAO: t.validationCode,
    URL_VALIDACAO_QR: ValidationPortalService.buildPublicValidationUrl(t.validationCode)
  }));

  const pages = tests.map((t, idx) => ({
    pageIndex: idx + 1,
    testId: t.id,
    reportNumber: t.reportNumber,
    tag: t.equipmentTag,
    preview: idx === 0 ? previewDataUrl : undefined,
    data: records[idx]
  }));

  return {
    schema: 'https://niimbot.com/schema/label_project_v2.json',
    app: 'NIIMBOT',
    version: '2.1.0',
    createdAt: new Date().toISOString(),
    generator: 'JVM DielectricLab NR-10 Enterprise System',
    device: {
      brand: 'NIIMBOT',
      model: 'B1',
      dpi: config.dpi || 203,
      printType: 'thermal',
      connection: 'bluetooth_usb'
    },
    paper: {
      name: config.name,
      width: config.widthMm,
      height: config.heightMm,
      unit: 'mm',
      orientation: config.widthMm >= config.heightMm ? 'landscape' : 'portrait',
      type: 'gap',
      margin: 1.0
    },
    canvas: {
      widthPx: Math.round(config.widthMm * 8),
      heightPx: Math.round(config.heightMm * 8),
      dpi: config.dpi || 203,
      scale: 1.0,
      backgroundColor: '#ffffff'
    },
    metadata: {
      title: `Etiqueta Ensaio Dielétrico - ${firstTest.equipmentTag}`,
      standard: 'NR-10 / ABNT NBR',
      client: firstTest.clientName,
      tag: firstTest.equipmentTag,
      reportNumber: firstTest.reportNumber,
      certificateNumber: firstTest.certificateNumber,
      generatedAt: new Date().toISOString()
    },
    template: {
      id: `tmpl_jvm_${rollSize}`,
      title: `Modelo JVM ${config.widthMm}x${config.heightMm}mm`,
      elements
    },
    preview: previewDataUrl,
    dataSource: {
      columns,
      records
    },
    pages
  };
}

/**
 * Exporta arquivo individual de projeto no formato .JCPS (Jingchen Print Schema) para o software Niimbot
 */
export async function exportNiimbotJCPS(
  test: TestRecord,
  company: CompanyLabInfo,
  rollSize: NiimbotRollSize = '50x30'
): Promise<void> {
  const jcpsProject = await buildNiimbotJCPSObject([test], company, rollSize);
  const jsonStr = JSON.stringify(jcpsProject, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Etiqueta_Niimbot_${rollSize}_${test.equipmentTag}_${test.reportNumber}.jcps`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta projeto em lote de todas as etiquetas selecionadas no formato .JCPS
 */
export async function exportNiimbotBatchJCPS(
  tests: TestRecord[],
  company: CompanyLabInfo,
  rollSize: NiimbotRollSize = '50x30',
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  if (!tests || tests.length === 0) return;

  if (onProgress) {
    onProgress(1, 2, 'Estruturando projeto JCPS para Niimbot...');
  }

  const jcpsProject = await buildNiimbotJCPSObject(tests, company, rollSize);
  
  if (onProgress) {
    onProgress(2, 2, 'Gerando arquivo .jcps...');
  }

  const jsonStr = JSON.stringify(jcpsProject, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const todayStr = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `Projeto_Etiquetas_Niimbot_Lote_${rollSize}_${tests.length}_itens_${todayStr}.jcps`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Baixa o arquivo CSV pronto para ser carregado no software Niimbot PC / App
 */
export function exportNiimbotCSV(tests: TestRecord[], company: CompanyLabInfo): void {
  const csv = generateNiimbotCSVContent(tests, company);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const todayStr = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `Planilha_Lote_Niimbot_B1_${tests.length}_itens_${todayStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta documento PDF com dimensões milimétricas exatas (1:1) para a impressora Niimbot B1
 */
export async function exportNiimbotPDF(
  tests: TestRecord[],
  company: CompanyLabInfo,
  rollSize: NiimbotRollSize = '50x30',
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  if (!tests || tests.length === 0) return;

  const config = NIIMBOT_ROLL_CONFIGS[rollSize] || NIIMBOT_ROLL_CONFIGS['50x30'];
  const doc = new jsPDF({
    orientation: config.widthMm >= config.heightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [config.widthMm, config.heightMm]
  });

  const total = tests.length;

  for (let i = 0; i < total; i++) {
    const test = tests[i];
    if (onProgress) {
      onProgress(i + 1, total, `Gerando página PDF ${i + 1} de ${total}: ${test.equipmentTag}...`);
    }

    if (i > 0) {
      doc.addPage([config.widthMm, config.heightMm], config.widthMm >= config.heightMm ? 'landscape' : 'portrait');
    }

    const canvas = await renderNiimbotLabelToCanvas(test, company, rollSize);
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, config.widthMm, config.heightMm);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const fileName = `Etiquetas_Niimbot_B1_${rollSize}_${tests.length}_itens_${todayStr}.pdf`;
  await saveDocLocally(doc, fileName, `Etiquetas Niimbot B1 (${rollSize} - ${tests.length} itens)`, 'etiqueta');
}

/**
 * Impressão Direta no Navegador com layout térmico @page milimétrico
 */
export async function printNiimbotDirect(
  tests: TestRecord[],
  company: CompanyLabInfo,
  rollSize: NiimbotRollSize = '50x30'
): Promise<void> {
  const config = NIIMBOT_ROLL_CONFIGS[rollSize] || NIIMBOT_ROLL_CONFIGS['50x30'];
  const canvases: HTMLCanvasElement[] = [];

  for (const test of tests) {
    const canvas = await renderNiimbotLabelToCanvas(test, company, rollSize);
    canvases.push(canvas);
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const imagesHtml = canvases.map(c => `<div class="label-page"><img src="${c.toDataURL('image/png')}" /></div>`).join('');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Imprimir Etiquetas Niimbot B1</title>
        <style>
          @page {
            size: ${config.widthMm}mm ${config.heightMm}mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            background: #ffffff;
            margin: 0;
            padding: 0;
          }
          .label-page {
            width: ${config.widthMm}mm;
            height: ${config.heightMm}mm;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .label-page:last-child {
            page-break-after: auto;
          }
          img {
            width: 100%;
            height: 100%;
            display: block;
            image-rendering: pixelated;
          }
        </style>
      </head>
      <body>
        ${imagesHtml}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 400);
}
