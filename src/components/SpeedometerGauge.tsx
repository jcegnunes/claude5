import React from 'react';

export interface SpeedometerGaugeProps {
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

export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({
  title,
  value,
  unit,
  maxScale,
  limit,
  isConforming = true,
  type,
  subtext,
  statusLabel
}) => {
  const width = 280;
  const height = 145;
  const cx = 140;
  const cy = 105;
  const radius = 72;
  const strokeWidth = 11;

  const valClamped = Math.max(0, Math.min(value, maxScale));
  const valFraction = maxScale > 0 ? valClamped / maxScale : 0;
  const needleAngleDeg = 180 - (valFraction * 180); // 180 (left) to 0 (right)
  const needleAngleRad = (needleAngleDeg * Math.PI) / 180;

  const needleLength = radius - 8;
  const tipX = cx + needleLength * Math.cos(needleAngleRad);
  const tipY = cy - needleLength * Math.sin(needleAngleRad);

  // Base needle points
  const baseWidth = 3;
  const perpRad = needleAngleRad + Math.PI / 2;
  const bx1 = cx + baseWidth * Math.cos(perpRad);
  const by1 = cy - baseWidth * Math.sin(perpRad);
  const bx2 = cx - baseWidth * Math.cos(perpRad);
  const by2 = cy - baseWidth * Math.sin(perpRad);

  // Ticks
  const numTicks = 5;
  const ticks = Array.from({ length: numTicks + 1 }, (_, i) => {
    const fraction = i / numTicks;
    const angleRad = Math.PI - (fraction * Math.PI);
    const tickVal = Math.round(fraction * maxScale * 10) / 10;
    const rIn = radius - strokeWidth / 2 - 5;
    const rOut = radius - strokeWidth / 2 - 1;
    const x1 = cx + rIn * Math.cos(angleRad);
    const y1 = cy - rIn * Math.sin(angleRad);
    const x2 = cx + rOut * Math.cos(angleRad);
    const y2 = cy - rOut * Math.sin(angleRad);

    const rTxt = radius - strokeWidth / 2 - 11;
    const tx = cx + rTxt * Math.cos(angleRad);
    const ty = cy - rTxt * Math.sin(angleRad);

    return { val: tickVal, x1, y1, x2, y2, tx, ty };
  });

  // Limit angle for current
  const limitFraction = limit ? Math.min(1, limit / maxScale) : 1;
  const limitAngleDeg = 180 - (limitFraction * 180);
  const limitAngleRad = (limitAngleDeg * Math.PI) / 180;

  // Path helpers for arcs
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: centerX + (r * Math.cos(angleInRadians)),
      y: centerY - (r * Math.sin(angleInRadians))
    };
  };

  const describeArc = (x: number, y: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, r, endAngle);
    const end = polarToCartesian(x, y, r, startAngle);
    const arcSweep = endAngle - startAngle <= 180 ? '0' : '1';
    return [
      'M', start.x, start.y,
      'A', r, r, 0, arcSweep, 0, end.x, end.y
    ].join(' ');
  };

  const effectiveStatus = statusLabel || (type === 'voltage' ? 'ENSAIO EXECUTADO' : (isConforming ? 'CONFORME' : 'NÃO CONFORME'));

  return (
    <div className="border border-slate-200 rounded-lg bg-white shadow-2xs overflow-hidden flex flex-col items-center">
      {/* Header */}
      <div className="w-full bg-[#0A2540] text-white text-[10px] font-bold px-2.5 py-1 uppercase tracking-wider text-center flex items-center justify-between">
        <span className="w-full text-center">{title}</span>
      </div>

      {/* SVG Gauge */}
      <div className="w-full flex justify-center pt-1.5 px-2">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full max-w-[240px] h-auto select-none"
        >
          {/* Background Track */}
          <path
            d={describeArc(cx, cy, radius, 0, 180)}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {type === 'voltage' ? (
            /* Active Voltage Arc */
            <path
              d={describeArc(cx, cy, radius, Math.max(0, 180 - valFraction * 180), 180)}
              fill="none"
              stroke="#2563EB"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          ) : (
            <>
              {/* Safe Zone Arc (Green) */}
              <path
                d={describeArc(cx, cy, radius, limitAngleDeg, 180)}
                fill="none"
                stroke="#10B981"
                strokeWidth={strokeWidth}
              />
              {/* Danger Zone Arc (Red) */}
              <path
                d={describeArc(cx, cy, radius, 0, limitAngleDeg)}
                fill="none"
                stroke="#EF4444"
                strokeWidth={strokeWidth}
              />
              {/* Limit Marker */}
              {limit && (
                <>
                  <line
                    x1={cx + (radius - strokeWidth / 2 - 2) * Math.cos(limitAngleRad)}
                    y1={cy - (radius - strokeWidth / 2 - 2) * Math.sin(limitAngleRad)}
                    x2={cx + (radius + strokeWidth / 2 + 2) * Math.cos(limitAngleRad)}
                    y2={cy - (radius + strokeWidth / 2 + 2) * Math.sin(limitAngleRad)}
                    stroke="#991B1B"
                    strokeWidth={2}
                  />
                  <text
                    x={cx + (radius + 12) * Math.cos(limitAngleRad)}
                    y={cy - (radius + 12) * Math.sin(limitAngleRad)}
                    fill="#991B1B"
                    fontSize={7.5}
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {limit}mA
                  </text>
                </>
              )}
            </>
          )}

          {/* Ticks & Labels */}
          {ticks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#64748B"
                strokeWidth={1.2}
              />
              <text
                x={t.tx}
                y={t.ty}
                fill="#475569"
                fontSize={8}
                textAnchor="middle"
                dominantBaseline="central"
                fontWeight="500"
              >
                {t.val}
              </text>
            </g>
          ))}

          {/* Needle */}
          <polygon
            points={`${bx1},${by1} ${tipX},${tipY} ${bx2},${by2}`}
            fill={type === 'voltage' ? '#1E40AF' : (isConforming ? '#065F46' : '#991B1B')}
            className="transition-all duration-500 ease-out"
          />

          {/* Center Cap */}
          <circle cx={cx} cy={cy} r={5.5} fill="#0F172A" />
          <circle cx={cx} cy={cy} r={2.5} fill="#CBD5E1" />

          {/* Digital Readout */}
          <text
            x={cx}
            y={cy + 17}
            fill={type === 'voltage' ? '#1D4ED8' : (isConforming ? '#047857' : '#DC2626')}
            fontSize={14}
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {value.toFixed(1)} {unit}
          </text>
        </svg>
      </div>

      {/* Footer Info */}
      <div className="w-full pb-2 px-2 flex flex-col items-center gap-0.5 -mt-1 text-center">
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-sm ${
          type === 'voltage'
            ? 'bg-blue-100 text-blue-900 border border-blue-200'
            : (isConforming 
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                : 'bg-red-100 text-red-900 border border-red-300')
        }`}>
          {effectiveStatus}
        </span>
        {subtext && (
          <span className="text-[9.5px] text-slate-500 font-medium">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
};
