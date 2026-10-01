import { describe, expect, it } from 'vitest';
import { DEFAULT_VALIDATION_BASE_URL, normalizeValidationBaseUrl } from '../../config/validationPortalConfig';

describe('Endereço da plataforma (QR Code)', () => {
  it('o endereço padrão é jvmlab.com.br', () => {
    expect(DEFAULT_VALIDATION_BASE_URL).toBe('https://jvmlab.com.br');
    expect(normalizeValidationBaseUrl('')).toBe('https://jvmlab.com.br');
    expect(normalizeValidationBaseUrl(undefined)).toBe('https://jvmlab.com.br');
  });

  it('endereços antigos da Hostinger passam para jvmlab.com.br', () => {
    expect(normalizeValidationBaseUrl('https://mediumvioletred-bison-595566.hostingersite.com')).toBe('https://jvmlab.com.br');
    expect(normalizeValidationBaseUrl('https://mediumvioletred-bison-595566.hostingersite.com/')).toBe('https://jvmlab.com.br');
    expect(normalizeValidationBaseUrl('https://mediumturquoise-giraffe-910043.hostingersite.com')).toBe('https://jvmlab.com.br');
  });

  it('endereço configurado manualmente é mantido (sem barra no final)', () => {
    expect(normalizeValidationBaseUrl('https://validar.jvmlab.com.br/')).toBe('https://validar.jvmlab.com.br');
  });
});
