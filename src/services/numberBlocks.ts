/**
 * Numeração de ensaios, laudos, certificados e OS sem duplicidade entre aparelhos.
 *
 * Com internet, o aparelho reserva no servidor uma FAIXA de números por tipo e
 * por mês (função jvm_reserve_numbers). Offline, usa os números já reservados.
 * Se a faixa acabar sem internet, o número recebe o sufixo do aparelho
 * (ex.: LAU-2609-0031-K7Q), que nunca colide com o de outro aparelho.
 */

export type NumberKind = 'test' | 'report' | 'certificate' | 'os';

export const NUMBER_KINDS: NumberKind[] = ['test', 'report', 'certificate', 'os'];

/**
 * Faixas reservadas: chave "empresa|tipo" -> intervalos [início, fim] ainda livres.
 * A sequência é contínua (não reinicia a cada mês), como nas versões anteriores:
 * o mês aparece só no formato (ENS-2608-0045 -> ENS-2609-0046).
 */
export type NumberBlockState = Record<string, Array<[number, number]>>;

/** Quantos números reservar de cada vez (cobre alguns dias de trabalho offline). */
export const BLOCK_SIZE: Record<NumberKind, number> = { test: 30, report: 30, certificate: 30, os: 10 };

/** Pede nova faixa quando restarem menos números que isto. */
export const REFILL_THRESHOLD: Record<NumberKind, number> = { test: 10, report: 10, certificate: 10, os: 4 };

export function currentPeriod(date: Date = new Date()): string {
  return String(date.getFullYear()).slice(-2) + String(date.getMonth() + 1).padStart(2, '0');
}

export function blockKey(companyId: string, kind: NumberKind): string {
  return `${companyId}|${kind}`;
}

export function remaining(state: NumberBlockState, key: string): number {
  return (state[key] || []).reduce((sum, [start, end]) => sum + Math.max(0, end - start + 1), 0);
}

/** Retira o próximo número livre da faixa (null se não houver). */
export function takeFromBlocks(state: NumberBlockState, key: string): { value: number | null; state: NumberBlockState } {
  const ranges = (state[key] || []).filter(([start, end]) => end >= start);
  if (ranges.length === 0) return { value: null, state };
  const [start, end] = ranges[0];
  const rest: Array<[number, number]> = start < end ? [[start + 1, end], ...ranges.slice(1)] : ranges.slice(1);
  return { value: start, state: { ...state, [key]: rest } };
}

/** Acrescenta uma faixa reservada no servidor (ordenada, sem sobreposição). */
export function addRange(state: NumberBlockState, key: string, start: number, end: number): NumberBlockState {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return state;
  const ranges = [...(state[key] || []), [start, end] as [number, number]].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [s, e] of ranges) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return { ...state, [key]: merged };
}

export function formatNumber(prefix: string, period: string, value: number): string {
  return `${prefix}${period}-${String(value).padStart(4, '0')}`;
}

/** Número de contingência (faixa esgotada sem internet): único por aparelho. */
export function fallbackNumber(prefix: string, period: string, localNext: number, deviceTag: string): string {
  return `${formatNumber(prefix, period, localNext)}-${deviceTag}`;
}

/** Sufixo curto e estável do aparelho (ex.: "DEV-7K3Q9XA" -> "9XA"). */
export function deviceTag(deviceId: string): string {
  const clean = (deviceId || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return clean.slice(-3) || 'DEV';
}

/**
 * Maior sequência já usada, pela mesma regra das versões anteriores: o número
 * após o mês atual ("LAU-2609-0012" -> 12) ou os dígitos finais ("ENS-2608-0045" -> 45).
 * Números de contingência ("...-0031-K7Q") contam pelo número após o mês.
 */
export function maxSequence(numbers: Array<string | undefined | null>, period: string): number {
  const fullPeriod = `20${period}`;
  let max = 0;
  numbers.forEach(n => {
    if (!n) return;
    const m = n.match(new RegExp(`(?:${fullPeriod}|${period})[-_]?(\\d{1,9})`));
    const seq = m && m[1] ? m[1] : (n.match(/(\d{1,9})$/) || [])[1];
    if (seq) max = Math.max(max, parseInt(seq, 10) || 0);
  });
  return max;
}
