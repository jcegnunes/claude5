import React, { useEffect, useState } from 'react';
import { Users, UserPlus, KeyRound, Pencil, UserX, UserCheck, X, Loader2, Wifi, WifiOff } from 'lucide-react';
import { User, UserRole } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { SupabaseService } from '../services/supabaseService';
import { AuthService } from '../services/authService';
import { QuickTechnicianModal } from './QuickTechnicianModal';
import { getAssignableModules } from '../modules/workspaces';

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  responsavel_tecnico: 'Responsável Técnico',
  tecnico: 'Técnico executor',
  administrativo: 'Administrativo',
  cliente: 'Cliente (só consulta)'
};

/** Regras de senha iguais às do servidor (jvm_validate_new_password). */
export function validatePassword(password: string, confirm: string): string | null {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'A senha deve ter letras e números.';
  if (password !== confirm) return 'A confirmação não confere com a senha.';
  return null;
}

export function isValidLoginEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !e.endsWith('@sem-email.local');
}

const input = 'w-full p-2 border border-slate-300 rounded-xl bg-white text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none';
const label = 'block font-bold text-slate-700 mb-1 text-xs';

type Dialog =
  | { kind: 'create' }
  | { kind: 'password'; user: User }
  | { kind: 'edit'; user: User }
  | null;

interface CompanyUsersPanelProps {
  /** Avisa a tela de configurações para recarregar a lista (assinaturas). */
  onChange?: () => void;
}

/**
 * Usuários e técnicos da empresa (tela Configurações):
 * - usuário COM acesso ao sistema (e-mail/usuário + senha) — somente administrador, com internet;
 * - técnico executor (nome, cargo, registro, assinatura) — funciona offline; pode receber acesso depois.
 * Todos ficam vinculados à empresa de quem cadastra.
 */
export const CompanyUsersPanel: React.FC<CompanyUsersPanelProps> = ({ onChange }) => {
  const me = AuthService.getCurrentUser();
  const isAdmin = !!me && (me.role === 'admin' || !!me.isMasterAdmin);
  const canAddTechnician = isAdmin || me?.role === 'responsavel_tecnico';
  const companyId = DielectricStorageService.getActiveCompany().id;
  const companyName = DielectricStorageService.getActiveCompany().name;

  const loadUsers = () =>
    DielectricStorageService.getUsers(companyId)
      .filter(u => !(u as any).deletedAt && (u.companyId === companyId || u.id === me?.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));

  const [users, setUsers] = useState<User[]>(loadUsers);
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const reload = () => setUsers(loadUsers());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('jvm-data-changed', reload);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('jvm-data-changed', reload);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const refresh = (message?: string) => {
    setUsers(loadUsers());
    if (message) setNotice(message);
    onChange?.();
  };

  const toggleActive = (user: User) => {
    const activate = user.active === false;
    const text = activate
      ? `Reativar o acesso de ${user.name}?`
      : `Desativar ${user.name}? O acesso ao sistema é bloqueado imediatamente (os ensaios já feitos não mudam).`;
    if (!window.confirm(text)) return;
    DielectricStorageService.saveUser({ ...user, active: activate });
    refresh(activate ? `${user.name} reativado.` : `${user.name} desativado.`);
  };

  return (
    <section className="pt-3 border-t border-slate-200" aria-labelledby="usuarios-empresa-titulo">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <div>
            <h4 id="usuarios-empresa-titulo" className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Usuários e Técnicos da Empresa
            </h4>
            <p className="text-[11px] text-slate-500">
              Vinculados a <strong>{companyName || 'sua empresa'}</strong>. Técnicos executores aparecem nos ensaios e laudos; só quem tem acesso entra no sistema.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAddTechnician && (
            <button
              type="button"
              onClick={() => setIsTechModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-300 text-blue-700 bg-white hover:bg-blue-50"
            >
              <UserCheck className="w-3.5 h-3.5" /> Novo técnico executor
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setDialog({ kind: 'create' })}
              disabled={!online}
              title={online ? '' : 'Exige internet'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-3.5 h-3.5" /> Novo usuário com acesso
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <p className={`mb-2 text-[11px] flex items-center gap-1.5 ${online ? 'text-slate-500' : 'text-amber-700'}`}>
          {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {online
            ? 'Cadastro de acesso e definição de senha são feitos direto no servidor.'
            : 'Sem internet: é possível cadastrar técnicos executores; acesso e senhas exigem internet.'}
        </p>
      )}

      {notice && (
        <div className="mb-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-700" aria-label="Fechar aviso">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {users.map(user => {
          const isMe = user.id === me?.id;
          const inactive = user.active === false;
          return (
            <li key={user.id} className={`p-3 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${inactive ? 'bg-slate-100 border-slate-200 opacity-80' : 'bg-slate-50/80 border-slate-200'}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">{user.name}</span>
                  {isMe && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">Você</span>}
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                    {user.isMasterAdmin ? 'Administrador da plataforma' : ROLE_LABEL[user.role] || user.role}
                  </span>
                  {user.hasLogin ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">Com acesso</span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">Sem acesso (só nos laudos)</span>
                  )}
                  {inactive && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">Inativo</span>}
                  {user.hasLogin && user.role !== 'admin' && !user.isMasterAdmin && Array.isArray(user.allowedModules) && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200">
                      Só {getAssignableModules(DielectricStorageService.getCompanyInfo()).filter(o => user.allowedModules!.includes(o.id)).map(o => o.label).join(' + ') || 'nenhum módulo'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {[
                    user.hasLogin ? user.email : null,
                    user.hasLogin && user.username ? `usuário: ${user.username}` : null,
                    user.cargo,
                    user.creaOrCft
                  ].filter(Boolean).join(' • ') || '—'}
                </p>
              </div>

              {isAdmin && !(user.isMasterAdmin && !me?.isMasterAdmin) && (
                <div className="flex flex-wrap gap-1.5 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: 'password', user })}
                    disabled={!online}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> {user.hasLogin ? 'Trocar senha' : 'Dar acesso'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: 'edit', user })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  {!isMe && (
                    <button
                      type="button"
                      onClick={() => toggleActive(user)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${inactive ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' : 'border-red-200 text-red-700 hover:bg-red-50'} bg-white`}
                    >
                      {inactive ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                      {inactive ? 'Reativar' : 'Desativar'}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {users.length === 0 && <li className="text-xs text-slate-500">Nenhum usuário cadastrado nesta empresa.</li>}
      </ul>

      <QuickTechnicianModal
        isOpen={isTechModalOpen}
        onClose={() => setIsTechModalOpen(false)}
        onTechnicianCreated={tech => refresh(`Técnico ${tech.name} cadastrado.`)}
      />

      {dialog?.kind === 'create' && (
        <CreateUserDialog onClose={() => setDialog(null)} onDone={u => { setDialog(null); refresh(`Usuário ${u.name} cadastrado com acesso ao sistema.`); }} />
      )}
      {dialog?.kind === 'password' && (
        <PasswordDialog user={dialog.user} onClose={() => setDialog(null)} onDone={u => { setDialog(null); refresh(`Senha de ${u.name} definida.`); }} />
      )}
      {dialog?.kind === 'edit' && (
        <EditUserDialog
          user={dialog.user}
          canChangeRole={dialog.user.id !== me?.id}
          onClose={() => setDialog(null)}
          onDone={u => { setDialog(null); refresh(`Dados de ${u.name} atualizados.`); }}
        />
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------
const DialogShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60" role="dialog" aria-modal="true" aria-label={title}>
    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
      <div className="px-5 py-3 bg-[#0A2540] text-white rounded-t-2xl flex items-center justify-between">
        <h3 className="font-bold text-sm">{title}</h3>
        <button type="button" onClick={onClose} className="p-1 text-slate-300 hover:text-white" aria-label="Fechar">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto">{children}</div>
    </div>
  </div>
);

/** Valor do formulário -> cadastro: todos marcados = null (inclui módulos futuros). */
function modulesToValue(selected: string[], options: Array<{ id: string }>): string[] | null {
  return options.every(o => selected.includes(o.id)) ? null : selected;
}

/** Módulos do sistema que o usuário pode usar (administrador: todos). */
const ModuleAccessField: React.FC<{ role: UserRole; selected: string[]; onChange: (ids: string[]) => void }> = ({ role, selected, onChange }) => {
  const options = getAssignableModules(DielectricStorageService.getCompanyInfo());
  if (role === 'admin') {
    return <p className="text-[11px] text-slate-500 sm:col-span-2">Administrador acessa todos os módulos do sistema.</p>;
  }
  return (
    <fieldset className="sm:col-span-2">
      <legend className={label}>Módulos com acesso *</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const on = selected.includes(o.id);
          return (
            <label key={o.id} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${on ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-slate-300 text-slate-600'}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={e => onChange(e.target.checked ? [...selected, o.id] : selected.filter(id => id !== o.id))}
              />
              {o.label}
            </label>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 mt-1">O usuário só vê e só grava dados dos módulos marcados.</p>
    </fieldset>
  );
};

/** Módulos marcados no formulário a partir do cadastro (null = todos). */
function initialModules(user?: User): string[] {
  const all = getAssignableModules(DielectricStorageService.getCompanyInfo()).map(o => o.id);
  return Array.isArray(user?.allowedModules) ? user!.allowedModules!.filter(id => all.includes(id)) : all;
}

const ErrorBox: React.FC<{ message: string | null }> = ({ message }) =>
  message ? <p className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs" role="alert">{message}</p> : null;

const CreateUserDialog: React.FC<{ onClose: () => void; onDone: (u: User) => void }> = ({ onClose, onDone }) => {
  const [form, setForm] = useState({ name: '', email: '', username: '', role: 'tecnico' as UserRole, cargo: '', registration: '', phone: '', password: '', confirm: '' });
  const [modules, setModules] = useState<string[]>(() => initialModules());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Informe o nome.');
    if (!isValidLoginEmail(form.email)) return setError('Informe um e-mail válido (ele será usado no login).');
    if (form.username && !/^[a-z0-9._-]{3,40}$/i.test(form.username.trim())) return setError('Nome de usuário: de 3 a 40 letras, números, ponto, hífen ou sublinhado.');
    const pwdError = validatePassword(form.password, form.confirm);
    if (pwdError) return setError(pwdError);
    if (form.role !== 'admin' && modules.length === 0) return setError('Marque pelo menos um módulo do sistema.');
    setSaving(true);
    setError(null);
    const res = await SupabaseService.adminCreateUser({
      name: form.name.trim(),
      email: form.email.trim(),
      username: form.username.trim() || undefined,
      role: form.role,
      password: form.password,
      cargo: form.cargo.trim() || undefined,
      registration: form.registration.trim() || undefined,
      phone: form.phone.trim() || undefined
    });
    setSaving(false);
    if (!res.success || !res.user) return setError(res.error || 'Não foi possível cadastrar.');
    const allowed = form.role === 'admin' ? null : modulesToValue(modules, getAssignableModules(DielectricStorageService.getCompanyInfo()));
    if (allowed) {
      // restrição gravada no cadastro e enviada ao servidor
      const saved = DielectricStorageService.saveUser({ ...res.user, allowedModules: allowed });
      return onDone(saved);
    }
    onDone(res.user);
  };

  return (
    <DialogShell title="Novo usuário com acesso ao sistema" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="nu-nome">Nome completo *</label>
            <input id="nu-nome" className={input} value={form.name} onChange={set('name')} autoFocus />
          </div>
          <div>
            <label className={label} htmlFor="nu-email">E-mail (login) *</label>
            <input id="nu-email" type="email" className={input} value={form.email} onChange={set('email')} autoComplete="off" />
          </div>
          <div>
            <label className={label} htmlFor="nu-usuario">Nome de usuário (opcional)</label>
            <input id="nu-usuario" className={input} value={form.username} onChange={set('username')} autoComplete="off" placeholder="ex.: maria.souza" />
          </div>
          <div>
            <label className={label} htmlFor="nu-perfil">Perfil *</label>
            <select id="nu-perfil" className={input} value={form.role} onChange={set('role')}>
              <option value="tecnico">{ROLE_LABEL.tecnico}</option>
              <option value="responsavel_tecnico">{ROLE_LABEL.responsavel_tecnico}</option>
              <option value="administrativo">{ROLE_LABEL.administrativo}</option>
              <option value="admin">{ROLE_LABEL.admin}</option>
              <option value="cliente">{ROLE_LABEL.cliente}</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="nu-cargo">Cargo</label>
            <input id="nu-cargo" className={input} value={form.cargo} onChange={set('cargo')} placeholder="ex.: Técnico em Eletrotécnica" />
          </div>
          <div>
            <label className={label} htmlFor="nu-registro">Registro CREA/CFT</label>
            <input id="nu-registro" className={input} value={form.registration} onChange={set('registration')} />
          </div>
          <div>
            <label className={label} htmlFor="nu-telefone">Telefone</label>
            <input id="nu-telefone" className={input} value={form.phone} onChange={set('phone')} />
          </div>
          <div>
            <label className={label} htmlFor="nu-senha">Senha inicial *</label>
            <input id="nu-senha" type="password" className={input} value={form.password} onChange={set('password')} autoComplete="new-password" />
          </div>
          <div>
            <label className={label} htmlFor="nu-confirma">Confirmar senha *</label>
            <input id="nu-confirma" type="password" className={input} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
          </div>
          <ModuleAccessField role={form.role} selected={modules} onChange={setModules} />
        </div>
        <p className="text-[11px] text-slate-500">Mínimo de 8 caracteres, com letras e números. Informe a senha ao usuário por um canal seguro.</p>
        <ErrorBox message={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700">Cancelar</button>
          <button type="submit" disabled={saving} className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 inline-flex items-center gap-1.5">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Cadastrar usuário
          </button>
        </div>
      </form>
    </DialogShell>
  );
};

const PasswordDialog: React.FC<{ user: User; onClose: () => void; onDone: (u: User) => void }> = ({ user, onClose, onDone }) => {
  const needsEmail = !user.hasLogin;
  const [email, setEmail] = useState(isValidLoginEmail(user.email || '') ? user.email : '');
  const [username, setUsername] = useState(user.username || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsEmail && !isValidLoginEmail(email)) return setError('Informe um e-mail válido para o login.');
    if (needsEmail && username && !/^[a-z0-9._-]{3,40}$/i.test(username.trim())) return setError('Nome de usuário: de 3 a 40 letras, números, ponto, hífen ou sublinhado.');
    const pwdError = validatePassword(password, confirm);
    if (pwdError) return setError(pwdError);
    setSaving(true);
    setError(null);
    const res = await SupabaseService.adminSetPassword(user.id, password, needsEmail ? email.trim() : undefined, needsEmail ? username.trim() || undefined : undefined);
    setSaving(false);
    if (!res.success || !res.user) return setError(res.error || 'Não foi possível definir a senha.');
    onDone(res.user);
  };

  return (
    <DialogShell title={user.hasLogin ? `Trocar senha — ${user.name}` : `Dar acesso ao sistema — ${user.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        {needsEmail ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="ps-email">E-mail (login) *</label>
              <input id="ps-email" type="email" className={input} value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            </div>
            <div>
              <label className={label} htmlFor="ps-usuario">Nome de usuário (opcional)</label>
              <input id="ps-usuario" className={input} value={username} onChange={e => setUsername(e.target.value)} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600">Login: <strong>{user.email}</strong>{user.username ? ` (usuário ${user.username})` : ''}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="ps-senha">Nova senha *</label>
            <input id="ps-senha" type="password" className={input} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" autoFocus={!needsEmail} />
          </div>
          <div>
            <label className={label} htmlFor="ps-confirma">Confirmar senha *</label>
            <input id="ps-confirma" type="password" className={input} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Mínimo de 8 caracteres, com letras e números. {user.active === false ? 'O usuário também será reativado.' : ''}</p>
        <ErrorBox message={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700">Cancelar</button>
          <button type="submit" disabled={saving} className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 inline-flex items-center gap-1.5">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {user.hasLogin ? 'Trocar senha' : 'Dar acesso'}
          </button>
        </div>
      </form>
    </DialogShell>
  );
};

const EditUserDialog: React.FC<{ user: User; canChangeRole: boolean; onClose: () => void; onDone: (u: User) => void }> = ({ user, canChangeRole, onClose, onDone }) => {
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email?.endsWith('@sem-email.local') ? '' : user.email || '',
    role: user.role,
    cargo: user.cargo || '',
    creaOrCft: user.creaOrCft || '',
    phone: user.phone || ''
  });
  const [modules, setModules] = useState<string[]>(() => initialModules(user));
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Informe o nome.');
    if (!user.hasLogin && form.email && !isValidLoginEmail(form.email)) return setError('E-mail inválido.');
    const role = canChangeRole ? form.role : user.role;
    if (role !== 'admin' && modules.length === 0) return setError('Marque pelo menos um módulo do sistema.');
    const updated: User = {
      ...user,
      name: form.name.trim(),
      // e-mail de login só muda por "Trocar senha"/"Dar acesso"
      email: user.hasLogin ? user.email : (form.email.trim() || user.email),
      role: canChangeRole ? form.role : user.role,
      cargo: form.cargo.trim() || undefined,
      creaOrCft: form.creaOrCft.trim() || undefined,
      registrationNumber: form.creaOrCft.trim() || user.registrationNumber,
      phone: form.phone.trim() || undefined,
      allowedModules: role === 'admin' ? null : modulesToValue(modules, getAssignableModules(DielectricStorageService.getCompanyInfo()))
    };
    DielectricStorageService.saveUser(updated);
    onDone(updated);
  };

  return (
    <DialogShell title={`Editar — ${user.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="ed-nome">Nome completo *</label>
            <input id="ed-nome" className={input} value={form.name} onChange={set('name')} autoFocus />
          </div>
          <div>
            <label className={label} htmlFor="ed-email">E-mail</label>
            <input id="ed-email" type="email" className={input} value={form.email} onChange={set('email')} disabled={user.hasLogin} />
            {user.hasLogin && <p className="text-[10px] text-slate-500 mt-0.5">E-mail de login: altere em "Trocar senha".</p>}
          </div>
          <div>
            <label className={label} htmlFor="ed-perfil">Perfil</label>
            <select id="ed-perfil" className={input} value={form.role} onChange={set('role')} disabled={!canChangeRole}>
              {(Object.keys(ROLE_LABEL) as UserRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            {!canChangeRole && <p className="text-[10px] text-slate-500 mt-0.5">Você não pode alterar o próprio perfil.</p>}
          </div>
          <div>
            <label className={label} htmlFor="ed-cargo">Cargo</label>
            <input id="ed-cargo" className={input} value={form.cargo} onChange={set('cargo')} />
          </div>
          <div>
            <label className={label} htmlFor="ed-registro">Registro CREA/CFT</label>
            <input id="ed-registro" className={input} value={form.creaOrCft} onChange={set('creaOrCft')} />
          </div>
          <div>
            <label className={label} htmlFor="ed-telefone">Telefone</label>
            <input id="ed-telefone" className={input} value={form.phone} onChange={set('phone')} />
          </div>
          {user.hasLogin && <ModuleAccessField role={canChangeRole ? form.role : user.role} selected={modules} onChange={setModules} />}
        </div>
        <ErrorBox message={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700">Cancelar</button>
          <button type="submit" className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-700 text-white hover:bg-blue-800">Salvar</button>
        </div>
      </form>
    </DialogShell>
  );
};
