import { describe, expect, it } from 'vitest';
import {
  EditorState,
  arrowHead,
  isMeaningful,
  rotatePoint,
  rotateState,
  rotatedSize,
  strokeWidthFor,
  textSizeFor
} from '../photoAnnotations';

describe('Editor de fotos — giro', () => {
  it('troca largura e altura a cada 90°', () => {
    expect(rotatedSize(1280, 960, 0)).toEqual({ width: 1280, height: 960 });
    expect(rotatedSize(1280, 960, 1)).toEqual({ width: 960, height: 1280 });
    expect(rotatedSize(1280, 960, 2)).toEqual({ width: 1280, height: 960 });
  });

  it('leva os pontos junto com a foto (horário e anti-horário)', () => {
    // canto superior esquerdo vai para o canto superior direito no giro horário
    expect(rotatePoint({ x: 0, y: 0 }, 1280, 960, true)).toEqual({ x: 960, y: 0 });
    expect(rotatePoint({ x: 100, y: 50 }, 1280, 960, true)).toEqual({ x: 910, y: 100 });
    // anti-horário desfaz o horário
    const p = rotatePoint({ x: 100, y: 50 }, 1280, 960, true);
    expect(rotatePoint(p, 960, 1280, false)).toEqual({ x: 100, y: 50 });
  });

  it('quatro giros voltam ao original com as marcações no mesmo lugar', () => {
    let state: EditorState = {
      quarterTurns: 0,
      annotations: [
        { kind: 'arrow', from: { x: 10, y: 20 }, to: { x: 300, y: 400 }, color: '#ef4444', width: 6 },
        { kind: 'text', at: { x: 50, y: 60 }, text: 'Furo', color: '#ffffff', size: 40 }
      ]
    };
    const original = JSON.parse(JSON.stringify(state));
    for (let i = 0; i < 4; i++) state = rotateState(state, 1280, 960, true);
    expect(state).toEqual(original);
    state = rotateState(rotateState(state, 1280, 960, false), 1280, 960, true);
    expect(state).toEqual(original);
  });
});

describe('Editor de fotos — marcações', () => {
  it('espessura e texto proporcionais ao tamanho da foto', () => {
    expect(strokeWidthFor(2, 1280, 960)).toBe(7);
    expect(strokeWidthFor(3, 1280, 960)).toBeGreaterThan(strokeWidthFor(1, 1280, 960));
    expect(strokeWidthFor(1, 100, 100)).toBe(2);
    expect(textSizeFor(2, 1280, 960)).toBe(43);
  });

  it('pontas da seta ficam atrás da ponta, dos dois lados', () => {
    const [a, b] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 6);
    expect(a.x).toBeLessThan(100);
    expect(b.x).toBeLessThan(100);
    expect(Math.sign(a.y)).toBe(-Math.sign(b.y));
  });

  it('descarta toque sem arrastar e texto vazio', () => {
    expect(isMeaningful({ kind: 'circle', from: { x: 5, y: 5 }, to: { x: 7, y: 6 }, color: '#000', width: 4 })).toBe(false);
    expect(isMeaningful({ kind: 'rect', from: { x: 5, y: 5 }, to: { x: 60, y: 40 }, color: '#000', width: 4 })).toBe(true);
    expect(isMeaningful({ kind: 'text', at: { x: 0, y: 0 }, text: '   ', color: '#000', size: 20 })).toBe(false);
  });
});
