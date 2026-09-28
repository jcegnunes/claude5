import React, { useState } from 'react';
import { Company, User } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { AuthService } from '../services/authService';
import { lookupCnpj, formatCnpj, isValidCnpj } from '../services/cnpjService';
import { lookupCep } from '../services/addressService';

interface CompanySetupViewProps {
  user: User;
  onComplete: (user: User) => void;
  onLogout: () => void;
}

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

/**
 * Primeiro acesso: o usuário cadastra a própria empresa/laboratório.
 * Os dados vão para o banco (Supabase) e passam a aparecer no sistema,
 * nos laudos e nos certificados.
 */
export const CompanySetupView: React.FC<CompanySetupViewProps> = ({ user, onComplete, onLogout }) => {
  const [form, setForm] = useState({
    cnpj: '',
    legalName: '',
    name: '',
    inscricaoEstadual: '',
    creaCompanyRegister: '',
    cep: '',
    address: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    rtName: '',
    rtRegistry: ''
  });
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSearchCnpj = async () => {
    setMessage(null);
    setIsSearchingCnpj(true);
    try {
      const res = await lookupCnpj(form.cnpj);
      if (!res.success || !res.data) {
        setMessage({ type: 'error', text: res.error || 'CNPJ não encontrado. Preencha os dados manualmente.' });
        return;
      }
      const d = res.data;
      setForm(f => ({
        ...f,
        cnpj: d.cnpjFormatted || f.cnpj,
        legalName: d.razaoSocial || f.legalName,
        name: d.nomeFantasia || f.name || d.razaoSocial,
        cep: d.cep || f.cep,
        address: d.logradouro || f.address,
        number: d.numero || f.number,
        neighborhood: d.bairro || f.neighborhood,
        city: d.municipio || f.city,
        state: d.uf || f.state,
        phone: d.telefone || f.phone,
        email: d.email || f.email
      }));
      setMessage({ type: 'info', text: 'Dados preenchidos a partir da Receita Federal. Confira antes de salvar.' });
    } catch {
      setMessage({ type: 'error', text: 'Não foi possível consultar o CNPJ agora. Preencha os dados manualmente.' });
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleCepBlur = async () => {
    if (form.cep.replace(/\D/g, '').length !== 8) return;
    try {
      const r = await lookupCep(form.cep);
      if (r) {
        setForm(f => ({
          ...f,
          address: f.address || r.logradouro,
          neighborhood: f.neighborhood || r.bairro || '',
          city: f.city || r.localidade,
          state: f.state || r.uf
        }));
      }
    } catch {}
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const cnpj = form.cnpj.trim();
    if (!form.legalName.trim()) {
      setMessage({ type: 'error', text: 'Informe a razão social da empresa.' });
      return;
    }
    if (!isValidCnpj(cnpj)) {
      setMessage({ type: 'error', text: 'CNPJ inválido. Confira os 14 dígitos.' });
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const companyId = 'comp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const company: Company = {
        id: companyId,
        name: form.name.trim() || form.legalName.trim(),
        legalName: form.legalName.trim(),
        tradeName: form.name.trim() || undefined,
        cnpj: formatCnpj(cnpj),
        inscricaoEstadual: form.inscricaoEstadual.trim() || undefined,
        creaCompanyRegister: form.creaCompanyRegister.trim() || undefined,
        address: form.address.trim() || undefined,
        number: form.number.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state || undefined,
        cep: form.cep.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        active: true,
        technicalResponsible: form.rtName.trim()
          ? { name: form.rtName.trim(), title: 'Responsável Técnico', creaNumber: form.rtRegistry.trim(), rnp: '' }
          : undefined,
        createdAt: now,
        updatedAt: now
      };

      // 1. Empresa (vai para o banco) e dados do laboratório usados em laudos/certificados
      const saved = DielectricStorageService.saveCompany(company);
      DielectricStorageService.setActiveCompany(saved);
      DielectricStorageService.saveCompanyInfo({
        ...DielectricStorageService.getCompanyInfo(),
        name: saved.name,
        legalName: saved.legalName,
        cnpj: saved.cnpj,
        creaCompanyRegister: saved.creaCompanyRegister || '',
        address: saved.address || '',
        number: saved.number || '',
        neighborhood: saved.neighborhood || '',
        city: saved.city || '',
        state: saved.state || '',
        cep: saved.cep || '',
        cityState: [saved.city, saved.state].filter(Boolean).join(' - ') + (saved.cep ? `, CEP: ${saved.cep}` : ''),
        phone: saved.phone || '',
        email: saved.email || '',
        technicalResponsible: saved.technicalResponsible || { name: '', title: '', creaNumber: '', rnp: '' }
      });

      // 2. Vincula o usuário à empresa (também enviado ao banco)
      const updatedUser: User = { ...user, companyId: saved.id, companyName: saved.name };
      DielectricStorageService.saveUser(updatedUser);
      AuthService.setCurrentUser(updatedUser, true, false);

      onComplete(updatedUser);
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Não foi possível salvar a empresa.' });
      setIsSaving(false);
    }
  };

  const input =
    'w-full h-10 px-3 rounded-md border border-[#CBD2DA] bg-white text-[14px] text-[#1D2733] ' +
    'placeholder:text-[#98A2AE] focus:outline-none focus:border-[#1D2733] focus:ring-2 focus:ring-[#1D2733]/15';
  const label = 'block text-[13px] font-medium text-[#1D2733] mb-1.5';

  return (
    <div className="min-h-screen bg-[#EEF1F4] flex justify-center px-4 py-10">
      <main className="w-full max-w-[640px]">
        <div className="bg-white border border-[#DCE1E7] rounded-[10px] px-6 sm:px-8 pt-8 pb-7">
          <header className="mb-7">
            <h1 className="text-[20px] font-semibold text-[#1D2733]">Cadastre sua empresa</h1>
            <p className="text-[14px] leading-relaxed text-[#5E6A78] mt-1">
              Olá, {user.name?.split(' ')[0] || 'bem-vindo'}. Estes dados aparecem nos laudos, certificados e etiquetas.
              Você pode alterá-los depois em Configurações.
            </p>
          </header>

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <section className="space-y-4">
              <div>
                <label htmlFor="cs-cnpj" className={label}>CNPJ</label>
                <div className="flex gap-2">
                  <input id="cs-cnpj" inputMode="numeric" value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0000-00" className={input} />
                  <button
                    type="button"
                    onClick={handleSearchCnpj}
                    disabled={isSearchingCnpj || form.cnpj.replace(/\D/g, '').length !== 14}
                    className="h-10 px-4 rounded-md border border-[#CBD2DA] text-[14px] font-medium text-[#1D2733] hover:bg-[#F4F6F8] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                  >
                    {isSearchingCnpj ? 'Buscando…' : 'Buscar dados'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="cs-razao" className={label}>Razão social</label>
                  <input id="cs-razao" value={form.legalName} onChange={set('legalName')} className={input} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="cs-fantasia" className={label}>Nome fantasia</label>
                  <input id="cs-fantasia" value={form.name} onChange={set('name')} placeholder="Como a empresa aparece nos documentos" className={input} />
                </div>
                <div>
                  <label htmlFor="cs-ie" className={label}>Inscrição estadual <span className="font-normal text-[#5E6A78]">(opcional)</span></label>
                  <input id="cs-ie" value={form.inscricaoEstadual} onChange={set('inscricaoEstadual')} className={input} />
                </div>
                <div>
                  <label htmlFor="cs-crea" className={label}>Registro CREA da empresa <span className="font-normal text-[#5E6A78]">(opcional)</span></label>
                  <input id="cs-crea" value={form.creaCompanyRegister} onChange={set('creaCompanyRegister')} className={input} />
                </div>
              </div>
            </section>

            <section className="space-y-4 pt-5 border-t border-[#E6EAEE]">
              <h2 className="text-[14px] font-semibold text-[#1D2733]">Endereço e contato</h2>
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-6 sm:col-span-2">
                  <label htmlFor="cs-cep" className={label}>CEP</label>
                  <input id="cs-cep" inputMode="numeric" value={form.cep} onChange={set('cep')} onBlur={handleCepBlur} placeholder="00000-000" className={input} />
                </div>
                <div className="col-span-6 sm:col-span-4">
                  <label htmlFor="cs-end" className={label}>Endereço</label>
                  <input id="cs-end" value={form.address} onChange={set('address')} className={input} />
                </div>
                <div className="col-span-2">
                  <label htmlFor="cs-num" className={label}>Número</label>
                  <input id="cs-num" value={form.number} onChange={set('number')} className={input} />
                </div>
                <div className="col-span-4">
                  <label htmlFor="cs-bairro" className={label}>Bairro</label>
                  <input id="cs-bairro" value={form.neighborhood} onChange={set('neighborhood')} className={input} />
                </div>
                <div className="col-span-4">
                  <label htmlFor="cs-cidade" className={label}>Cidade</label>
                  <input id="cs-cidade" value={form.city} onChange={set('city')} className={input} />
                </div>
                <div className="col-span-2">
                  <label htmlFor="cs-uf" className={label}>UF</label>
                  <select id="cs-uf" value={form.state} onChange={set('state')} className={input}>
                    <option value=""></option>
                    {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="cs-tel" className={label}>Telefone</label>
                  <input id="cs-tel" inputMode="tel" value={form.phone} onChange={set('phone')} className={input} />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor="cs-email" className={label}>E-mail</label>
                  <input id="cs-email" type="email" value={form.email} onChange={set('email')} className={input} />
                </div>
              </div>
            </section>

            <section className="space-y-4 pt-5 border-t border-[#E6EAEE]">
              <h2 className="text-[14px] font-semibold text-[#1D2733]">
                Responsável técnico <span className="font-normal text-[#5E6A78]">(opcional)</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cs-rt" className={label}>Nome</label>
                  <input id="cs-rt" value={form.rtName} onChange={set('rtName')} className={input} />
                </div>
                <div>
                  <label htmlFor="cs-rtreg" className={label}>Registro CREA / CFT</label>
                  <input id="cs-rtreg" value={form.rtRegistry} onChange={set('rtRegistry')} className={input} />
                </div>
              </div>
            </section>

            {message && (
              <p
                role={message.type === 'error' ? 'alert' : 'status'}
                className={
                  message.type === 'error'
                    ? 'text-[13px] text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] rounded-md px-3 py-2'
                    : 'text-[13px] text-[#1D2733] bg-[#F4F6F8] border border-[#DCE1E7] rounded-md px-3 py-2'
                }
              >
                {message.text}
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={onLogout}
                className="text-[13px] text-[#5E6A78] hover:text-[#1D2733] underline underline-offset-4 decoration-[#CBD2DA] cursor-pointer self-center"
              >
                Sair
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="h-11 px-6 rounded-md bg-[#D9480F] hover:bg-[#C23F0C] text-white text-[15px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D9480F]"
              >
                {isSaving ? 'Salvando…' : 'Salvar e continuar'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
