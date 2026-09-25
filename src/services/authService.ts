import { User, UserRole, Company } from '../types';
import { DielectricStorageService } from './syncEngine';
import { SupabaseService } from './supabaseService';

export const MASTER_ADMIN_CONFIG = {
  name: 'Eng. João Nunes da Silva',
  email: 'joao.nunues@jvmengenharia.com.br',
  password: 'Jvm@141519',
  role: 'responsavel_tecnico' as UserRole,
  registrationNumber: 'CREA/SP 506894123-0',
  phone: '(11) 98765-4321',
  isMasterAdmin: true,
  companyId: 'comp-jvm',
  companyName: 'JVM Engenharia & Treinamentos'
};

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
    const allUsers = DielectricStorageService.getUsers(companyId || 'ALL');
    return allUsers;
  }

  static login(
    email: string, 
    password: string, 
    companyId?: string, 
    rememberMe: boolean = true
  ): { success: boolean; user?: User; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // Check Master Admin (Support both nunues and nunes)
    if (
      (cleanEmail === 'joao.nunues@jvmengenharia.com.br' || cleanEmail === 'joao.nunes@jvmengenharia.com.br' || cleanEmail === 'admin@jvm.com') &&
      cleanPass === MASTER_ADMIN_CONFIG.password
    ) {
      const masterUser = this.getMasterAdminUser();
      if (companyId) {
        masterUser.companyId = companyId;
        const comp = DielectricStorageService.getCompanyById(companyId);
        if (comp) masterUser.companyName = comp.name;
      }
      this.setCurrentUser(masterUser, rememberMe);
      return { success: true, user: masterUser };
    }

    // Check against local database users
    const allUsers = DielectricStorageService.getUsers('ALL');
    const foundUser = allUsers.find(u => u.email.toLowerCase() === cleanEmail);

    if (foundUser) {
      // Check if user is active
      if (foundUser.active === false) {
        return {
          success: false,
          error: 'Este usuário está inativado no sistema. Contate o Administrador.'
        };
      }

      // Senha do próprio usuário (removidas as senhas universais que abriam
      // QUALQUER conta). Usuários antigos sem senha cadastrada continuam
      // entrando até que o administrador defina uma senha.
      const validPass = !foundUser.password || foundUser.password === cleanPass;

      if (validPass) {
        // If companyId was selected in UI, and user is allowed (e.g. MasterAdmin or company matches)
        const targetCompanyId = companyId || foundUser.companyId || 'comp-jvm';
        const targetCompany = DielectricStorageService.getCompanyById(targetCompanyId);

        const authenticatedUser: User = {
          ...foundUser,
          companyId: targetCompanyId,
          companyName: targetCompany?.name || foundUser.companyName || 'JVM Engenharia & Treinamentos'
        };

        this.setCurrentUser(authenticatedUser, rememberMe);
        return { success: true, user: authenticatedUser };
      }
    }

    return {
      success: false,
      error: 'E-mail ou senha incorretos. Verifique suas credenciais de acesso.'
    };
  }

  /**
   * Login assíncrono com suporte híbrido: local primeiro + Supabase Cloud se necessário
   */
  static async loginAsync(
    email: string, 
    password: string, 
    companyId?: string, 
    rememberMe: boolean = true
  ): Promise<{ success: boolean; user?: User; error?: string; source?: 'local' | 'supabase' }> {
    // 1. Tentar autenticação local offline-first imediata
    const localResult = this.login(email, password, companyId, rememberMe);
    if (localResult.success) {
      return { ...localResult, source: 'local' };
    }

    // 2. Se falhar ou o usuário não estiver em cache local, consultar Supabase Cloud
    try {
      const supabaseResult = await SupabaseService.authenticateWithSupabase(email, password, companyId);
      if (supabaseResult.success && supabaseResult.user) {
        this.setCurrentUser(supabaseResult.user, rememberMe);
        return { success: true, user: supabaseResult.user, source: 'supabase' };
      } else if (supabaseResult.error && !supabaseResult.error.includes('não localizado')) {
        return { success: false, error: supabaseResult.error };
      }
    } catch (err: any) {
      console.warn('Tentativa de autenticação Supabase falhou:', err);
    }

    // Retorna erro padrão se nenhuma tentativa obteve sucesso
    return localResult;
  }

  /**
   * Sincroniza usuários e empresas com o Supabase Cloud para manter dropdowns e credenciais atualizadas
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

  static quickLogin(user: User, companyId?: string): { success: boolean; user: User } {
    const targetCompId = companyId || user.companyId || 'comp-jvm';
    const comp = DielectricStorageService.getCompanyById(targetCompId);
    const updatedUser: User = {
      ...user,
      companyId: targetCompId,
      companyName: comp ? comp.name : user.companyName
    };
    this.setCurrentUser(updatedUser, true);
    return { success: true, user: updatedUser };
  }

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

  static setCurrentUser(user: User, rememberMe: boolean = true): void {
    try {
      localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(user));
      localStorage.setItem(this.AUTH_TOKEN_KEY, 'jvm_session_' + Date.now());
      
      // Update active user in SyncEngine and set active company
      DielectricStorageService.setCurrentUser(user);
      if (user.companyId) {
        DielectricStorageService.setActiveCompanyById(user.companyId);
      }

      // Dispatch custom event to notify components
      window.dispatchEvent(new CustomEvent('jvm-auth-changed', { detail: { user } }));
      window.dispatchEvent(new Event('jvm-data-changed'));
    } catch (e) {
      console.error('Error saving current user:', e);
    }
  }

  static logout(): void {
    try {
      localStorage.removeItem(this.CURRENT_USER_KEY);
      localStorage.removeItem(this.AUTH_TOKEN_KEY);
      window.dispatchEvent(new CustomEvent('jvm-auth-changed', { detail: { user: null } }));
      window.dispatchEvent(new Event('jvm-data-changed'));
    } catch (e) {
      console.error('Error logging out:', e);
    }
  }

  static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }
}
