/**
 * Portal Público de Validação de Laudos/Certificados (QR Code).
 *
 * Substitui a antiga integração "Hostinger": o domínio abaixo é apenas a
 * HOSPEDAGEM do app (página /validar/CODIGO). Os dados consultados pelo
 * portal vêm exclusivamente do Supabase.
 */
import { DielectricStorageService } from './syncEngine';

import { DEFAULT_VALIDATION_BASE_URL, normalizeValidationBaseUrl } from '../config/validationPortalConfig';

export { DEFAULT_VALIDATION_BASE_URL, normalizeValidationBaseUrl };

export interface PortalConnectionResult {
  success: boolean;
  url: string;
  latencyMs: number;
  message: string;
}

export class ValidationPortalService {
  static getValidationBaseUrl(): string {
    try {
      const company = DielectricStorageService.getCompanyInfo();
      return normalizeValidationBaseUrl(company?.validationBaseUrl);
    } catch {
      return DEFAULT_VALIDATION_BASE_URL;
    }
  }

  static buildPublicValidationUrl(validationCode: string): string {
    return `${this.getValidationBaseUrl()}/validar/${encodeURIComponent(validationCode || '')}`;
  }

  /** Verifica se o domínio do portal público responde (hospedagem do app). */
  static async testPortal(targetUrl?: string): Promise<PortalConnectionResult> {
    const url = normalizeValidationBaseUrl(targetUrl || this.getValidationBaseUrl());
    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: controller.signal });
      const latencyMs = Math.round(performance.now() - start);
      return { success: true, url, latencyMs, message: `Portal de validação acessível (${latencyMs}ms).` };
    } catch (err: any) {
      return {
        success: false,
        url,
        latencyMs: 0,
        message: err?.name === 'AbortError'
          ? 'Tempo esgotado ao acessar o portal de validação.'
          : 'Não foi possível acessar o portal de validação.'
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
