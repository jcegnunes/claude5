import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Lock, 
  ArrowLeft,
  Building,
  Check,
  Download,
  Printer,
  FileText,
  Award
} from 'lucide-react';
import { DielectricStorageService } from '../services/syncEngine';
import { SupabaseService } from '../services/supabaseService';
import { TestRecord } from '../types';
import { exportCertificadoPDF, exportLaudoPDF } from '../services/pdfGenerator';
import { formatDateBR } from '../utils/dateUtils';

interface CertificateValidationViewProps {
  initialCode?: string;
  onBackToApp?: () => void;
}

export const CertificateValidationView: React.FC<CertificateValidationViewProps> = ({
  initialCode = '',
  onBackToApp
}) => {
  const [searchCode, setSearchCode] = useState(initialCode);
  const [testRecord, setTestRecord] = useState<TestRecord | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isExportingCert, setIsExportingCert] = useState(false);
  const [isExportingLaudo, setIsExportingLaudo] = useState(false);
  const company = DielectricStorageService.getCompanyInfo();

  const handleSearch = async (codeToSearch: string) => {
    const clean = codeToSearch.trim().toUpperCase();
    if (!clean) return;

    // 1. Cache do aparelho (consulta instantânea, funciona offline)
    const localTest = DielectricStorageService.getTestById(clean);
    if (localTest) {
      setTestRecord(localTest);
      setHasSearched(true);
      return;
    }

    // 2. Banco de dados Supabase — quem lê o QR Code em outro celular não
    //    possui os dados localmente (antes o resultado era sempre "não encontrado")
    const remoteTest = navigator.onLine ? await SupabaseService.fetchTestByCode(clean) : null;
    setTestRecord(remoteTest);
    setHasSearched(true);
  };

  useEffect(() => {
    if (initialCode) {
      setSearchCode(initialCode);
      handleSearch(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchCode);
  };

  const handleDownloadCert = async () => {
    if (!testRecord) return;
    setIsExportingCert(true);
    try {
      await exportCertificadoPDF(testRecord, company);
    } catch (err) {
      console.error('Erro ao exportar certificado:', err);
    } finally {
      setIsExportingCert(false);
    }
  };

  const handleDownloadLaudo = async () => {
    if (!testRecord) return;
    setIsExportingLaudo(true);
    try {
      await exportLaudoPDF(testRecord, company);
    } catch (err) {
      console.error('Erro ao exportar laudo:', err);
    } finally {
      setIsExportingLaudo(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const isExpired = testRecord?.retestDueDate ? testRecord.retestDueDate < today : false;
  const isValid = testRecord && testRecord.result === 'APROVADO' && !isExpired;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      {/* Top Banner */}
      <header className="bg-[#0A2540] text-white py-6 px-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center font-black text-white text-xl">
              JVM
            </div>
            <div>
              <h1 className="font-extrabold text-lg text-white">Portal de Validação de Autenticidade</h1>
              <p className="text-xs text-slate-300">JVM Engenharia & Treinamentos • Ensaios Dielétricos NR-10</p>
            </div>
          </div>

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao Sistema
            </button>
          )}
        </div>
      </header>

      {/* Main Validation Container */}
      <main className="max-w-2xl w-full mx-auto px-4 py-8 flex-1">
        {/* Search Input Card */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200 mb-6">
          <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" />
            Consulta Pública de Laudo / Certificado
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Digite o código de validação, número do laudo ou número do certificado impresso no documento:
          </p>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ex: VAL-JVM-2608-A8B1C4 ou CERT-2608-0001"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 uppercase font-mono font-semibold"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              Verificar
            </button>
          </form>

          {/* Quick Samples */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">Exemplos para teste:</span>
            <button
              type="button"
              onClick={() => {
                setSearchCode('VAL-JVM-2026-A8B1C4');
                handleSearch('VAL-JVM-2026-A8B1C4');
              }}
              className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-blue-700 rounded-md"
            >
              VAL-JVM-2026-A8B1C4
            </button>
          </div>
        </div>

        {/* Validation Result Display */}
        {hasSearched && (
          <div>
            {testRecord ? (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                {/* Result Header Banner */}
                <div className={`p-6 text-white ${
                  isValid
                    ? 'bg-emerald-600'
                    : isExpired
                    ? 'bg-amber-600'
                    : 'bg-red-600'
                }`}>
                  <div className="flex items-center gap-3">
                    {isValid ? (
                      <ShieldCheck className="w-10 h-10 shrink-0" />
                    ) : isExpired ? (
                      <AlertTriangle className="w-10 h-10 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-10 h-10 shrink-0" />
                    )}
                    <div>
                      <span className="text-[11px] uppercase tracking-widest font-bold opacity-90 block">
                        Status da Validação
                      </span>
                      <h3 className="text-xl font-black">
                        {isValid
                          ? 'CERTIFICADO VÁLIDO & AUTÊNTICO'
                          : isExpired
                          ? 'CERTIFICADO EXPIRADO (VENCIDO)'
                          : 'EQUIPAMENTO REPROVADO NO ENSAIO'}
                      </h3>
                      <p className="text-xs opacity-90 mt-0.5">
                        Registrado oficialmente no laboratório da JVM Engenharia & Treinamentos
                      </p>
                    </div>
                  </div>
                </div>

                {/* Safe Non-Confidential Data Body */}
                <div className="p-6 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Número do Certificado / Laudo:</span>
                      <span className="font-bold text-slate-900 font-mono text-sm">{testRecord.certificateNumber || testRecord.reportNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Código de Autenticidade:</span>
                      <span className="font-bold text-blue-700 font-mono text-sm">{testRecord.validationCode}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tipo do Equipamento:</span>
                      <span className="font-bold text-slate-900 uppercase">{testRecord.equipmentType.replace('_', ' ')} (Classe {testRecord.equipmentClass})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tag / Identificação:</span>
                      <span className="font-bold text-slate-900 font-mono">{testRecord.equipmentTag}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Norma de Ensaio:</span>
                      <span className="font-semibold text-slate-900">{testRecord.normCode}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tensão Dielétrica Aplicada:</span>
                      <span className="font-semibold text-slate-900">{testRecord.appliedVoltage_kV} kV {testRecord.voltageType}</span>
                    </div>
                  </div>

                  {/* Dates & Validity */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <span className="text-[11px] text-blue-700 font-semibold block">Data de Realização do Ensaio:</span>
                      <span className="text-sm font-bold text-blue-950">{formatDateBR(testRecord.testDate)}</span>
                    </div>

                    <div className={`p-3 rounded-xl border ${
                      isExpired ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-300'
                    }`}>
                      <span className={`text-[11px] font-semibold block ${isExpired ? 'text-red-700' : 'text-emerald-700'}`}>
                        Validade / Próximo Reensaio Obrigatório:
                      </span>
                      <span className={`text-sm font-black font-mono ${isExpired ? 'text-red-950' : 'text-emerald-950'}`}>
                        {formatDateBR(testRecord.retestDueDate)}
                      </span>
                    </div>
                  </div>

                  {/* Technical Responsible Credential */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Responsável Técnico / Engenheiro Eletricista:</span>
                      <span className="font-bold text-slate-900">{testRecord.techResponsibleName}</span>
                      <span className="text-[11px] text-slate-600 font-mono block">{testRecord.techResponsibleCrea}</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Check className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Actions: Download Certificate & Laudo */}
                  <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl transition-all shadow-2xs"
                    >
                      <Printer className="w-4 h-4 text-slate-600" />
                      <span>Imprimir</span>
                    </button>
                    {testRecord.result === 'APROVADO' && (
                      <button
                        type="button"
                        onClick={handleDownloadCert}
                        disabled={isExportingCert}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white rounded-xl transition-all shadow-sm"
                      >
                        <Award className="w-4 h-4" />
                        <span>{isExportingCert ? 'Gerando Certificado...' : 'Exportar Certificado PDF'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadLaudo}
                      disabled={isExportingLaudo}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-[#0A2540] hover:bg-[#081d33] disabled:bg-slate-700 text-white rounded-xl transition-all shadow-sm"
                    >
                      <FileText className="w-4 h-4 text-orange-400" />
                      <span>{isExportingLaudo ? 'Gerando Laudo...' : 'Exportar Laudo PDF'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 shadow-md border border-slate-200 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Documento Não Encontrado</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Não foi localizado nenhum registro para o código informado. Verifique se o código foi digitado corretamente ou consulte o responsável pelo laboratório.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">{company.legalName} • {company.creaCompanyRegister}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Segurança em Eletricidade NR-10 • Todos os direitos reservados</p>
      </footer>
    </div>
  );
};
