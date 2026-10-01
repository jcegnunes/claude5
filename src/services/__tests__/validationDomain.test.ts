import { describe, expect, it } from 'vitest';
import {
  APP_BASE_URL,
  DEFAULT_VALIDATION_BASE_URL,
  EMBEDDED_PORTAL_URL,
  buildValidationUrl,
  extractValidationCode,
  isPortalOnlyHost,
  normalizeValidationBaseUrl
} from '../../config/validationPortalConfig';

describe('Endereços da plataforma', () => {
  it('sistema, validador e QR Code no site da JVM (Wix)', () => {
    expect(APP_BASE_URL).toBe('https://jvmlab.com.br');
    expect(EMBEDDED_PORTAL_URL).toBe('https://validador.jvmlab.com.br');
    expect(DEFAULT_VALIDATION_BASE_URL).toBe('https://www.jvmengenharia.com.br/validar?codigo={codigo}');
  });

  it('QR Code aponta para a página do Wix com o código', () => {
    expect(buildValidationUrl(undefined, 'VAL-JVM-2610-ABCD2345'))
      .toBe('https://www.jvmengenharia.com.br/validar?codigo=VAL-JVM-2610-ABCD2345');
  });

  it('endereço base continua aceito (formato /validar/CODIGO)', () => {
    expect(buildValidationUrl('https://validador.jvmlab.com.br', 'VAL-1'))
      .toBe('https://validador.jvmlab.com.br/validar/VAL-1');
  });

  it('endereços antigos passam para o padrão atual', () => {
    expect(normalizeValidationBaseUrl('https://mediumvioletred-bison-595566.hostingersite.com')).toBe(DEFAULT_VALIDATION_BASE_URL);
    expect(normalizeValidationBaseUrl('https://jvmlab.com.br/')).toBe(DEFAULT_VALIDATION_BASE_URL);
    expect(normalizeValidationBaseUrl('')).toBe(DEFAULT_VALIDATION_BASE_URL);
  });

  it('o leitor de QR do app entende os dois formatos de link', () => {
    expect(extractValidationCode('https://www.jvmengenharia.com.br/validar?codigo=VAL-JVM-2610-ABCD2345')).toBe('VAL-JVM-2610-ABCD2345');
    expect(extractValidationCode('https://validador.jvmlab.com.br/validar/VAL-JVM-2610-ABCD2345')).toBe('VAL-JVM-2610-ABCD2345');
    expect(extractValidationCode('https://mediumvioletred-bison-595566.hostingersite.com/validar/VAL-JVM-2608-X1')).toBe('VAL-JVM-2608-X1');
    expect(extractValidationCode('EPI-001')).toBeNull();
  });

  it('só o validador funciona como portal exclusivo', () => {
    expect(isPortalOnlyHost('validador.jvmlab.com.br')).toBe(true);
    expect(isPortalOnlyHost('jvmlab.com.br')).toBe(false);
    expect(isPortalOnlyHost('www.jvmengenharia.com.br')).toBe(false);
  });
});
