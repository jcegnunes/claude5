import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  ShieldCheck, 
  Award, 
  Calendar, 
  QrCode as QrCodeIcon,
  CheckCircle2,
  FileCheck,
  Building2,
  Tag,
  Edit3
} from 'lucide-react';
import { TestRecord } from '../types';
import { exportCertificadoPDF, generateQRCodeDataUrl } from '../services/pdfGenerator';
import { DielectricStorageService } from '../services/syncEngine';
import { ValidationPortalService } from '../services/validationPortalService';
import { NiimbotLabelModal } from './NiimbotLabelModal';
import { getASTMD178Entry } from '../services/astmBlanketMattingService';
import { formatDateBR } from '../utils/dateUtils';
import { cleanSignatureImage } from '../utils/signatureCleaner';

interface CertificadoViewModalProps {
  test: TestRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onEditTest?: (test: TestRecord) => void;
}

export const CertificadoViewModal: React.FC<CertificadoViewModalProps> = ({
  test,
  isOpen,
  onClose,
  onEditTest
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [isNiimbotModalOpen, setIsNiimbotModalOpen] = useState(false);
  const company = DielectricStorageService.getCompanyInfo();
  const users = DielectricStorageService.getUsers();
  const rtUser = test ? users.find(u => u.id === test.techResponsibleId || u.name === test.techResponsibleName || u.role === 'responsavel_tecnico') : undefined;
  const effectiveRTSig = test?.techResponsibleSignature?.signatureImage || rtUser?.signatureUrl || company.technicalResponsible?.signatureUrl || '';
  const [rtSigCleaned, setRtSigCleaned] = useState<string>('');

  useEffect(() => {
    if (effectiveRTSig) {
      cleanSignatureImage(effectiveRTSig).then(setRtSigCleaned);
    } else {
      setRtSigCleaned('');
    }
  }, [effectiveRTSig]);

  useEffect(() => {
    if (test && isOpen) {
      const validationUrl = ValidationPortalService.buildPublicValidationUrl(test.validationCode);
      generateQRCodeDataUrl(validationUrl).then(setQrDataUrl);

      // Atalho de teclado Ctrl+P / Cmd+P para imprimir o certificado
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
          e.preventDefault();
          window.print();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [test, isOpen]);

  if (!isOpen || !test) return null;

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      await exportCertificadoPDF(test, company);
    } catch (err) {
      console.error('Erro ao exportar PDF do certificado:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:z-auto print:overflow-visible print-modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:overflow-visible print:border-none print-modal-content">
        
        {/* Top Header Action Bar */}
        <div className="bg-[#0A2540] text-white px-5 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-700 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-500/20 border border-orange-400/30 text-orange-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">Certificado de Conformidade Dielétrica</h3>
              <p className="text-xs text-slate-300 font-mono flex items-center gap-1.5 mt-0.5">
                <span>Nº {test.certificateNumber || test.reportNumber}</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold uppercase text-[10px] px-1.5 py-0.2 bg-emerald-950/60 border border-emerald-500/30 rounded-xs">
                  {test.equipmentType === 'ferramenta_isolada' && test.isolatedTools
                    ? `APROVADO (${test.isolatedTools.filter(t => (t.result || 'APROVADO') === 'APROVADO' && t.visualInspection !== 'nao_conforme' && t.dielectricResult !== 'nao_conforme').reduce((s, i) => s + (Number(i.quantity) || 1), 0)} PEÇAS)`
                    : test.result}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEditTest && (
              <button
                onClick={() => {
                  onClose();
                  onEditTest(test);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-all active:scale-98 cursor-pointer"
                title="Editar este Ensaio Concluído"
              >
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Editar Ensaio</span>
              </button>
            )}
            <button
              onClick={() => setIsNiimbotModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors cursor-pointer active:scale-98"
              title="Gerar etiqueta compatível com Niimbot B1"
            >
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">Etiqueta Niimbot B1</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 rounded-lg transition-all shadow-xs hover:shadow active:scale-98 cursor-pointer"
              title="Imprimir Certificado (Ctrl+P)"
            >
              <Printer className="w-4 h-4 text-blue-700" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white rounded-lg transition-all shadow-sm active:scale-98 cursor-pointer"
              title="Exportar Certificado em formato PDF Oficial"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Exportando...' : 'Exportar PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 p-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Fechar Certificado"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Landscape Design Body */}
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-100/70 overflow-y-auto print:p-0 print:bg-white print:overflow-visible print-sheet-area">
          <div className="bg-white border-4 border-double border-[#0A2540] p-5 sm:p-8 rounded-xl shadow-md relative overflow-hidden print:shadow-none print:border-2">
            {/* Background Seal Watermark */}
            <div className="absolute right-4 bottom-4 opacity-5 pointer-events-none print:hidden">
              <ShieldCheck className="w-64 h-64 text-[#0A2540]" />
            </div>

            {/* Header */}
            <div className="text-center pb-4 border-b-2 border-slate-200 flex flex-col items-center">
              {company.logoUrl ? (
                <div className="mb-2 max-h-14 max-w-[160px] flex items-center justify-center p-1 bg-white rounded-md">
                  <img 
                    src={company.logoUrl} 
                    alt={company.name} 
                    className="max-h-12 max-w-full object-contain"
                  />
                </div>
              ) : null}
              <span className="text-[11px] font-bold text-orange-600 uppercase tracking-widest block">
                {company.name} • Laboratório de Ensaios Dielétricos
              </span>
              <h2 className="text-lg sm:text-xl font-black text-[#0A2540] tracking-tight mt-1">
                {company.certificateEmissionSettings?.headerCustomTitle || 'CERTIFICADO DE CONFORMIDADE E ENSAIO DIELÉTRICO'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Em Conformidade com a NR-10, ABNT e Normas Internacionais IEC / ASTM
              </p>
              <div className="mt-2 inline-block px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold font-mono rounded-md">
                CERTIFICADO Nº: {test.certificateNumber || test.reportNumber}
              </div>
            </div>

            {/* Declaration Text */}
            <div className="py-4 sm:py-5 text-xs sm:text-sm text-slate-700 leading-relaxed text-center">
              {company.certificateEmissionSettings?.defaultApprovalText || 
                'Certificamos que o equipamento de proteção abaixo identificado foi submetido a ensaio de rigidez e isolamento dielétrico, atendendo integralmente aos critérios técnicos normativos de segurança:'}
            </div>

            {/* Equipment Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Cliente / Empresa:</span>
                <span className="font-bold text-slate-900">{test.clientName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Equipamento:</span>
                <span className="font-bold text-slate-900 uppercase">{test.equipmentType.replace('_', ' ')} (Classe {test.equipmentClass})</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Tag / Identificação:</span>
                <span className="font-bold text-blue-700 font-mono">{test.equipmentTag}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Nº de Série / CA:</span>
                <span className="font-semibold text-slate-900">{test.equipmentSerial || 'N/A'} • {test.equipmentCa || 'CA N/A'}</span>
              </div>
              {(test.collaboratorName || test.collaboratorRegistration || test.collaboratorSector) && (
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block text-[11px]">Colaborador / Matrícula / Setor:</span>
                  <span className="font-semibold text-slate-900">
                    {test.collaboratorName || 'Geral'}
                    {test.collaboratorRegistration ? ` (Matrícula: ${test.collaboratorRegistration})` : ''}
                    {test.collaboratorSector ? ` • ${test.collaboratorSector}` : ''}
                  </span>
                </div>
              )}
              {test.blanketStyle && (
                <div>
                  <span className="text-slate-500 block text-[11px]">Especificação da Manta (ASTM D1048):</span>
                  <span className="font-semibold text-slate-900">
                    {test.blanketStyle} {test.blanketType ? `• ${test.blanketType}` : ''} {test.blanketDimensions ? `(${test.blanketDimensions})` : ''}
                  </span>
                </div>
              )}
              {test.mattingSurface && (
                <div>
                  <span className="text-slate-500 block text-[11px]">Especificação do Tapete (ASTM D178-22):</span>
                  <span className="font-semibold text-slate-900">
                    Superfície {test.mattingSurface} {test.mattingThickness_mm ? `• Espessura: ${test.mattingThickness_mm} mm` : ''} 
                    {(() => {
                      const astm = getASTMD178Entry(test.equipmentClass);
                      return astm ? ` (Mín. Tab. 2: ${astm.espessuraMinima_mm} mm)` : '';
                    })()}
                    {test.mattingDimensions ? ` • Dimensões: ${test.mattingDimensions}` : ''}
                  </span>
                </div>
              )}
              <div className="sm:col-span-2">
                <span className="text-slate-500 block text-[11px]">Norma Aplicável & Tensão de Ensaio:</span>
                <span className="font-semibold text-slate-900">{test.normCode} ({test.appliedVoltage_kV} kV {test.voltageType} por {test.applicationDurationSeconds}s)</span>
              </div>
            </div>

            {/* Composição das Ferramentas Isoladas se houver */}
            {test.isolatedTools && test.isolatedTools.length > 0 && (() => {
              const approvedTools = test.isolatedTools.filter(t => (t.result || 'APROVADO') === 'APROVADO' && t.visualInspection !== 'nao_conforme' && t.dielectricResult !== 'nao_conforme');
              const reprovedTools = test.isolatedTools.filter(t => t.result === 'REPROVADO' || t.visualInspection === 'nao_conforme' || t.dielectricResult === 'nao_conforme');
              const approvedCount = approvedTools.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
              const reprovedCount = reprovedTools.reduce((s, i) => s + (Number(i.quantity) || 1), 0);

              return (
                <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-3.5 text-xs space-y-2.5 mt-3">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-emerald-100 pb-2">
                    <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Discriminação das Ferramentas Aprovadas e Certificadas (NBR 9699 / IEC 60900):
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {approvedCount} peça(s) certificada(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                    {approvedTools.map((t, idx) => (
                      <div key={t.id || idx} className="p-2 rounded-lg border bg-white border-emerald-100 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-semibold text-slate-800">
                            {t.toolName} {t.sizeOrSpec ? `(${t.sizeOrSpec})` : ''}
                          </span>
                        </div>
                        <span className="font-bold text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {t.quantity || 1} un • 10 kV CONFORME
                        </span>
                      </div>
                    ))}
                  </div>

                  {reprovedCount > 0 && (
                    <div className="mt-2 p-2 bg-amber-50/90 border border-amber-200 rounded-lg text-[10px] text-amber-900 flex items-start gap-1.5">
                      <span className="font-bold text-amber-800 shrink-0">Nota Técnica:</span>
                      <span>
                        As {reprovedCount} ferramenta(s) reprovada(s) no lote foram segregadas para descarte/quarentena e não constam desta certificação (conforme Laudo Técnico Nº {test.reportNumber}). O presente certificado é válido exclusivamente para as {approvedCount} ferramentas aprovadas acima listadas.
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Status & Validity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Resultado do Ensaio</span>
                  <span className="text-base font-black text-emerald-900">APROVADO</span>
                  <span className="text-[11px] text-emerald-700 block">Data do Ensaio: {formatDateBR(test.testDate)}</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">Próximo Reensaio Obrigatório</span>
                  <span className="text-base font-black text-amber-950 font-mono">{formatDateBR(test.retestDueDate)}</span>
                  <span className="text-[11px] text-amber-800 block">Periodicidade NR-10 Conforme</span>
                </div>
              </div>
            </div>

            {/* Footer with RT and QR Code */}
            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <div className="h-12 flex items-center justify-center sm:justify-start mb-1">
                  {(rtSigCleaned || effectiveRTSig) ? (
                    <img src={rtSigCleaned || effectiveRTSig} alt="Assinatura RT" className="max-h-12 max-w-[180px] object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Assinatura Eletrônica Registrada</span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-900">{test.techResponsibleName}</p>
                <p className="text-[11px] text-slate-600 font-mono">{test.techResponsibleCrea}</p>
                <p className="text-[10px] text-slate-500">Engenheiro Eletricista / Responsável Técnico</p>
              </div>

              <div className="flex items-center gap-3 p-2">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="QR Code de Validação" className="w-16 h-16" />
                )}
                <div className="text-left">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block">Autenticidade</span>
                  <span className="text-xs font-mono font-bold text-blue-700 block">{test.validationCode}</span>
                  <span className="text-[10px] text-slate-500">Escaneie para validar</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Documento Oficial com Assinatura Digital e Rastreabilidade QR Code</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsNiimbotModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 border border-amber-500/40 rounded-xl transition-all cursor-pointer active:scale-98"
              title="Gerar etiqueta compatível com Niimbot B1"
            >
              <Tag className="w-4 h-4 text-amber-600" />
              <span className="hidden sm:inline">Etiqueta Niimbot</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl transition-all shadow-2xs hover:shadow-xs active:scale-98 cursor-pointer"
              title="Imprimir Certificado (Ctrl+P)"
            >
              <Printer className="w-4 h-4 text-blue-700" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-98 cursor-pointer"
              title="Exportar Certificado em PDF Oficial"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Gerando PDF...' : 'Exportar PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors active:scale-98 cursor-pointer"
              title="Fechar Certificado"
            >
              <X className="w-4 h-4" />
              <span>Fechar</span>
            </button>
          </div>
        </div>

      </div>

      {/* Modal de Etiqueta Niimbot B1 */}
      <NiimbotLabelModal
        isOpen={isNiimbotModalOpen}
        onClose={() => setIsNiimbotModalOpen(false)}
        tests={[test]}
        company={company}
      />
    </div>
  );
};
