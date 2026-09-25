import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { AuthService } from '../services/authService';
import { DielectricStorageService } from '../services/syncEngine';
import { User } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

/** Dados fixos exibidos na tela de acesso. */
const EMPRESA = {
  nome: 'JVM Engenharia',
  cnpj: '29.894.500/0001-04'
};

/**
 * Tela de acesso simplificada: usuário, senha e recuperação de senha.
 * O usuário e a senha são conferidos no banco de dados (Supabase).
 */
export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);

  const adminEmail = (() => {
    try {
      return DielectricStorageService.getCompanyInfo().email || 'laboratorio@jvmengenharia.com.br';
    } catch {
      return 'laboratorio@jvmengenharia.com.br';
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      // A empresa é a do próprio usuário cadastrada no banco
      const result = await AuthService.loginAsync(login, password, undefined, true);
      if (result.success && result.user) {
        onLoginSuccess(result.user);
        return;
      }
      setErrorMessage(result.error || 'Usuário ou senha inválidos.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Não foi possível entrar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetMailto = () => {
    const subject = encodeURIComponent('Redefinição de senha - JVM Dielectric Lab');
    const body = encodeURIComponent(
      `Olá,\n\nSolicito a redefinição da minha senha de acesso.\n\nUsuário: ${login.trim() || '(informe seu usuário ou e-mail)'}\n\nObrigado.`
    );
    return `mailto:${adminEmail}?subject=${subject}&body=${body}`;
  };

  const inputClass =
    'w-full h-11 px-3 rounded-md border border-[#CBD2DA] bg-white text-[15px] text-[#1D2733] ' +
    'placeholder:text-[#98A2AE] focus:outline-none focus:border-[#1D2733] focus:ring-2 focus:ring-[#1D2733]/15 transition-colors';

  return (
    <div className="min-h-screen bg-[#EEF1F4] flex items-center justify-center px-4 py-10">
      <main className="w-full max-w-[360px]">
        <div className="bg-white border border-[#DCE1E7] rounded-[10px] px-7 pt-8 pb-7">
          {/* Identificação da empresa */}
          <header className="flex items-center gap-3 mb-8">
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-md bg-[#D9480F] text-white flex items-center justify-center text-[13px] font-bold tracking-tight shrink-0"
            >
              JVM
            </div>
            <div className="min-w-0">
              <h1 className="text-[18px] leading-tight font-semibold text-[#1D2733]">{EMPRESA.nome}</h1>
              <p className="text-[13px] text-[#5E6A78] tabular-nums">CNPJ {EMPRESA.cnpj}</p>
            </div>
          </header>

          {!showForgot ? (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="login-usuario" className="block text-[13px] font-medium text-[#1D2733] mb-1.5">
                  Usuário
                </label>
                <input
                  id="login-usuario"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="E-mail ou nome de usuário"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="login-senha" className="block text-[13px] font-medium text-[#1D2733] mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="login-senha"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-[#5E6A78] hover:text-[#1D2733] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D2733]/30 rounded-r-md cursor-pointer"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <p role="alert" className="text-[13px] leading-snug text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] rounded-md px-3 py-2">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading || !login.trim() || !password}
                className="w-full h-11 rounded-md bg-[#D9480F] hover:bg-[#C23F0C] text-white text-[15px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D9480F] cursor-pointer"
              >
                {isLoading ? 'Entrando…' : 'Entrar'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setErrorMessage(null); }}
                  className="text-[13px] text-[#5E6A78] hover:text-[#1D2733] underline underline-offset-4 decoration-[#CBD2DA] hover:decoration-[#1D2733] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D2733]/30 rounded-sm cursor-pointer"
                >
                  Esqueci minha senha
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <h2 className="text-[15px] font-semibold text-[#1D2733]">Redefinir senha</h2>
              <p className="text-[14px] leading-relaxed text-[#5E6A78]">
                As senhas são cadastradas pelo administrador do sistema. Envie o pedido e você
                receberá uma nova senha de acesso.
              </p>
              <div>
                <label htmlFor="reset-usuario" className="block text-[13px] font-medium text-[#1D2733] mb-1.5">
                  Usuário
                </label>
                <input
                  id="reset-usuario"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="E-mail ou nome de usuário"
                  className={inputClass}
                />
              </div>
              <a
                href={resetMailto()}
                className="w-full h-11 rounded-md bg-[#D9480F] hover:bg-[#C23F0C] text-white text-[15px] font-semibold transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D9480F]"
              >
                Enviar pedido por e-mail
              </a>
              <p className="text-[12px] text-[#5E6A78] text-center">
                Ou escreva para <span className="text-[#1D2733]">{adminEmail}</span>
              </p>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="text-[13px] text-[#5E6A78] hover:text-[#1D2733] underline underline-offset-4 decoration-[#CBD2DA] hover:decoration-[#1D2733] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D2733]/30 rounded-sm cursor-pointer"
                >
                  Voltar para o login
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
