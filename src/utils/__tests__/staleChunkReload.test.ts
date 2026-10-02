import { describe, expect, it } from 'vitest';
import { shouldReloadForStaleChunk } from '../staleChunkReload';

describe('Recarga após publicação de nova versão', () => {
  it('recarrega na primeira falha e não entra em ciclo', () => {
    const now = 1_000_000;
    expect(shouldReloadForStaleChunk(null, now)).toBe(true);
    expect(shouldReloadForStaleChunk(now - 10_000, now)).toBe(false);
    expect(shouldReloadForStaleChunk(now - 120_000, now)).toBe(true);
  });
});
