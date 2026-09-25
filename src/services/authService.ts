import { User, UserRole, Company } from '../types';
import { DielectricStorageService } from './syncEngine';
import { SupabaseService } from './supabaseService';

/**
 * Perfil do Administrador Master (apenas dados de exibição).
 * A SENHA NÃO FICA NO APP: é cadastrada e conferida no banco de dados.
 */
export const MASTER_ADMIN_CONFIG = {
  name: 'Eng. João Nunes da Silva',
  email: 'joao.nunues@jvmengenharia.com.br',
  role: 'responsavel_tecnico' as UserRole,
  registrationNumber: 'CREA/SP 506894123-0',
  phone: '(11) 98765-4321',
  isMasterAdmin: true,
  companyId: 'comp-jvm',
  companyName: 'JVM Engenharia & Treinamentos'
};

/** Credencial offline: prova de senha (PBKDF2) de quem já entrou neste aparelho. */
interface OfflineCredential {
  userId: string;
  logins: string[];
  salt: string;
  hash: string;
  iterations: number;
  savedAt: string;
  profile: User;
}

const OFFLINE_CREDENTIALS_KEY = 'jvm_offline_credentials';
const OFFLINE_VALIDITY_DAYS = 30;
const PBKDF2_ITERATIONS = 150000;
const DB_SESSION_PREFIX = 'jvm_db_session_';

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  arr.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function cryptoAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.crypto && !!window.crypto.subtle;
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, keyMaterial, 256);
  return toBase64(bits);
}

export class AuthService {
  private static AUTH_TOKEN_KEY = 'jvm_auth_token';
  private static CURRENT_USER_KEY = 'jvm_dielectric_current_user';

  static getMasterAdminUser(): User {
    return {
      id: 'usr-master-admin-001',
      name: MASTER_ADMIN_CONFIG.name,
      email: MASTER_ADMIN_CONFIG.email,
      role: MASTER_ADMIN_CONFIG.role,
      registrationNumber: MASTER_ADMIN_CONFIG.registrationNumber,
      phone: MASTER_ADMIN_CONFIG.phone,
      isMasterAdmin: true,
      companyId: MASTER_ADMIN_CONFIG.companyId,
      companyName: MASTER_ADMIN_CONFIG.companyName,
      customSettings: {
        defaultValidityMonths: 6,
        climateLimits: {
          tempMin: 18,
          tempMax: 28,
          humidityMax: 70
        }
      }
    };
  }

  static getAvailableCompanies(): Company[] {
    return DielectricStorageService.getCompanies();
  }

  static getAvailableUsers(companyId?: string): User[] {
    return DielectricStorageService.getUsers(companyId || 'ALL');
  }

  /**
   * Login com e-mail OU nome de usuário + senha cadastrados no banco de dados.
   * - Online: a senha é conferida no servidor (função jvm_login).
   * - Sem internet: aceita apenas quem já entrou online neste aparelho nos
   *   últimos 30 dias (prova de senha PBKDF2 guardada localmente).
   */
  static async loginAsync(
    login: string,
    password: string,
    companyId?: string,
    rememberMe: boolean = true
  ): Promise<{ success: boolean; user?: User; error?: string; source?: 'offline' | 'supabase' }> {
    const cleanLogin = (login || '').trim().toLowerCase();
    if (!cleanLogin || !password) {
      return { success: false, error: 'Informe o usuário (ou e-mail) e a senha.' };
    }

    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (online) {
      const res = await SupabaseService.authenticateWithSupabase(cleanLogin, password, companyId);
      if (res.success && res.user) {
        const user = this.applyCompany(res.user, companyId);
        await this.saveOfflineCredential(user, cleanLogin, password);
        this.setCurrentUser(user, rememberMe, true);
        return { success: true, user, source: 'supabase' };
      }
      if (!res.networkError) {
        return { success: false, error: res.error || 'Usuário ou senha inválidos.' };
      }
    }

    // Sem conexão com o banco: tenta a credencial offline deste aparelho
    const offlineUser = await this.verifyOfflineCredential(cleanLogin, password);
    if (offlineUser) {
      const user = this.applyCompany(offlineUser, companyId);
      this.setCurrentUser(user, rememberMe, true);
      return { success: true, user, source: 'offline' };
    }

    return {
      success: false,
      error: 'Sem conexão com o banco de dados. O acesso offline só é permitido para quem já entrou neste aparelho com internet nos últimos 30 dias.'
    };
  }

  private static applyCompany(user: User, companyId?: string): User {
    const targetCompId = companyId || user.companyId || 'comp-jvm';
    const comp = DielectricStorageService.getCompanyById(targetCompId);
    const { password: _pw, ...clean } = user;
    return {
      ...(clean as User),
      companyId: targetCompId,
      companyName: comp ? comp.name : user.companyName
    };
  }

  // ---------------------------------------------------------------------------
  // Credenciais offline
  // ---------------------------------------------------------------------------
  private static readOfflineCredentials(): OfflineCredential[] {
    try {
      return JSON.parse(localStorage.getItem(OFFLINE_CREDENTIALS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private static async saveOfflineCredential(user: User, typedLogin: string, password: string): Promise<void> {
    if (!cryptoAvailable()) return;
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await derivePasswordHash(password, salt, PBKDF2_ITERATIONS);
      const logins = Array.from(new Set(
        [typedLogin, user.email, user.username].filter(Boolean).map(l => String(l).trim().toLowerCase())
      ));
      const { password: _pw, ...profile } = user;
      const cred: OfflineCredential = {
        userId: user.id,
        logins,
        salt: toBase64(salt),
        hash,
        iterations: PBKDF2_ITERATIONS,
        savedAt: new Date().toISOString(),
        profile: profile as User
      };
      const others = this.readOfflineCredentials().filter(c => c.userId !== user.id);
      localStorage.setItem(OFFLINE_CREDENTIALS_KEY, JSON.stringify([cred, ...others].slice(0, 20)));
    } catch (err) {
      console.warn('Não foi possível salvar o acesso offline:', err);
    }
  }

  private static async verifyOfflineCredential(login: string, password: string): Promise<User | null> {
    if (!cryptoAvailable()) return null;
    const cred = this.readOfflineCredentials().find(c => c.logins.includes(login));
    if (!cred) return null;
    const ageDays = (Date.now() - new Date(cred.savedAt).getTime()) / 86400000;
    if (ageDays > OFFLINE_VALIDITY_DAYS) return null;
    try {
      const hash = await derivePasswordHash(password, fromBase64(cred.salt), cred.iterations);
      if (hash !== cred.hash) return null;
      const localProfile = DielectricStorageService.getUsers('ALL').find(u => u.id === cred.userId);
      if (localProfile && localProfile.active === false) return null;
      return { ...cred.profile, ...(localProfile || {}) };
    } catch {
      return null;
    }
  }

  /** Remove o acesso offline de um usuário neste aparelho. */
  static forgetOfflineCredential(userId: string): void {
    const rest = this.readOfflineCredentials().filter(c => c.userId !== userId);
    localStorage.setItem(OFFLINE_CREDENTIALS_KEY, JSON.stringify(rest));
  }

  /**
   * Sincroniza usuários e empresas com o Supabase para manter as listas atualizadas
   */
  static async syncFromSupabase(): Promise<{ usersCount: number; companiesCount: number }> {
    try {
      const res = await SupabaseService.pullFromSupabase();
      return {
        usersCount: res.pulledUsers,
        companiesCount: res.pulledCompanies
      };
    } catch (err) {
      console.warn('Erro ao sincronizar logins com Supabase:', err);
      return { usersCount: 0, companiesCount: 0 };
    }
  }

  // ---------------------------------------------------------------------------
  // Sessão
  // ---------------------------------------------------------------------------
  static getCurrentUser(): User | null {
    try {
      const raw = localStorage.getItem(this.CURRENT_USER_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error reading current user:', e);
    }
    return null;
  }

  private static getSessionToken(): string | null {
    try {
      return sessionStorage.getItem(this.AUTH_TOKEN_KEY) || localStorage.getItem(this.AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Grava o usuário da sessão. `verifiedByDatabase` só é true após a senha ser
   * conferida (online no banco ou pela credencial offline). Trocas de empresa
   * ou de perfil mantêm a sessão já autenticada.
   */
  static setCurrentUser(user: User, rememberMe: boolean = true, verifiedByDatabase: boolean = false): void {
    try {
      const { password: _pw, ...safeUser } = user;
      localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(safeUser));

      if (verifiedByDatabase) {
        const token = DB_SESSION_PREFIX + Date.now();
        localStorage.removeItem(this.AUTH_TOKEN_KEY);
        sessionStorage.removeItem(this.AUTH_TOKEN_KEY);
        if (rememberMe) localStorage.setItem(this.AUTH_TOKEN_KEY, token);
        else sessionStorage.setItem(this.AUTH_TOKEN_KEY, token);
      }

      DielectricStorageService.setCurrentUser(safeUser as User);
      if (user.companyId) {
        DielectricStorageService.setActiveCompanyById(user.companyId);
      }

      window.dispatchEvent(new CustomEvent('jvm-auth-changed', { detail: { user: safeUser } }));
      window.dispatchEvent(new Event('jvm-data-changed'));
    } catch (e) {
      console.error('Error saving current user:', e);
    }
  }

  static logout(): void {
    try {
      localStorage.removeItem(this.CURRENT_USER_KEY);
      localStorage.removeItem(this.AUTH_TOKEN_KEY);
      sessionStorage.removeItem(this.AUTH_TOKEN_KEY);
      window.dispatchEvent(new CustomEvent('jvm-auth-changed', { detail: { user: null } }));
      window.dispatchEvent(new Event('jvm-data-changed'));
    } catch (e) {
      console.error('Error logging out:', e);
    }
  }

  /**
   * Autenticado somente se a sessão foi aberta com usuário e senha conferidos
   * pelo banco. Sessões antigas (login automático/sem senha) pedem novo login.
   */
  static isAuthenticated(): boolean {
    const token = this.getSessionToken();
    return this.getCurrentUser() !== null && !!token && token.startsWith(DB_SESSION_PREFIX);
  }
}
