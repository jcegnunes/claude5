import { describe, expect, it } from 'vitest';
import { formatMb, usagePercent } from '../../components/StorageStatusCard';

describe('Painel de armazenamento — formatação', () => {
  it('mostra MB e GB em português', () => {
    expect(formatMb(0.5)).toBe('0,5 MB');
    expect(formatMb(250)).toBe('250 MB');
    expect(formatMb(10240)).toBe('10 GB');
    expect(formatMb(1536)).toBe('1,5 GB');
    expect(formatMb(undefined)).toBe('—');
  });

  it('calcula o percentual usado do espaço liberado pelo navegador', () => {
    expect(usagePercent(250, 10000)).toBe(2.5);
    expect(usagePercent(0, 1000)).toBe(0);
    expect(usagePercent(2000, 1000)).toBe(100);
    expect(usagePercent(100, undefined)).toBeNull();
    expect(usagePercent(undefined, 1000)).toBeNull();
  });
});
