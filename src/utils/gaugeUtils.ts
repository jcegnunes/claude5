/**
 * Utilitário para geração de gráficos de velocímetro (Gauges)
 * para exibição em tela (SVG/Canvas) e inserção em PDF (Data URL).
 */

export interface GaugeConfig {
  title: string;
  value: number;
  unit: string;
  maxScale: number;
  limit?: number | null;
  isConforming?: boolean;
  type: 'voltage' | 'current';
  subtext?: string;
  statusLabel?: string;
}

/**
 * Renderiza um velocímetro em altíssima resolução (Canvas 2D) e retorna como DataURL (PNG).
 * Proporção compacta e nítida perfeitamente alinhada com as dimensões de inserção no PDF (93x31 mm).
 */
export function generateGaugeCanvasDataUrl(config: GaugeConfig): string {
  if (typeof document === 'undefined') return '';

  const scale = 3; // Ultra Hi-DPI (1080x405) para impressão nítida
  const w = 360;
  const h = 135;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);

  const cx = w / 2;
  const cy = 76;
  const radius = 48;
  const trackWidth = 7.5;

  // 1. Fundo do Card com borda suave
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(1, 1, w - 2, h - 2, 4);
  } else {
    ctx.rect(1, 1, w - 2, h - 2);
  }
  ctx.fill();

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 2. Faixa superior do título (Navy #0A2540)
  ctx.fillStyle = '#0A2540';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(1, 1, w - 2, 18, [4, 4, 0, 0]);
  } else {
    ctx.rect(1, 1, w - 2, 18);
  }
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8.5px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(config.title.toUpperCase(), cx, 10);

  // 3. Faixa de fundo do arco (cinza suave #E2E8F0) - Semicírculo Superior (180° a 360° no Canvas)
  const startAngle = Math.PI;       // 180 graus (Esquerda / 9 horas)
  const endAngle = 2 * Math.PI;     // 360 graus (Direita / 3 horas)

  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle, false);
  ctx.lineWidth = trackWidth;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineCap = 'round';
  ctx.stroke();

  const valClamped = Math.max(0, Math.min(config.value, config.maxScale));
  const valFraction = config.maxScale > 0 ? valClamped / config.maxScale : 0;
  const needleAngle = Math.PI + (valFraction * Math.PI);

  if (config.type === 'voltage') {
    // Arco azul para Tensão Aplicada
    const activeEndAngle = Math.PI + (valFraction * Math.PI);
    if (valFraction > 0.005) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, activeEndAngle, false);
      ctx.lineWidth = trackWidth;
      ctx.strokeStyle = '#2563EB';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  } else {
    // Arco para Corrente de Fuga: Verde até o Limite, Vermelho acima
    const limit = config.limit || config.maxScale;
    const limitFraction = Math.min(1, limit / config.maxScale);
    const limitAngle = Math.PI + (limitFraction * Math.PI);

    // Zona Segura / Conforme (Verde #10B981)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, limitAngle, false);
    ctx.lineWidth = trackWidth;
    ctx.strokeStyle = '#10B981';
    ctx.stroke();

    // Zona de Perigo / Não Conforme (Vermelho #EF4444)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, limitAngle, endAngle, false);
    ctx.lineWidth = trackWidth;
    ctx.strokeStyle = '#EF4444';
    ctx.stroke();

    // Marcador de Limite
    const markerR1 = radius - trackWidth / 2 - 2;
    const markerR2 = radius + trackWidth / 2 + 2;
    const mx1 = cx + markerR1 * Math.cos(limitAngle);
    const my1 = cy + markerR1 * Math.sin(limitAngle);
    const mx2 = cx + markerR2 * Math.cos(limitAngle);
    const my2 = cy + markerR2 * Math.sin(limitAngle);

    ctx.beginPath();
    ctx.moveTo(mx1, my1);
    ctx.lineTo(mx2, my2);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#991B1B';
    ctx.stroke();

    // Label do limite
    ctx.font = 'bold 7.0px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#991B1B';
    ctx.textAlign = 'center';
    const tagR = radius + 10;
    const tx = cx + tagR * Math.cos(limitAngle);
    const ty = cy + tagR * Math.sin(limitAngle);
    ctx.fillText(`${limit}mA`, tx, ty);
  }

  // 4. Marcas e Escalas (Ticks)
  const numMajorTicks = 5;
  for (let i = 0; i <= numMajorTicks; i++) {
    const fraction = i / numMajorTicks;
    const angle = Math.PI + (fraction * Math.PI);
    const tickValue = Math.round(fraction * config.maxScale * 10) / 10;

    const rInner = radius - trackWidth / 2 - 3;
    const rOuter = radius - trackWidth / 2 - 1;
    const x1 = cx + rInner * Math.cos(angle);
    const y1 = cy + rInner * Math.sin(angle);
    const x2 = cx + rOuter * Math.cos(angle);
    const y2 = cy + rOuter * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = '#64748B';
    ctx.stroke();

    // Texto da escala
    const rText = radius - trackWidth / 2 - 8;
    const textX = cx + rText * Math.cos(angle);
    const textY = cy + rText * Math.sin(angle);

    ctx.font = '7.0px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tickValue.toString(), textX, textY);
  }

  // 5. Ponteiro do Velocímetro (Needle)
  const needleLength = radius - 5;
  const tipX = cx + needleLength * Math.cos(needleAngle);
  const tipY = cy + needleLength * Math.sin(needleAngle);

  // Base do ponteiro (perpendicular ao vetor do ponteiro)
  const baseAngle1 = needleAngle + Math.PI / 2;
  const baseAngle2 = needleAngle - Math.PI / 2;
  const baseWidth = 2.8;
  const bx1 = cx + baseWidth * Math.cos(baseAngle1);
  const by1 = cy + baseWidth * Math.sin(baseAngle1);
  const bx2 = cx + baseWidth * Math.cos(baseAngle2);
  const by2 = cy + baseWidth * Math.sin(baseAngle2);

  ctx.beginPath();
  ctx.moveTo(bx1, by1);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(bx2, by2);
  ctx.closePath();
  ctx.fillStyle = config.type === 'voltage' ? '#1E40AF' : (config.isConforming !== false ? '#065F46' : '#991B1B');
  ctx.fill();

  // Cap do centro do ponteiro
  ctx.beginPath();
  ctx.arc(cx, cy, 4.0, 0, Math.PI * 2);
  ctx.fillStyle = '#0F172A';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = '#CBD5E1';
  ctx.fill();

  // 6. Valor Digital no Centro
  const valString = `${config.value.toFixed(1)} ${config.unit}`;
  ctx.font = 'bold 12.0px monospace, Helvetica, Arial, sans-serif';
  ctx.fillStyle = config.type === 'voltage' ? '#1D4ED8' : (config.isConforming !== false ? '#047857' : '#DC2626');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(valString, cx, cy + 12);

  // 7. Badge / Status Inferior
  const statusLabel = config.statusLabel || (config.isConforming !== false ? 'CONFORME' : 'NÃO CONFORME');
  ctx.font = 'bold 7.5px Helvetica, Arial, sans-serif';
  const badgeWidth = ctx.measureText(statusLabel).width + 12;
  const badgeY = cy + 22;

  ctx.fillStyle = config.type === 'voltage' 
    ? '#DBEAFE' 
    : (config.isConforming !== false ? '#D1FAE5' : '#FEE2E2');
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(cx - badgeWidth / 2, badgeY, badgeWidth, 12, 2.5);
  } else {
    ctx.rect(cx - badgeWidth / 2, badgeY, badgeWidth, 12);
  }
  ctx.fill();

  ctx.strokeStyle = config.type === 'voltage'
    ? '#BFDBFE'
    : (config.isConforming !== false ? '#A7F3D0' : '#FECACA');
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = config.type === 'voltage' 
    ? '#1E40AF' 
    : (config.isConforming !== false ? '#065F46' : '#991B1B');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(statusLabel, cx, badgeY + 6);

  // 8. Subtext (ex: Duração ou Limite Normativo)
  if (config.subtext) {
    ctx.font = '7.0px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.subtext, cx, badgeY + 17);
  }

  return canvas.toDataURL('image/png', 1.0);
}
