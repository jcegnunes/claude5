/**
 * Troca de usuário: exige a senha do usuário escolhido. A senha é conferida
 * como no login (Supabase Auth; sem internet, só quem já entrou neste
 * aparelho) e a sessão do banco passa a ser a do novo usuário.
 */
import React, { useState } from 'react';
import { Loader2, Lock, X, Eye, EyeOff, UserCircle2 } from 'lucide-react';
import type { User } from '../types';
import { AuthService } from '../services/authService';
import { DielectricStorageService } from '../services/syncEngine';

/** Usuários da empresa que podem entrar no sistema (têm acesso e estão ativos). */
export function switchableUsers(current: User): User[] {
  return DielectricStorageService.getUsers()
    .filter(u => u.id !== current.id && u.hasLogin && u.active !== false && !(u as any).deletedAt
      && (!current.companyId || u.companyId === current.companyId))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
}

interface SwitchUserDialogProps {
  currentUser: User;
  /** Usuário já escolhido; sem ele, a janela mostra a lista para escolher */
  target?: User | null;
  onClose: () => void;
  onSwitched: (user: User) => void;
}

export const SwitchUserDialog: React.FC<SwitchUserDialogProps> = ({ currentUser, target: initialTarget, onClose, onSwitched }) => {
  const [target, setTarget] = useState<User | null>(initialTarget || null);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const candidates = switchableUsers(currentUser);
  const login = target ? (target.username || target.email || '') : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    if (!password) return setError('Digite a senha do usuário.');
    setBusy(true);
    setError(null);
    try {
      const res = await AuthService.loginAsync(login, password, undefined, true);
      if (!res.success || !res.user) {
        setError(res.error || 'Senha incorreta.');
        setPassword('');
        return;
      }
      DielectricStorageService.addAuditLog('LOGIN', 'Usuário', res.user.id, `Troca de usuário: ${currentUser.name} → ${res.user.name}`);
      onSwitched(res.user);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível trocar de usuário.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60" role="dialog" aria-modal="true" aria-label="Trocar de usuário" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 text-slate-800" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 bg-[#0A2540] text-white rounded-t-2xl flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2"><Lock className="w-4 h-4" /> Trocar de usuário</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-300 hover:text-white" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>

        {!target ? (
          <div className="p-4">
            <p className="text-xs text-slate-500 mb-2">Escolha o usuário. A senha dele será pedida em seguida.</p>
            {candidates.length === 0 ? (
              <p className="text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl p-4 text-center">Nenhum outro usuário com acesso nesta empresa.</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {candidates.map(u => (
                  <button key={u.id} type="button" onClick={() => setTarget(u)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center gap-2">
                    <UserCircle2 className="w-5 h-5 text-slate-400 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-900 truncate">{u.name}</span>
                      <span className="block text-[10px] text-slate-500 truncate">{u.cargo || u.role} · {u.username || u.email}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3" noValidate>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
              <UserCircle2 className="w-8 h-8 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{target.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{login}</p>
              </div>
            </div>
            <label className="block">
              <span className="block font-bold text-slate-700 mb-1 text-xs">Senha de {target.name.split(' ')[0]}</span>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className="w-full p-2 pr-9 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>
            {error && <p className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs" role="alert">{error}</p>}
            <div className="flex justify-between gap-2 pt-1">
              {!initialTarget
                ? <button type="button" onClick={() => { setTarget(null); setPassword(''); setError(null); }} className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700">Voltar</button>
                : <span />}
              <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 inline-flex items-center gap-1.5">
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Entrar como {target.name.split(' ')[0]}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
