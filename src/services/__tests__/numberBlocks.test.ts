import { describe, expect, it } from 'vitest';
import {
  addRange,
  blockKey,
  currentPeriod,
  deviceTag,
  fallbackNumber,
  formatNumber,
  maxSequence,
  remaining,
  takeFromBlocks
} from '../numberBlocks';

const key = blockKey('comp-1', 'report');

describe('Numeração — faixas reservadas', () => {
  it('usa os números da faixa em ordem e sem repetir', () => {
    let state = addRange({}, key, 11, 13);
    const taken: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = takeFromBlocks(state, key);
      state = r.state;
      if (r.value !== null) taken.push(r.value);
    }
    expect(taken).toEqual([11, 12, 13]);
    expect(remaining(state, key)).toBe(0);
  });

  it('junta faixas contíguas e mantém faixas separadas em ordem', () => {
    let state = addRange({}, key, 21, 30);
    state = addRange(state, key, 1, 10);
    state = addRange(state, key, 11, 20);
    expect(state[key]).toEqual([[1, 30]]);
    state = addRange(state, key, 50, 55);
    expect(state[key]).toEqual([[1, 30], [50, 55]]);
    expect(remaining(state, key)).toBe(36);
  });

  it('ignora faixa inválida', () => {
    expect(addRange({}, key, 10, 5)).toEqual({});
  });

  it('faixas de empresas e tipos diferentes são independentes', () => {
    let state = addRange({}, blockKey('comp-1', 'test'), 1, 5);
    state = addRange(state, blockKey('comp-2', 'test'), 100, 105);
    expect(takeFromBlocks(state, blockKey('comp-2', 'test')).value).toBe(100);
    expect(takeFromBlocks(state, blockKey('comp-1', 'report')).value).toBeNull();
  });
});

describe('Numeração — formato', () => {
  it('mantém o formato das versões anteriores', () => {
    expect(formatNumber('LAU-', '2609', 12)).toBe('LAU-2609-0012');
    expect(currentPeriod(new Date(2026, 8, 28))).toBe('2609');
  });

  it('contingência offline recebe o sufixo do aparelho', () => {
    expect(deviceTag('DEV-7K3Q9XA')).toBe('9XA');
    expect(fallbackNumber('ENS-', '2609', 31, '9XA')).toBe('ENS-2609-0031-9XA');
  });

  it('sequência contínua entre meses, como antes (ENS-2608-0045 -> 46)', () => {
    expect(maxSequence(['ENS-2608-0045', 'ENS-2607-0040'], '2609')).toBe(45);
    expect(maxSequence(['ENS-2609-0003', 'ENS-2608-0045'], '2609')).toBe(45);
    expect(maxSequence(['ENS-2609-0050', 'ENS-2608-0045'], '2609')).toBe(50);
  });

  it('número de contingência conta pela sequência após o mês', () => {
    expect(maxSequence(['LAU-2609-0031-9XA'], '2609')).toBe(31);
  });

  it('aceita o formato antigo com ano de 4 dígitos', () => {
    expect(maxSequence(['CERT-202609-0007'], '2609')).toBe(7);
  });
});
