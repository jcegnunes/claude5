/**
 * PDFs do módulo Treinamentos: certificado (frente + verso com o conteúdo
 * programático) e lista de presença da turma.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { hardenPdfText } from '../../utils/safePdf';
import { generateQRCodeDataUrl, loadImageAsDataUrl } from '../../services/pdfGenerator';
import { cleanSignatureImage } from '../../utils/signatureCleaner';
import { saveDocLocally, saveFileLocally } from '../../utils/nativeFileSaver';
import { buildValidationUrl } from '../../config/validationPortalConfig';
import { DielectricStorageService } from '../../services/syncEngine';
import type { CompanyLabInfo } from '../../types';
import { formatCpf, formatDateBr, formatHours, totalTopicHours, onlyDigits } from './rules';
import type { TrainingCertificate, TrainingClass, TrainingInstructor } from './types';

const NAVY: [number, number, number] = [10, 37, 64];
const ORANGE: [number, number, number] = [234, 88, 12];
const GRAY: [number, number, number] = [90, 100, 115];

const MODALITY: Record<string, string> = { presencial: 'presencial', ead: 'a distância (EAD)', semipresencial: 'semipresencial' };

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return /^data:image\/jpe?g/i.test(dataUrl) ? 'JPEG' : 'PNG';
}

async function safeImage(url?: string, clean = false): Promise<string> {
  if (!url) return '';
  try {
    const data = await loadImageAsDataUrl(url);
    if (!data) return '';
    return clean ? (await cleanSignatureImage(data)) || data : data;
  } catch {
    return '';
  }
}

function longDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? formatDateBr(iso) : d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function period(cert: Pick<TrainingCertificate, 'startDate' | 'endDate'>): string {
  if (!cert.endDate || cert.startDate === cert.endDate) return `em ${formatDateBr(cert.startDate)}`;
  return `no período de ${formatDateBr(cert.startDate)} a ${formatDateBr(cert.endDate)}`;
}

function cityOf(company: CompanyLabInfo): string {
  return company.city || (company.cityState || '').split(/[-/]/)[0].trim();
}

function formatCnpj(v: string): string {
  const d = onlyDigits(v);
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : v;
}

interface Assets { logo: string; }

async function loadAssets(company: CompanyLabInfo): Promise<Assets> {
  return { logo: await safeImage(company.logoUrl) };
}

function drawFrame(doc: jsPDF, w: number, h: number) {
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1.6);
  doc.rect(7, 7, w - 14, h - 14);
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, w - 20, h - 20);
}

function drawHeader(doc: jsPDF, company: CompanyLabInfo, assets: Assets, w: number) {
  if (assets.logo) {
    try { doc.addImage(assets.logo, imageFormat(assets.logo), 16, 15, 34, 22, undefined, 'FAST'); } catch { /* logo inválido */ }
  }
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(company.legalName || company.name || '', w - 16, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const lines = [
    company.cnpj ? `CNPJ ${formatCnpj(company.cnpj)}` : '',
    [company.phone, company.email].filter(Boolean).join(' · '),
    company.website || ''
  ].filter(Boolean);
  lines.forEach((l, i) => doc.text(l, w - 16, 25 + i * 4, { align: 'right' }));
}

export interface DigitalStamp { cn: string; dn: string; reason: string; location: string; at: Date }

/** Data no formato dos leitores de PDF: 2026.10.01 19:05:31-03'00' */
function stampDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const m = -d.getTimezoneOffset();
  const a = Math.abs(m);
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    + `${m >= 0 ? '+' : '-'}${p(Math.floor(a / 60))}'${p(a % 60)}'`;
}

/**
 * Aparência visível da assinatura digital (padrão dos leitores de PDF):
 * à esquerda o nome do titular em destaque; à direita os dados do certificado.
 */
function drawDigitalStamp(doc: jsPDF, cx: number, lineY: number, width: number, s: DigitalStamp) {
  const boxW = Math.min(width - 2, 76);
  const boxH = 22;
  const x0 = cx - boxW / 2;
  const y0 = lineY - boxH - 0.8;
  const leftW = boxW * 0.42;
  const rightX = x0 + leftW + 1.5;
  const rightW = boxW - leftW - 1.5;
  const mm = (pt: number) => pt * 0.3528;

  // marca d'água: selo com visto
  doc.setDrawColor(214, 236, 226);
  doc.setLineWidth(1.2);
  doc.circle(x0 + leftW / 2, y0 + boxH / 2, 8, 'S');
  doc.setLineWidth(1.6);
  doc.line(x0 + leftW / 2 - 4, y0 + boxH / 2, x0 + leftW / 2 - 1, y0 + boxH / 2 + 3);
  doc.line(x0 + leftW / 2 - 1, y0 + boxH / 2 + 3, x0 + leftW / 2 + 4.5, y0 + boxH / 2 - 3.5);

  // nome do titular, no maior tamanho que couber
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  // quebra só nos espaços e depois do ":" (nome:CPF/CNPJ); a fonte diminui até caber
  const words = s.cn.replace(/:/g, ': ').split(/\s+/).filter(Boolean).map(w => w.replace(/:$/, ':'));
  const wrap = (maxW: number): string[] => {
    const out: string[] = [];
    let cur = '';
    words.forEach(w => {
      const glue = cur && !cur.endsWith(':') ? ' ' : '';
      const next = cur ? cur + glue + w : w;
      if (cur && doc.getTextWidth(next) > maxW) { out.push(cur); cur = w; } else cur = next;
    });
    if (cur) out.push(cur);
    return out;
  };
  let size = 12;
  let lines: string[] = [];
  for (; size >= 5; size -= 0.5) {
    doc.setFontSize(size);
    lines = wrap(leftW - 1);
    const widest = Math.max(...lines.map(l => doc.getTextWidth(l)));
    if (widest <= leftW - 1 && lines.length * mm(size) * 1.1 <= boxH - 1) break;
  }
  if (size < 5) { size = 5; doc.setFontSize(size); lines = doc.splitTextToSize(s.cn, leftW - 1); }
  const lh = mm(size) * 1.1;
  let ly = y0 + (boxH - lines.length * lh) / 2 + mm(size) * 0.82;
  lines.slice(0, Math.floor((boxH - 1) / lh)).forEach(l => { doc.text(l, x0 + leftW / 2, ly, { align: 'center' }); ly += lh; });

  // dados do certificado
  const paragraphs = [
    `Assinado digitalmente por ${s.cn}`,
    s.dn ? `ND: ${s.dn}` : '',
    `Razão: ${s.reason}`,
    `Localização: ${s.location}`,
    `Data: ${stampDate(s.at)}`
  ].filter(Boolean);
  let fs2 = 5;
  let all: string[] = [];
  for (; fs2 >= 3.8; fs2 -= 0.2) {
    doc.setFontSize(fs2);
    all = paragraphs.flatMap(p => doc.splitTextToSize(p, rightW));
    if (all.length * mm(fs2) * 1.12 <= boxH) break;
  }
  const rlh = mm(fs2) * 1.12;
  const maxLines = Math.floor(boxH / rlh);
  if (all.length > maxLines) {
    // ND muito longo: corta o ND e mantém razão, local e data
    const tail = paragraphs.slice(-3).flatMap(p => doc.splitTextToSize(p, rightW));
    all = [...all.slice(0, maxLines - tail.length - 1), '…', ...tail];
  }
  doc.setTextColor(30, 30, 30);
  let ry = y0 + mm(fs2) * 0.9;
  all.forEach(l => { doc.text(l, rightX, ry); ry += rlh; });
}

function drawSignature(doc: jsPDF, x: number, y: number, width: number, image: string, name: string, line2: string, line3?: string, stamp?: DigitalStamp, line4?: string) {
  if (stamp) {
    drawDigitalStamp(doc, x + width / 2, y, width, stamp);
  } else if (image) {
    try { doc.addImage(image, imageFormat(image), x + width / 2 - 22, y - 15, 44, 14, undefined, 'FAST'); } catch { /* assinatura inválida */ }
  }
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.3);
  doc.line(x + 4, y, x + width - 4, y);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(doc.splitTextToSize(name || ' ', width - 4)[0], x + width / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...GRAY);
  if (line2) doc.text(doc.splitTextToSize(line2, width - 4)[0], x + width / 2, y + 7.6, { align: 'center' });
  if (line3) doc.text(doc.splitTextToSize(line3, width - 4)[0], x + width / 2, y + 10.8, { align: 'center' });
  if (line4) {
    doc.setFontSize(6.6);
    doc.setTextColor(5, 120, 85);
    doc.text(doc.splitTextToSize(line4, width - 4)[0], x + width / 2, y + (line3 ? 14 : 10.8), { align: 'center' });
  }
}

async function drawCertificate(
  doc: jsPDF, cert: TrainingCertificate, company: CompanyLabInfo, assets: Assets,
  stamps: Record<string, { cn: string; dn: string; reason: string; person?: string; docLine?: string }> = {}, signedAt: Date = new Date()
) {
  const stampLocation = [company.city, company.state].filter(Boolean).join('/') || cityOf(company) || 'Brasil';
  const digitalNames = Object.entries(stamps).map(([label, st]) => st.person || label);
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  drawFrame(doc, w, h);
  drawHeader(doc, company, assets, w);

  // ---------------------------------------------------------------- frente
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.text('CERTIFICADO', w / 2, 52, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(...ORANGE);
  doc.text('DE CONCLUSÃO DE TREINAMENTO', w / 2, 60, { align: 'center', charSpace: 1 });

  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Certificamos que', w / 2, 74, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text(cert.participantName.toUpperCase(), w / 2, 85, { align: 'center', maxWidth: w - 50 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const idLine = [
    cert.participantCpf ? `CPF ${formatCpf(cert.participantCpf)}` : '',
    cert.participantRole ? `Função: ${cert.participantRole}` : '',
    cert.participantCompany ? `Empresa: ${cert.participantCompany}` : ''
  ].filter(Boolean).join('   ·   ');
  doc.text(idLine, w / 2, 92, { align: 'center', maxWidth: w - 50 });

  const body = `concluiu com aproveitamento o treinamento "${cert.courseName}", em conformidade com ${cert.normReference || 'a legislação aplicável'}, realizado ${period(cert)}, na modalidade ${MODALITY[cert.modality] || cert.modality}${cert.location ? `, em ${cert.location}` : ''}, com carga horária total de ${formatHours(cert.workloadHours).replace(' h', ' horas')}.`;
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  const bodyLines = doc.splitTextToSize(body, w - 70);
  doc.text(bodyLines, w / 2, 102, { align: 'center', lineHeightFactor: 1.45 });
  let y = 102 + bodyLines.length * 6.2;

  if (cert.expiryDate) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(`Válido até ${formatDateBr(cert.expiryDate)}`, w / 2, y + 2, { align: 'center' });
    y += 6;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  const city = cityOf(company);
  doc.text(`${city ? `${city}, ` : ''}${longDate(cert.issueDate)}.`, w / 2, y + 4, { align: 'center' });

  // ------------------------------------------------------------ assinaturas
  const signers: Array<{ image: string; name: string; l2: string; l3?: string }> = [];
  for (const ins of cert.instructors.slice(0, 2)) {
    signers.push({ image: await safeImage(ins.signatureUrl, true), name: ins.name, l2: `Instrutor${ins.qualification ? ` – ${ins.qualification}` : ''}`, l3: ins.registration });
  }
  if (cert.technicalResponsibleName) {
    signers.push({
      image: await safeImage(cert.technicalResponsibleSignature, true),
      name: cert.technicalResponsibleName,
      l2: `Responsável Técnico${cert.technicalResponsibleTitle ? ` – ${cert.technicalResponsibleTitle}` : ''}`,
      l3: cert.technicalResponsibleRegistration
    });
  }
  signers.push({ image: '', name: cert.participantName, l2: 'Participante' });
  const sigY = 170;
  const areaX = 18;
  const areaW = w - 18 - 60; // à direita fica o QR Code
  const colW = areaW / signers.length;
  signers.forEach((s, i) => {
    const st = stamps[s.name];
    // assinado digitalmente: nome e documento conforme o certificado cadastrado
    drawSignature(doc, areaX + i * colW, sigY, colW, s.image, st?.person || s.name, s.l2, s.l3,
      st ? { cn: st.cn, dn: st.dn, reason: st.reason, location: stampLocation, at: signedAt } : undefined,
      st?.docLine);
  });

  // ------------------------------------------------------- QR Code e número
  const url = buildValidationUrl(company.validationBaseUrl, cert.validationCode);
  const qr = await generateQRCodeDataUrl(url);
  if (qr) doc.addImage(qr, 'PNG', w - 50, 150, 30, 30);
  doc.setFontSize(6.8);
  doc.setTextColor(...GRAY);
  doc.text('Confira a autenticidade:', w - 35, 183, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(cert.validationCode, w - 35, 186.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(`Certificado nº ${cert.certificateNumber}${cert.classNumber ? `  ·  Turma ${cert.classNumber}` : ''}  ·  Emitido em ${formatDateBr(cert.issueDate)}`, 16, h - 14);
  doc.text(url, w - 16, h - 14, { align: 'right', maxWidth: 140 });

  if (cert.status === 'cancelado') drawCancelled(doc, w, h);

  // ------------------------------------------------------------------ verso
  doc.addPage();
  drawFrame(doc, w, h);
  drawHeader(doc, company, assets, w);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('CONTEÚDO PROGRAMÁTICO', w / 2, 46, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.text(doc.splitTextToSize(cert.courseName, w - 60), w / 2, 52, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(cert.normReference || '', w / 2, 61, { align: 'center', maxWidth: w - 60 });

  const total = totalTopicHours(cert.topics);
  autoTable(doc, {
    startY: 65,
    margin: { left: 16, right: 16 },
    head: [['Nº', 'Conteúdo', 'Carga horária']],
    body: [
      ...cert.topics.map((t, i) => [String(i + 1), t.title, formatHours(t.hours)]),
      ['', 'Total', formatHours(total || cert.workloadHours)]
    ],
    styles: { fontSize: 7.6, cellPadding: 1.3, textColor: [40, 40, 40], lineColor: [210, 215, 222], lineWidth: 0.2 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 26, halign: 'center' } },
    didParseCell: data => {
      if (data.section === 'body' && data.row.index === cert.topics.length) data.cell.styles.fontStyle = 'bold';
    }
  });
  const vy = ((doc as any).lastAutoTable?.finalY || 120) + 6;

  // Duas colunas: dados do participante à esquerda, pré-requisito e observações à direita
  const left: Array<[string, string]> = [
    ['Participante', `${cert.participantName}${cert.participantCpf ? ` – CPF ${formatCpf(cert.participantCpf)}` : ''}`],
    ['Período / local', `${formatDateBr(cert.startDate)}${cert.endDate && cert.endDate !== cert.startDate ? ` a ${formatDateBr(cert.endDate)}` : ''}${cert.location ? ` – ${cert.location}` : ''}`],
    ['Instrutor(es)', cert.instructors.map(i => [i.name, i.qualification, i.registration].filter(Boolean).join(', ')).join('; ')],
    ['Aproveitamento', [cert.attendance !== undefined ? `presença ${cert.attendance}%` : '', cert.grade !== undefined && cert.grade !== null ? `nota ${String(cert.grade).replace('.', ',')}` : ''].filter(Boolean).join(' · ')]
  ];
  const right: Array<[string, string]> = [
    ['Pré-requisito', cert.prerequisite || ''],
    ['Observações', cert.courseNotes || '']
  ];
  const drawInfo = (items: Array<[string, string]>, x: number, width: number) => {
    let cy = vy;
    doc.setFontSize(7.6);
    items.filter(([, v]) => v).forEach(([label, value]) => {
      if (cy > h - 20) return;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(`${label}:`, x, cy);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(value, width - 30).slice(0, Math.max(1, Math.floor((h - 20 - cy) / 3.4)));
      doc.text(lines, x + 30, cy);
      cy += Math.max(1, lines.length) * 3.4 + 1;
    });
  };
  drawInfo(left, 16, (w - 32) / 2 - 4);
  drawInfo(right, w / 2 + 4, (w - 32) / 2 - 4);

  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(`Certificado nº ${cert.certificateNumber}  ·  Código de validação ${cert.validationCode}`, w / 2, h - 14, { align: 'center' });
  if (digitalNames.length) {
    doc.setTextColor(5, 120, 85);
    doc.text(`Documento assinado digitalmente (ICP-Brasil) por ${digitalNames.join(' e ')}. Confira no leitor de PDF ou em validar.iti.gov.br`, w / 2, h - 18, { align: 'center', maxWidth: w - 40 });
  }
  if (cert.status === 'cancelado') drawCancelled(doc, w, h);
}

function drawCancelled(doc: jsPDF, w: number, h: number) {
  doc.setTextColor(220, 38, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(60);
  doc.text('CANCELADO', w / 2, h / 2 + 10, { align: 'center', angle: 20 });
}

function newCertificateDoc(): jsPDF {
  return hardenPdfText(new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }));
}

export function certificateFileName(cert: TrainingCertificate): string {
  const name = cert.participantName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `Certificado_${cert.certificateNumber}_${name}.pdf`;
}

/** Gera um PDF com um ou vários certificados (2 páginas cada). */
export async function renderTrainingCertificates(certs: TrainingCertificate[], company: CompanyLabInfo = DielectricStorageService.getCompanyInfo()): Promise<jsPDF> {
  const doc = newCertificateDoc();
  const assets = await loadAssets(company);
  for (let i = 0; i < certs.length; i++) {
    if (i > 0) doc.addPage();
    await drawCertificate(doc, certs[i], company, assets);
  }
  return doc;
}

/**
 * Baixa os certificados. Com certificado digital (A1) cadastrado para o RT ou
 * os instrutores, cada PDF é assinado digitalmente; vários certificados saem
 * num .zip (um PDF assinado por pessoa). Sem certificado digital: um PDF único.
 */
export async function exportTrainingCertificates(certs: TrainingCertificate[], fileName?: string): Promise<void> {
  if (!certs.length) return;
  const name = fileName || (certs.length === 1 ? certificateFileName(certs[0]) : `Certificados_${certs[0].classNumber || 'treinamento'}.pdf`);

  // carregado só aqui: o validador público também gera o PDF e não precisa disso
  const signing = await import('./signingCerts');
  await signing.loadSigningCerts();
  if (!signing.hasAnySigningCert()) {
    const doc = await renderTrainingCertificates(certs);
    await saveDocLocally(doc, name, name.replace(/\.pdf$/, ''), 'certificado');
    return;
  }

  const company = DielectricStorageService.getCompanyInfo();
  const assets = await loadAssets(company);
  const files: Array<{ name: string; bytes: Uint8Array }> = [];
  const warnings = new Set<string>();
  let signedCount = 0;
  for (const cert of certs) {
    const plan = cert.status === 'cancelado' ? { signers: [], names: [], stamps: {}, warnings: [] } : await signing.planSignatures(cert);
    plan.warnings.forEach(w => warnings.add(w));
    const doc = newCertificateDoc();
    const location = [company.city, company.state].filter(Boolean).join('/') || 'Brasil';
    plan.signers.forEach(sg => { sg.location = location; });
    await drawCertificate(doc, cert, company, assets, plan.stamps, new Date());
    let bytes: Uint8Array = new Uint8Array(doc.output('arraybuffer'));
    if (plan.signers.length) {
      try {
        const { signPdf } = await import('./digitalSignature');
        bytes = await signPdf(bytes, plan.signers);
        signedCount++;
      } catch (err) {
        warnings.add(`Falha na assinatura digital (${err instanceof Error ? err.message : String(err)}): o PDF de ${cert.participantName} saiu sem assinatura.`);
        const plain = newCertificateDoc();
        await drawCertificate(plain, cert, company, assets);
        bytes = new Uint8Array(plain.output('arraybuffer'));
      }
    }
    files.push({ name: certificateFileName(cert), bytes });
  }

  if (files.length === 1) {
    await saveFileLocally({ filename: name, data: files[0].bytes, mimeType: 'application/pdf', title: name.replace(/\.pdf$/, ''), category: 'certificado' });
  } else {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const used = new Set<string>();
    files.forEach(f => {
      let n = f.name;
      for (let i = 2; used.has(n); i++) n = f.name.replace(/\.pdf$/, `_${i}.pdf`);
      used.add(n);
      zip.file(n, f.bytes);
    });
    const zipName = name.replace(/\.pdf$/i, '') + '.zip';
    await saveFileLocally({ filename: zipName, data: await zip.generateAsync({ type: 'uint8array' }), mimeType: 'application/zip', title: zipName, category: 'certificado' });
  }
  if (warnings.size) window.alert(`${signedCount} de ${files.length} certificado(s) assinado(s) digitalmente.\n\n${Array.from(warnings).join('\n')}`);
}

/** Lista de presença da turma (uma coluna de assinatura por dia, até 5 dias). */
export async function exportAttendanceList(turma: TrainingClass, instructors: TrainingInstructor[], company: CompanyLabInfo = DielectricStorageService.getCompanyInfo()): Promise<void> {
  const doc = hardenPdfText(new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }));
  const w = doc.internal.pageSize.getWidth();
  const assets = await loadAssets(company);
  drawHeader(doc, company, assets, w);
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('LISTA DE PRESENÇA', 16, 46);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  const ins = instructors.filter(i => turma.instructorIds.includes(i.id));
  const meta = [
    `Turma: ${turma.classNumber}   ·   Curso: ${turma.courseName}`,
    `Período: ${formatDateBr(turma.startDate)}${turma.endDate && turma.endDate !== turma.startDate ? ` a ${formatDateBr(turma.endDate)}` : ''}   ·   Carga horária: ${formatHours(turma.workloadHours)}   ·   Local: ${turma.location || '-'}`,
    `Instrutor(es): ${ins.map(i => i.name).join(', ') || '-'}${turma.clientName ? `   ·   Cliente: ${turma.clientName}` : ''}`
  ];
  meta.forEach((m, i) => doc.text(m, 16, 53 + i * 5, { maxWidth: w - 32 }));

  const days: string[] = [];
  if (turma.startDate) {
    const start = new Date(`${turma.startDate}T12:00:00`);
    const end = new Date(`${(turma.endDate || turma.startDate)}T12:00:00`);
    for (let d = new Date(start); d <= end && days.length < 5; d.setDate(d.getDate() + 1)) {
      days.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    }
  }
  const signCols = days.length ? days.map(d => `Assinatura ${d}`) : ['Assinatura'];
  const rows = turma.participants.map((p, i) => [String(i + 1), p.name, formatCpf(p.cpf), [p.company, p.role].filter(Boolean).join(' / '), ...signCols.map(() => '')]);
  for (let i = rows.length; i < Math.max(rows.length, 10); i++) rows.push([String(i + 1), '', '', '', ...signCols.map(() => '')]);

  autoTable(doc, {
    startY: 70,
    margin: { left: 16, right: 16 },
    head: [['Nº', 'Nome', 'CPF', 'Empresa / Função', ...signCols]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2, minCellHeight: 9, valign: 'middle', lineColor: [200, 205, 212], lineWidth: 0.2 },
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7.5 },
    columnStyles: { 0: { cellWidth: 9, halign: 'center' }, 2: { cellWidth: 28 } }
  });

  let y = ((doc as any).lastAutoTable?.finalY || 150) + 18;
  const h = doc.internal.pageSize.getHeight();
  if (y > h - 20) { doc.addPage(); y = 40; }
  const colW = (w - 32) / Math.max(1, ins.length || 1);
  for (let i = 0; i < Math.max(1, ins.length); i++) {
    const it = ins[i];
    drawSignature(doc, 16 + i * colW, y, colW, await safeImage(it?.signatureUrl, true), it?.name || 'Instrutor', it ? `Instrutor${it.qualification ? ` – ${it.qualification}` : ''}` : '', it?.registration);
  }
  const name = `Lista_Presenca_${turma.classNumber}.pdf`;
  await saveDocLocally(doc, name, name.replace(/\.pdf$/, ''), 'outro');
}
