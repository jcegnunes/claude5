import React, { useState, useRef } from 'react';
import { UserCheck, X, User as UserIcon, Mail, Phone, Award, Check, Upload, Image as ImageIcon, Trash2, PenTool } from 'lucide-react';
import { User, UserRole } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { cleanSignatureImage } from '../utils/signatureCleaner';

interface QuickTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTechnicianCreated: (newTech: User) => void;
}

export const QuickTechnicianModal: React.FC<QuickTechnicianModalProps> = ({
  isOpen,
  onClose,
  onTechnicianCreated
}) => {
  const [name, setName] = useState('');
  const [cargo, setCargo] = useState('Analista Executor');
  const [role, setRole] = useState<UserRole>('tecnico');
  const [creaOrCft, setCreaOrCft] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signatureUrl, setSignatureUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Selecione um arquivo de imagem válido (PNG, JPG, SVG ou WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        const cleaned = await cleanSignatureImage(result);
        setSignatureUrl(cleaned);
        setErrorMsg('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Informe o nome completo do analista executor.');
      return;
    }

    const activeCompany = DielectricStorageService.getActiveCompany();
    const newTechUser: User = {
      id: 'usr-' + Date.now(),
      companyId: activeCompany.id,
      companyName: activeCompany.name,
      name: name.trim(),
      cargo: cargo.trim() || 'Analista Executor',
      role,
      creaOrCft: creaOrCft.trim() || undefined,
      email: email.trim() || `analista.${Date.now()}@jvmengenharia.com.br`,
      phone: phone.trim() || undefined,
      signatureUrl: signatureUrl || undefined,
      active: true
    };

    const saved = DielectricStorageService.saveUser(newTechUser);
    onTechnicianCreated(saved);
    onClose();

    // Reset fields
    setName('');
    setCargo('Analista Executor');
    setRole('tecnico');
    setCreaOrCft('');
    setEmail('');
    setPhone('');
    setSignatureUrl('');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <UserCheck className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Cadastrar Analista Executor</h3>
              <p className="text-xs text-blue-100">Adicione um novo profissional para emissão e execução de ensaios</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Nome do Técnico */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nome Completo do Analista Executor <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                placeholder="Ex: Carlos Eduardo de Oliveira"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Cargo / Função e Perfil */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cargo / Especialidade
              </label>
              <input
                type="text"
                placeholder="Ex: Analista Executor / Eletrotécnica"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Perfil de Acesso
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-800 font-medium"
              >
                <option value="tecnico">Analista Executor (Operacional)</option>
                <option value="responsavel_tecnico">Responsável Técnico (Engenheiro / CREA)</option>
                <option value="admin">Administrador do Laboratório</option>
                <option value="administrativo">Administrativo / Apoio</option>
              </select>
            </div>
          </div>

          {/* Registro Profissional (CFT / CREA) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Registro Profissional (CFT / CREA)
            </label>
            <div className="relative">
              <Award className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Ex: CFT-SP 123456/TD ou CREA-SP 5069874211/D"
                value={creaOrCft}
                onChange={(e) => setCreaOrCft(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-slate-800"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              O registro é impresso nos laudos técnicos e certificados de conformidade NR-10.
            </p>
          </div>

          {/* Contato (Email e Telefone) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                E-mail Profissional (Opcional)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  placeholder="tecnico@jvmengenharia.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Telefone / WhatsApp (Opcional)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="(19) 99876-5432"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Assinatura Padrão do Analista (Opcional) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <PenTool className="w-4 h-4 text-blue-600" />
                <span>Assinatura Padrão para Laudos (Opcional)</span>
              </div>
              {signatureUrl ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Imagem Anexada
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">Pode adicionar depois</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-28 h-14 bg-white border border-slate-300 rounded-lg flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-inner">
                {signatureUrl ? (
                  <img src={signatureUrl} alt="Assinatura" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Sem assinatura</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{signatureUrl ? 'Trocar Imagem' : 'Carregar Imagem'}</span>
                </button>

                {signatureUrl && (
                  <button
                    type="button"
                    onClick={() => setSignatureUrl('')}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Remover assinatura"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              A imagem salva será carregada automaticamente como padrão em todos os ensaios executados por este analista.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Salvar & Selecionar Analista</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
