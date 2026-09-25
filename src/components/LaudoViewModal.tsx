import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  QrCode as QrCodeIcon, 
  FileText,
  Calendar,
  Building,
  Award,
  ShieldCheck,
  Tag,
  Edit3
} from 'lucide-react';
import { TestRecord, CompanyLabInfo } from '../types';
import { exportLaudoPDF, generateQRCodeDataUrl, formatToolDisplayName, formatEquipmentType } from '../services/pdfGenerator';
import { DielectricStorageService } from '../services/syncEngine';
import { ValidationPortalService } from '../services/validationPortalService';
import { NiimbotLabelModal } from './NiimbotLabelModal';
import { getASTMD178Entry, getASTMD1048Entry } from '../services/astmBlanketMattingService';
import { TABELA_4_NBR_16295, getClosestGloveLength } from '../services/nbr16295Service';
import { formatDateBR } from '../utils/dateUtils';
import { SpeedometerGauge } from './SpeedometerGauge';
import { cleanSignatureImage } from '../utils/signatureCleaner';
import { exportSingleLaudoToWord } from '../services/wordReportService';

interface LaudoViewModalProps {
  test: TestRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onEditTest?: (test: TestRecord) => void;
}

export const LaudoViewModal: React.FC<LaudoViewModalProps> = ({ test, isOpen, onClose, onEditTest }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isNiimbotModalOpen, setIsNiimbotModalOpen] = useState(false);
  const company = DielectricStorageService.getCompanyInfo();
  const users = DielectricStorageService.getUsers();
  const techUser = test ? users.find(u => u.id === test.technicianId || u.name === test.technicianName) : undefined;
  const effectiveTechSig = test?.technicianSignature?.signatureImage || techUser?.signatureUrl || '';

  const rtUser = test ? users.find(u => u.id === test.techResponsibleId || u.name === test.techResponsibleName || u.role === 'responsavel_tecnico') : undefined;
  const effectiveRTSig = test?.techResponsibleSignature?.signatureImage || rtUser?.signatureUrl || company.technicalResponsible?.signatureUrl || '';

  const [techSigCleaned, setTechSigCleaned] = useState<string>('');
  const [rtSigCleaned, setRtSigCleaned] = useState<string>('');

  useEffect(() => {
    if (effectiveTechSig) {
      cleanSignatureImage(effectiveTechSig).then(setTechSigCleaned);
    } else {
      setTechSigCleaned('');
    }
    if (effectiveRTSig) {
      cleanSignatureImage(effectiveRTSig).then(setRtSigCleaned);
    } else {
      setRtSigCleaned('');
    }
  }, [effectiveTechSig, effectiveRTSig]);
  const workOrders = DielectricStorageService.getWorkOrders();
  const matchingOS = test ? workOrders.find(os => os.id === test.serviceOrderId || os.osNumber === test.serviceOrderNumber) : undefined;
  const effectiveArtNumber = test?.artNumber || matchingOS?.artNumber || '';

  const isGlove = Boolean(test && (test.equipmentType === 'luva_isolante' || test.gloveLength_mm));
  const selectedGloveClass = test?.equipmentClass?.trim() || '0';
  const selectedGloveLength = getClosestGloveLength(test?.gloveLength_mm || 360);
  const gloveTableEntry = TABELA_4_NBR_16295.find(r => r.classe === selectedGloveClass);
  const normLeakageLimit = (isGlove && gloveTableEntry && gloveTableEntry.limitesFugaAC_mA[selectedGloveLength] !== null)
    ? gloveTableEntry.limitesFugaAC_mA[selectedGloveLength]! * 2
    : test?.equipmentType === 'tapete_isolante'
    ? (test?.leakageCurrentLimit_mA || 100)
    : (test?.leakageCurrentLimit_mA || 10);
  const normApplicableDisplay = isGlove
    ? (test?.normCode && (test.normCode.includes('16295') || test.normCode.includes('16259') || test.normCode.includes('IEC 60903')) ? 'NBR 16295 Tabela 4' : (test?.normCode || 'NBR 16295 Tabela 4'))
    : (test?.normCode || 'Norma Geral NR-10');

  useEffect(() => {
    if (test && isOpen) {
      const validationUrl = ValidationPortalService.buildPublicValidationUrl(test.validationCode);
      generateQRCodeDataUrl(validationUrl).then(setQrDataUrl);

      // Atalho de teclado Ctrl+P / Cmd+P para imprimir o laudo
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
      await exportLaudoPDF(test, company);
    } catch (err) {
      console.error('Erro ao gerar PDF do Laudo:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadWord = async () => {
    setIsExportingWord(true);
    try {
      await exportSingleLaudoToWord(test, company);
    } catch (err) {
      console.error('Erro ao gerar documento Word do Laudo:', err);
    } finally {
      setIsExportingWord(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isApproved = test.result === 'APROVADO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:z-auto print:overflow-visible print-modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:rounded-none print:overflow-visible print:border-none print-modal-content">
        {/* Modal Action Bar */}
        <div className="bg-[#0A2540] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-400" />
            <div>
              <h3 className="font-bold text-sm sm:text-base">Laudo Técnico de Ensaio Dielétrico</h3>
              <p className="text-xs text-slate-300 font-mono flex flex-wrap items-center gap-x-2">
                <span>{test.reportNumber} • OS: {test.serviceOrderNumber}</span>
                {effectiveArtNumber && (
                  <span className="text-amber-300 font-bold bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.2 rounded text-[11px]">
                    ART: {effectiveArtNumber}
                  </span>
                )}
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
                <Edit3 className="w-4 h-4 text-amber-400" /> <span className="hidden sm:inline">Editar Ensaio</span>
              </button>
            )}
            <button
              onClick={() => setIsNiimbotModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors cursor-pointer active:scale-98"
              title="Gerar etiqueta compatível com Niimbot B1"
            >
              <Tag className="w-4 h-4" /> <span className="hidden sm:inline">Etiqueta Niimbot B1</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 rounded-lg transition-all shadow-xs hover:shadow active:scale-98 cursor-pointer"
              title="Imprimir Laudo Técnico (Ctrl+P)"
            >
              <Printer className="w-4 h-4 text-blue-700" /> <span>Imprimir</span>
            </button>
            <button
              onClick={handleDownloadWord}
              disabled={isExportingWord}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-all shadow-xs active:scale-98 cursor-pointer"
              title="Exportar Laudo Técnico para Microsoft Word (.doc)"
            >
              <FileText className="w-4 h-4 text-blue-200" /> <span>{isExportingWord ? 'Gerando...' : 'Exportar Word'}</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white rounded-lg transition-all shadow-sm active:scale-98 cursor-pointer"
              title="Baixar Laudo Técnico Oficial em PDF"
            >
              <Download className="w-4 h-4" /> <span>{isExporting ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Fechar visualização"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Laudo Sheet */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-800 bg-white print:p-0 print:overflow-visible print:space-y-4 print-sheet-area" id="laudo-print-area">
          {/* Top Company Header */}
          <div className="border-b-2 border-[#0A2540] pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {company.logoUrl ? (
                <div className="max-h-16 max-w-[140px] flex items-center justify-center p-1 bg-white rounded-lg border border-slate-200">
                  <img 
                    src={company.logoUrl} 
                    alt={company.name} 
                    className="max-h-14 max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#0A2540] flex items-center justify-center text-white font-black text-2xl tracking-tighter">
                  JVM
                </div>
              )}
              <div>
                <h1 className="font-black text-lg text-[#0A2540] tracking-tight">{company.name}</h1>
                <p className="text-xs text-slate-600 font-medium">{company.legalName}</p>
                <p className="text-[11px] text-slate-500">{company.creaCompanyRegister} • CNPJ: {company.cnpj}</p>
                <p className="text-[11px] text-slate-500">
                  {company.address}
                  {company.number && !company.address?.includes(company.number) ? `, ${company.number}` : ''}
                  {company.neighborhood && !company.address?.includes(company.neighborhood) ? ` - ${company.neighborhood}` : ''}
                  {' • '}{company.city ? `${company.city} - ${company.state || 'SP'}` : company.cityState}
                  {company.cep ? ` • CEP: ${company.cep}` : ''}
                </p>
              </div>
            </div>
            <div className="text-right sm:border-l sm:pl-4 border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">Identificador Oficial</span>
              <span className="text-base font-extrabold text-blue-700 font-mono block">{test.reportNumber}</span>
              <span className="text-xs font-semibold text-slate-700 font-mono block">OS: {test.serviceOrderNumber}</span>
              {effectiveArtNumber && (
                <span className="text-xs font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded font-mono inline-block mt-0.5 shadow-xs">
                  ART: {effectiveArtNumber}
                </span>
              )}
              <span className="text-[11px] text-slate-500 block mt-0.5">Emissão: {formatDateBR(test.testDate)} às {test.testTime}</span>
            </div>
          </div>

          {/* Section 1: Customer & Equipment Grid */}
          <div>
            <div className="bg-[#0A2540] text-white text-xs font-bold px-3 py-1.5 rounded-t-md uppercase tracking-wider flex flex-wrap items-center justify-between gap-2">
              <span>1. Identificação do Cliente e do Equipamento Dielétrico</span>
              <span>Data do Ensaio: {formatDateBR(test.testDate)}</span>
            </div>
            <div className="border border-slate-300 rounded-b-md p-4 text-xs bg-slate-50/50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 block">Cliente:</span>
                  <span className="font-bold text-slate-900">{test.clientName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Ordem de Serviço (OS):</span>
                  <span className="font-bold font-mono text-slate-900">{test.serviceOrderNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Local do Ensaio:</span>
                  <span className="font-semibold text-slate-900">{test.location || 'Laboratório Móvel JVM'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tipo de Equipamento:</span>
                  <span className="font-bold text-slate-900 uppercase">{test.equipmentType.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tag / Patrimônio:</span>
                  <span className="font-bold text-blue-700 font-mono">{test.equipmentTag}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Classe Dielétrica:</span>
                  <span className="font-bold text-slate-900">Classe {test.equipmentClass}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Nº de Série:</span>
                  <span className="font-mono text-slate-900">{test.equipmentSerial || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Certificado de Aprovação (CA):</span>
                  <span className="font-semibold text-slate-900">{test.equipmentCa || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    {test.equipmentType === 'luva_isolante' || test.gloveLength_mm
                      ? 'Comprimento da Luva (NBR 16295):'
                      : test.blanketDimensions
                      ? 'Dimensões da Manta:'
                      : test.mattingDimensions
                      ? 'Dimensões do Tapete:'
                      : 'Comprimento / Dimensão:'}
                  </span>
                  <span className="font-bold text-blue-700 font-mono">
                    {test.equipmentType === 'luva_isolante' || test.gloveLength_mm
                      ? `${test.gloveLength_mm || 360} mm`
                      : test.blanketDimensions
                      ? test.blanketDimensions
                      : test.mattingDimensions
                      ? test.mattingDimensions
                      : test.gloveLength_mm
                      ? `${test.gloveLength_mm} mm`
                      : 'N/A'}
                  </span>
                </div>
                {test.blanketStyle && (
                  <div>
                    <span className="text-slate-500 block">Estilo da Manta (ASTM D1048):</span>
                    <span className="font-bold text-amber-800">{test.blanketStyle} {test.blanketType ? `• ${test.blanketType}` : ''}</span>
                  </div>
                )}
                {test.blanketDimensions && test.equipmentType !== 'manta_isolante' && (
                  <div>
                    <span className="text-slate-500 block">Dimensões da Manta:</span>
                    <span className="font-semibold text-slate-900">{test.blanketDimensions}</span>
                  </div>
                )}
                {test.flashoverClearance_mm && (
                  <div>
                    <span className="text-slate-500 block">Folga de Borda Anti-Flashover:</span>
                    <span className="font-bold text-blue-700 font-mono">{test.flashoverClearance_mm} mm</span>
                  </div>
                )}
                {test.mattingSurface && (
                  <div>
                    <span className="text-slate-500 block">Superfície do Tapete (ASTM D178-22):</span>
                    <span className="font-bold text-emerald-800">{test.mattingSurface}</span>
                  </div>
                )}
                {test.mattingThickness_mm !== undefined && (
                  <div>
                    <span className="text-slate-500 block">Espessura Medida do Tapete:</span>
                    <span className="font-bold text-emerald-900 font-mono">
                      {test.mattingThickness_mm} mm
                      {(() => {
                        const astm = getASTMD178Entry(test.equipmentClass);
                        return astm ? ` (Mín. ASTM D178-22 Tab. 2: ${astm.espessuraMinima_mm} mm)` : '';
                      })()}
                    </span>
                  </div>
                )}
                {test.mattingDimensions && test.equipmentType !== 'tapete_isolante' && (
                  <div>
                    <span className="text-slate-500 block">Dimensões do Tapete:</span>
                    <span className="font-semibold text-slate-900">{test.mattingDimensions}</span>
                  </div>
                )}
                {effectiveArtNumber && (
                  <div>
                    <span className="text-slate-500 block">Nº da ART (CREA/CFT):</span>
                    <span className="font-bold text-amber-800 font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">{effectiveArtNumber}</span>
                  </div>
                )}
              </div>

              {/* Linha do Colaborador / Usuário: Sempre na última linha do cabeçalho em 3 colunas */}
              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 block">Colaborador / Usuário:</span>
                  <span className="font-bold text-slate-900">{test.collaboratorName || matchingOS?.collaboratorName || 'Não especificado'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Matrícula Funcional:</span>
                  <span className="font-semibold text-slate-900 font-mono">{test.collaboratorRegistration || matchingOS?.collaboratorRegistration || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Setor / Lotação:</span>
                  <span className="font-semibold text-slate-900">{test.collaboratorSector || matchingOS?.collaboratorSector || 'Geral'}</span>
                </div>
              </div>
            </div>

            {/* Composição e Avaliação Individual das Ferramentas Isoladas se aplicável */}
            {test.isolatedTools && test.isolatedTools.length > 0 && (
              <div className="border-x border-b border-orange-200 bg-orange-50/40 p-3 rounded-b-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                      Discriminação e Avaliação Individual das Ferramentas Manuais Isoladas (NBR 9699 / IEC 60900)
                    </span>
                    <span className="text-[11px] text-slate-600 block">
                      Ensaio de rigidez dielétrica individual aplicado a 10,0 kV CA e inspeção visual de integridade
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-orange-200">
                      Total: {test.isolatedTools.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} un
                    </span>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                      {test.isolatedTools.filter(t => (t.result || 'APROVADO') === 'APROVADO').length} Aprovada(s)
                    </span>
                    {test.isolatedTools.some(t => t.result === 'REPROVADO') && (
                      <span className="text-[11px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                        {test.isolatedTools.filter(t => t.result === 'REPROVADO').length} Reprovada(s)
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto border border-orange-200 rounded-lg bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-orange-100/80 text-orange-950 font-bold border-b border-orange-200 text-[11px]">
                        <th className="p-2 w-8 text-center">#</th>
                        <th className="p-2">Ferramenta & Especificação</th>
                        <th className="p-2">Fabricante</th>
                        <th className="p-2 text-center">Qtd</th>
                        <th className="p-2 text-center">Insp. Visual</th>
                        <th className="p-2 text-center">Ensaio 10kV</th>
                        <th className="p-2 text-center">Parecer Individual</th>
                        <th className="p-2">Observações / Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs font-medium">
                      {test.isolatedTools.map((tool, idx) => {
                        const isAppr = (tool.result || 'APROVADO') === 'APROVADO';
                        return (
                          <tr key={tool.id || idx} className={isAppr ? 'hover:bg-slate-50' : 'bg-red-50/40 hover:bg-red-50/60'}>
                            <td className="p-2 text-center font-bold text-slate-500">{idx + 1}</td>
                            <td className="p-2 font-semibold text-slate-900">
                              {formatToolDisplayName(tool.toolName, tool.toolType)}
                              {tool.sizeOrSpec && <span className="text-slate-500 font-normal block text-[11px]">{tool.sizeOrSpec.replace(/_/g, ' ')}</span>}
                            </td>
                            <td className="p-2 text-slate-700 font-medium">{tool.manufacturer}</td>
                            <td className="p-2 text-center font-mono font-bold text-slate-800">{tool.quantity} un</td>
                            <td className="p-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                tool.visualInspection === 'nao_conforme' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {tool.visualInspection === 'nao_conforme' ? 'Não Conforme' : 'Conforme'}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                tool.dielectricResult === 'nao_conforme' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {tool.dielectricResult === 'nao_conforme' ? 'Disrupção' : 'Conforme'}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded font-extrabold text-[11px] inline-flex items-center gap-1 ${
                                isAppr 
                                  ? 'bg-emerald-600 text-white' 
                                  : 'bg-red-600 text-white'
                              }`}>
                                {isAppr ? 'APROVADO' : 'REPROVADO'}
                              </span>
                            </td>
                            <td className="p-2 text-[11px] text-slate-600">
                              {tool.defectReason || (isAppr ? 'Aprovado sem restrições' : 'Não atendeu à NBR 9699')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Norms & Environmental */}
          <div>
            <div className="bg-[#0A2540] text-white text-xs font-bold px-3 py-1.5 rounded-t-md uppercase tracking-wider">
              2. Referência Normativa e Condições Ambientais
            </div>
            <div className="border border-slate-300 rounded-b-md p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-slate-50/50">
              <div className="sm:col-span-2">
                <span className="text-slate-500 block">Norma Regulamentadora / Técnica:</span>
                <span className="font-bold text-slate-900">
                  {(test.equipmentType === 'luva_isolante' || test.gloveLength_mm)
                    ? (test.normCode && (test.normCode.includes('16295') || test.normCode.includes('16259') || test.normCode.includes('IEC 60903')) ? 'NBR 16295 Tabela 4' : (test.normCode || 'NBR 16295 Tabela 4'))
                    : (test.normCode || 'Norma Geral NR-10')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Temperatura Ambiente:</span>
                <span className="font-semibold text-slate-900">{test.environmental.temperatureC}°C</span>
              </div>
              <div>
                <span className="text-slate-500 block">Umidade Relativa do Ar:</span>
                <span className="font-semibold text-slate-900">{test.environmental.relativeHumidityPercent}% UR</span>
              </div>
            </div>

            {/* Tabela 4 da ABNT NBR 16295 / IEC 60903 para Luvas Isolantes (Linha correspondente à Luva) */}
            {isGlove && (
              <div className="border-x border-b border-blue-200 bg-blue-50/30 p-4 rounded-b-md space-y-3 mt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/80 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Tabela 4 da ABNT NBR 16295 / IEC 60903 – Ensaios de Prova e Rigidez Dielétrica
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Parâmetros normativos oficiais aplicáveis à luva ensaiada: <strong className="text-blue-900 font-bold">Classe {selectedGloveClass}</strong> • Coluna de ensaio: <strong className="text-blue-900 font-bold">{selectedGloveLength} mm</strong>.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold text-blue-900 bg-blue-100 border border-blue-300 px-2.5 py-1 rounded-lg">
                      🧤 Luva Ensaiada: Classe {selectedGloveClass} • {selectedGloveLength} mm
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-blue-200 rounded-lg bg-white shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                        <th rowSpan={2} className="p-2 border-r border-slate-200 text-center bg-slate-200/80">Classe</th>
                        <th rowSpan={2} className="p-2 border-r border-slate-200 text-center">Tensão Máx. de Uso (kV CA)</th>
                        <th rowSpan={2} className="p-2 border-r border-slate-200 text-center">Tensão de Prova (kV CA)</th>
                        <th colSpan={4} className="p-1.5 border-r border-slate-200 text-center bg-blue-100/70 text-blue-950 font-extrabold">
                          Corrente Máxima de Fuga no Ensaio de Prova (mArms)
                        </th>
                        <th rowSpan={2} className="p-2 text-center">Tensão de Rigidez (kV CA)</th>
                      </tr>
                      <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-300 text-[10px]">
                        <th className={`p-1.5 text-center border-r border-slate-200 transition-colors ${selectedGloveLength === 280 ? 'bg-blue-200 text-blue-950 font-black ring-1 ring-blue-400' : ''}`}>
                          280 mm {selectedGloveLength === 280 && '▼'}
                        </th>
                        <th className={`p-1.5 text-center border-r border-slate-200 transition-colors ${selectedGloveLength === 360 ? 'bg-blue-200 text-blue-950 font-black ring-1 ring-blue-400' : ''}`}>
                          360 mm {selectedGloveLength === 360 && '▼'}
                        </th>
                        <th className={`p-1.5 text-center border-r border-slate-200 transition-colors ${selectedGloveLength === 410 ? 'bg-blue-200 text-blue-950 font-black ring-1 ring-blue-400' : ''}`}>
                          410 mm {selectedGloveLength === 410 && '▼'}
                        </th>
                        <th className={`p-1.5 text-center border-r border-slate-200 transition-colors ${selectedGloveLength === 460 ? 'bg-blue-200 text-blue-950 font-black ring-1 ring-blue-400' : ''}`}>
                          ≥ 460 mm {selectedGloveLength === 460 && '▼'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {(TABELA_4_NBR_16295.filter((r) => r.classe === selectedGloveClass).length > 0
                        ? TABELA_4_NBR_16295.filter((r) => r.classe === selectedGloveClass)
                        : TABELA_4_NBR_16295
                      ).map((row) => {
                        const isRowSelected = row.classe === selectedGloveClass;
                        return (
                          <tr 
                            key={row.classe}
                            className="bg-blue-50/95 font-bold border-y-2 border-blue-500"
                          >
                            <td className="p-2 text-center border-r border-slate-200 font-extrabold bg-blue-600 text-white">
                              <div className="flex items-center justify-center gap-1">
                                <span>Classe {row.classe}</span>
                                <span className="text-[10px] text-amber-300" title="Classe da luva deste laudo">★</span>
                              </div>
                            </td>
                            <td className="p-2 text-center border-r border-slate-200 font-mono text-blue-950 font-extrabold">
                              {row.tensaoMaximaUsoAC_kV.toFixed(1)} kV
                            </td>
                            <td className="p-2 text-center border-r border-slate-200 font-mono text-blue-950 font-black">
                              {row.tensaoProvaAC_kV.toFixed(1)} kV
                            </td>
                            
                            {/* 280 mm */}
                            <td className={`p-2 text-center border-r border-slate-200 ${selectedGloveLength === 280 ? 'bg-blue-100/80' : ''}`}>
                              {row.limitesFugaAC_mA[280] !== null ? (
                                selectedGloveLength === 280 ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-700 text-white font-extrabold font-mono shadow-sm ring-2 ring-blue-400" title={`Ensaio em 2 luvas simultâneas: dobro de ${row.limitesFugaAC_mA[280]} mA`}>
                                    {row.limitesFugaAC_mA[280] * 2} mA 🎯 <span className="text-[10px] font-normal text-blue-200">({row.limitesFugaAC_mA[280]}x2)</span>
                                  </span>
                                ) : (
                                  <span className="font-mono font-bold text-slate-900">{row.limitesFugaAC_mA[280]} mA</span>
                                )
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">N/a</span>
                              )}
                            </td>

                            {/* 360 mm */}
                            <td className={`p-2 text-center border-r border-slate-200 ${selectedGloveLength === 360 ? 'bg-blue-100/80' : ''}`}>
                              {row.limitesFugaAC_mA[360] !== null ? (
                                selectedGloveLength === 360 ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-700 text-white font-extrabold font-mono shadow-sm ring-2 ring-blue-400" title={`Ensaio em 2 luvas simultâneas: dobro de ${row.limitesFugaAC_mA[360]} mA`}>
                                    {row.limitesFugaAC_mA[360] * 2} mA 🎯 <span className="text-[10px] font-normal text-blue-200">({row.limitesFugaAC_mA[360]}x2)</span>
                                  </span>
                                ) : (
                                  <span className="font-mono font-bold text-slate-900">{row.limitesFugaAC_mA[360]} mA</span>
                                )
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">N/a</span>
                              )}
                            </td>

                            {/* 410 mm */}
                            <td className={`p-2 text-center border-r border-slate-200 ${selectedGloveLength === 410 ? 'bg-blue-100/80' : ''}`}>
                              {row.limitesFugaAC_mA[410] !== null ? (
                                selectedGloveLength === 410 ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-700 text-white font-extrabold font-mono shadow-sm ring-2 ring-blue-400" title={`Ensaio em 2 luvas simultâneas: dobro de ${row.limitesFugaAC_mA[410]} mA`}>
                                    {row.limitesFugaAC_mA[410] * 2} mA 🎯 <span className="text-[10px] font-normal text-blue-200">({row.limitesFugaAC_mA[410]}x2)</span>
                                  </span>
                                ) : (
                                  <span className="font-mono font-bold text-slate-900">{row.limitesFugaAC_mA[410]} mA</span>
                                )
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">N/a</span>
                              )}
                            </td>

                            {/* >= 460 mm */}
                            <td className={`p-2 text-center border-r border-slate-200 ${selectedGloveLength === 460 ? 'bg-blue-100/80' : ''}`}>
                              {row.limitesFugaAC_mA[460] !== null ? (
                                selectedGloveLength === 460 ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-700 text-white font-extrabold font-mono shadow-sm ring-2 ring-blue-400" title={`Ensaio em 2 luvas simultâneas: dobro de ${row.limitesFugaAC_mA[460]} mA`}>
                                    {row.limitesFugaAC_mA[460] * 2} mA 🎯 <span className="text-[10px] font-normal text-blue-200">({row.limitesFugaAC_mA[460]}x2)</span>
                                  </span>
                                ) : (
                                  <span className="font-mono font-bold text-slate-900">{row.limitesFugaAC_mA[460]} mA</span>
                                )
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">N/a</span>
                              )}
                            </td>

                            <td className="p-2 text-center font-mono text-blue-950 font-bold">
                              {row.tensaoRigidezAC_kV.toFixed(1)} kV
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-blue-200 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 bg-blue-700 rounded-sm"></span>
                    <span>
                      <strong className="text-slate-900">Critério Operativo Aplicado:</strong> Luva Classe <strong>{selectedGloveClass}</strong> ({selectedGloveLength} mm) ➔ Tensão de Prova: <strong>{test.appliedVoltage_kV} kV CA</strong> | Limite Máximo de Fuga: <strong>{test.leakageCurrentLimit_mA || normLeakageLimit} mA</strong> <span className="text-blue-700 font-semibold">(Dobro da Tabela 4 — Ensaio simultâneo em 2 luvas)</span>.
                    </span>
                  </div>
                  <span className="text-slate-500 italic">
                    Nota: O limite de ensaio corresponde ao dobro do valor unitário da Tabela 4 devido ao ensaio em 2 luvas simultâneas na cuba. N/a = Não aplicável.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Dielectric Measurements Table */}
          <div>
            <div className="bg-[#0A2540] text-white text-xs font-bold px-3 py-1.5 rounded-t-md uppercase tracking-wider">
              3. Parâmetros e Resultados das Medições Elétricas
            </div>

            <div className="border border-slate-300 rounded-b-md p-3.5 space-y-4 bg-white">
              {/* Indicadores Gráficos Tipo Velocímetro (Tensão Aplicada e Corrente de Fuga) */}
              {(() => {
                const appliedV = test.appliedVoltage_kV || 0;
                const voltageScale = Math.max(15, Math.ceil(appliedV * 1.35 / 5) * 5);
                const leakVal = test.measuredLeakageCurrent_mA || 0;
                const effectiveLimit = normLeakageLimit || test.leakageCurrentLimit_mA || 10;
                const leakScale = Math.max(10, Math.ceil(Math.max(effectiveLimit * 1.35, leakVal * 1.25) / 5) * 5);
                const leakPercent = ((leakVal / effectiveLimit) * 100).toFixed(1);
                const isLeakOk = leakVal <= effectiveLimit;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <SpeedometerGauge
                      title="Tensão de Ensaio Aplicada"
                      value={appliedV}
                      unit={`kV ${test.voltageType || 'CA'}`}
                      maxScale={voltageScale}
                      type="voltage"
                      statusLabel="TENSÃO DE PROVA NOMINAL"
                      subtext={`Duração: ${test.applicationDurationSeconds}s contínuos (${test.voltageType})`}
                    />

                    <SpeedometerGauge
                      title="Corrente de Fuga Medida"
                      value={leakVal}
                      unit={test.currentUnit || 'mA'}
                      maxScale={leakScale}
                      limit={effectiveLimit}
                      isConforming={isLeakOk}
                      type="current"
                      statusLabel={isLeakOk ? 'CONFORME (ABAIXO DO LIMITE)' : 'NÃO CONFORME (ULTRAPASSOU)'}
                      subtext={`Limite Máximo Normativo: ${effectiveLimit} mA (${leakPercent}% atingido)`}
                    />
                  </div>
                );
              })()}

              <div className="border border-slate-300 rounded-md overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-300">
                    <th className="p-2.5">Parâmetro de Ensaio</th>
                    <th className="p-2.5">Exigência Normativa</th>
                    <th className="p-2.5">Valor Medido</th>
                    <th className="p-2.5 text-center">Avaliação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  <tr>
                    <td className="p-2.5">Tensão de Ensaio Aplicada</td>
                    <td className="p-2.5 font-semibold text-slate-800">
                      {isGlove 
                        ? `${gloveTableEntry ? gloveTableEntry.tensaoProvaAC_kV.toFixed(1) : test.appliedVoltage_kV.toFixed(1)} kV CA (Tabela 4 da ABNT NBR 16295 – Classe ${selectedGloveClass})` 
                        : `${test.appliedVoltage_kV} kV (${test.voltageType}) – ${normApplicableDisplay}`}
                    </td>
                    <td className="p-2.5 font-bold font-mono">{test.appliedVoltage_kV} kV {test.voltageType}</td>
                    <td className="p-2.5 text-center text-emerald-700 font-bold">CONFORME</td>
                  </tr>
                  <tr>
                    <td className="p-2.5">Tempo de Aplicação da Tensão</td>
                    <td className="p-2.5 font-semibold text-slate-800">
                      {isGlove 
                        ? '60 segundos contínuos (ABNT NBR 16295 / IEC 60903)' 
                        : `${test.applicationDurationSeconds} segundos contínuos (${normApplicableDisplay})`}
                    </td>
                    <td className="p-2.5 font-bold font-mono">{test.applicationDurationSeconds} s</td>
                    <td className="p-2.5 text-center text-emerald-700 font-bold">CONFORME</td>
                  </tr>
                  <tr>
                    <td className="p-2.5">Corrente de Fuga</td>
                    <td className="p-2.5 font-semibold text-slate-800">
                      {isGlove 
                        ? `Máximo ${normLeakageLimit} mA (Tabela 4 – Classe ${selectedGloveClass} / ${selectedGloveLength} mm)` 
                        : test.equipmentType === 'tapete_isolante'
                        ? `Máximo ${normLeakageLimit} mA (Limite adotado – ASTM D178-22)`
                        : test.equipmentType === 'ferramenta_isolada'
                        ? `Máximo ${test.leakageCurrentLimit_mA} mA (${(test.isolatedTools?.reduce((acc, t) => acc + (Number(t.quantity) || 1), 0) || 1)} un × 1,0 mA/un – NBR 9699 / IEC 60900)`
                        : `Máximo ${test.leakageCurrentLimit_mA} ${test.currentUnit} (${normApplicableDisplay})`}
                    </td>
                    <td className="p-2.5 font-bold font-mono text-blue-700">{test.measuredLeakageCurrent_mA} {test.currentUnit}</td>
                    <td className="p-2.5 text-center font-bold">
                      {test.measuredLeakageCurrent_mA <= normLeakageLimit ? (
                        <span className="text-emerald-700">CONFORME</span>
                      ) : (
                        <span className="text-red-700">NÃO CONFORME</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5">Rigidez / Suportabilidade à Perfuração</td>
                    <td className="p-2.5 font-semibold text-slate-800">
                      {isGlove 
                        ? `Sem disrupção ou perfuração dielétrica (Tabela 4 – Tensão de Rigidez: ${gloveTableEntry ? gloveTableEntry.tensaoRigidezAC_kV.toFixed(1) + ' kV CA' : 'NBR 16295'})` 
                        : `Sem disrupção, perfuração ou centelhamento elétrico (${normApplicableDisplay})`}
                    </td>
                    <td className="p-2.5 font-bold">
                      {test.withstandWithoutPuncture ? 'Sem perfuração dielétrica' : 'Ocorreu disrupção'}
                    </td>
                    <td className="p-2.5 text-center font-bold">
                      {test.withstandWithoutPuncture ? (
                        <span className="text-emerald-700">CONFORME</span>
                      ) : (
                        <span className="text-red-700">NÃO CONFORME</span>
                      )}
                    </td>
                  </tr>
                  {test.equipmentType === 'tapete_isolante' && test.mattingThickness_mm !== undefined && (
                    (() => {
                      const astm = getASTMD178Entry(test.equipmentClass);
                      const minReq = astm ? astm.espessuraMinima_mm : 3.2;
                      const isThickConforming = test.mattingThickness_mm >= minReq;
                      return (
                        <tr className="bg-emerald-50/30">
                          <td className="p-2.5 font-medium">Espessura Físico-Mecânica (ASTM D178-22)</td>
                          <td className="p-2.5">Mínimo de {minReq} mm (Tabela 2 - Classe {test.equipmentClass})</td>
                          <td className="p-2.5 font-bold font-mono text-slate-900">{test.mattingThickness_mm} mm</td>
                          <td className="p-2.5 text-center font-bold">
                            {isThickConforming ? (
                              <span className="text-emerald-700">CONFORME</span>
                            ) : (
                              <span className="text-red-700">NÃO CONFORME</span>
                            )}
                          </td>
                        </tr>
                      );
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section 4: Visual Inspection Checklist */}
          <div>
            <div className="bg-[#0A2540] text-white text-xs font-bold px-3 py-1.5 rounded-t-md uppercase tracking-wider">
              4. Inspeção Visual e Físico-Mecânica
            </div>
            <div className="border border-slate-300 rounded-b-md p-3 divide-y divide-slate-200 text-xs">
              {test.visualInspection.map(chk => (
                <div key={chk.id} className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">{chk.item}</span>
                  <span className={`font-bold px-2 py-0.5 rounded-sm ${
                    chk.status === 'conforme' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : chk.status === 'nao_conforme' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {chk.status === 'conforme' ? 'CONFORME' : chk.status === 'nao_conforme' ? 'NÃO CONFORME' : 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Technical Conclusion Box */}
          {(() => {
            const hasDualOpinions = test.equipmentType === 'ferramenta_isolada' && test.isolatedTools && 
              test.isolatedTools.some(t => (t.result || 'APROVADO') === 'APROVADO' && t.visualInspection !== 'nao_conforme' && t.dielectricResult !== 'nao_conforme') &&
              test.isolatedTools.some(t => t.result === 'REPROVADO' || t.visualInspection === 'nao_conforme' || t.dielectricResult === 'nao_conforme');

            const approvedToolsList = test.isolatedTools?.filter(t => (t.result || 'APROVADO') === 'APROVADO' && t.visualInspection !== 'nao_conforme' && t.dielectricResult !== 'nao_conforme') || [];
            const reprovedToolsList = test.isolatedTools?.filter(t => t.result === 'REPROVADO' || t.visualInspection === 'nao_conforme' || t.dielectricResult === 'nao_conforme') || [];

            if (hasDualOpinions) {
              return (
                <div className="space-y-4">
                  <div className="bg-[#0A2540] text-white text-xs font-bold px-3 py-1.5 rounded-t-md uppercase tracking-wider flex items-center justify-between">
                    <span>5. PARECERES TÉCNICOS CONCLUSIVOS (EMISSÃO DUPLA - APROVADAS & REPROVADAS)</span>
                    <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded font-black">
                      Lote Misto ({approvedToolsList.length} Aprovadas / {reprovedToolsList.length} Reprovadas)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* PARECER 1: FERRAMENTAS APROVADAS */}
                    <div className="p-4 rounded-xl border-2 bg-emerald-50/90 border-emerald-500 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide">
                            Parecer Técnico 1 — Ferramentas Aprovadas ({approvedToolsList.length} un)
                          </h4>
                        </div>
                        <p className="text-xs text-slate-700 mt-2 leading-relaxed">
                          {test.approvedOpinion || 
                            `As ${approvedToolsList.length} ferramenta(s) aprovadas foram ensaiadas individualmente a 10.000 V CA por 180s (NBR 9699 / IEC 60900), apresentando plena integridade da isolação e suportabilidade dielétrica sem perfuração.`}
                        </p>
                        <div className="mt-2.5 pt-2 border-t border-emerald-200">
                          <span className="text-[11px] font-bold text-emerald-900 block mb-1">Itens Homologados e Aptos:</span>
                          <ul className="text-[11px] text-slate-700 list-disc list-inside space-y-0.5">
                            {approvedToolsList.map((t, idx) => (
                              <li key={idx}>
                                <span className="font-semibold">{t.quantity}x {t.toolName}</span> {t.sizeOrSpec ? `(${t.sizeOrSpec})` : ''} - {t.manufacturer}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-300 flex flex-wrap items-center justify-between text-xs font-bold text-emerald-950">
                        <span>Validade / Reensaio:</span>
                        <span className="px-2.5 py-0.5 rounded bg-white border border-emerald-300 font-mono text-emerald-900">
                          {formatDateBR(test.retestDueDate)} (12 meses)
                        </span>
                      </div>
                    </div>

                    {/* PARECER 2: FERRAMENTAS REPROVADAS */}
                    <div className="p-4 rounded-xl border-2 bg-red-50/90 border-red-500 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                          <h4 className="text-xs font-extrabold text-red-950 uppercase tracking-wide">
                            Parecer Técnico 2 — Ferramentas Reprovadas ({reprovedToolsList.length} un)
                          </h4>
                        </div>
                        <p className="text-xs text-slate-700 mt-2 leading-relaxed">
                          {test.reprovedOpinion || 
                            `As ${reprovedToolsList.length} ferramenta(s) reprovadas NÃO atenderam aos critérios da NBR 9699 / IEC 60900. Determinada segregação imediata, etiquetação vermelha de condenação e inutilização/descarte compulsório.`}
                        </p>
                        <div className="mt-2.5 pt-2 border-t border-red-200">
                          <span className="text-[11px] font-bold text-red-900 block mb-1">Itens Condenados / Motivo de Avaria:</span>
                          <ul className="text-[11px] text-slate-700 list-disc list-inside space-y-0.5">
                            {reprovedToolsList.map((t, idx) => (
                              <li key={idx}>
                                <span className="font-semibold">{t.quantity}x {t.toolName}</span>: <span className="text-red-700 font-medium">{t.defectReason || 'Não atendeu ao ensaio 10kV / Inspeção visual'}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-red-300 flex flex-wrap items-center justify-between text-xs font-bold text-red-950">
                        <span>Ação Obrigatória (NR-10):</span>
                        <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono text-[10px] font-extrabold uppercase">
                          Segregação & Descarte
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className={`p-4 rounded-xl border-2 break-inside-avoid print:break-inside-avoid ${
                isApproved 
                  ? 'bg-emerald-50/80 border-emerald-500' 
                  : 'bg-red-50/80 border-red-500'
              }`}>
                <div className="flex items-center gap-2">
                  {isApproved ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                  <h3 className={`text-base font-extrabold ${isApproved ? 'text-emerald-900' : 'text-red-900'}`}>
                    5. PARECER TÉCNICO CONCLUSIVO: {test.result}
                    {test.equipmentType === 'ferramenta_isolada' && test.isolatedTools && test.isolatedTools.length > 0 && (
                      <span className="text-xs font-semibold ml-2 opacity-90">
                        ({test.isolatedTools.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} Ferramentas Isoladas)
                      </span>
                    )}
                  </h3>
                </div>
                <p className="text-xs text-slate-700 mt-2 leading-relaxed">
                  {test.resultRationale}
                </p>

                {test.equipmentType === 'ferramenta_isolada' && test.isolatedTools && test.isolatedTools.length > 0 && (
                  <div className={`mt-2.5 pt-2 border-t ${isApproved ? 'border-emerald-200' : 'border-red-200'}`}>
                    <span className={`text-[11px] font-bold block mb-1 ${isApproved ? 'text-emerald-900' : 'text-red-900'}`}>
                      {isApproved ? 'Itens Homologados e Aptos para Uso (NBR 9699 / IEC 60900):' : 'Itens Reprovados / Motivo de Avaria:'}
                    </span>
                    <ul className="text-[11px] text-slate-700 list-disc list-inside space-y-0.5">
                      {test.isolatedTools.map((t, idx) => (
                        <li key={idx}>
                          <span className="font-semibold">{t.quantity}x {t.toolName}</span> {t.sizeOrSpec ? `(${t.sizeOrSpec})` : ''} - {t.manufacturer}
                          {!isApproved && t.defectReason && (
                            <span className="text-red-700 font-medium ml-1">({t.defectReason})</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-300 flex flex-wrap items-center justify-between text-xs font-bold text-slate-900">
                  <span>Validade do Ensaio / Próximo Reensaio Obrigatório:</span>
                  <span className="px-3 py-1 rounded-md bg-white border border-slate-300 font-mono text-sm text-blue-800">
                    {formatDateBR(test.retestDueDate)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Section 6: Signatures & Validation Footer */}
          <div className="border-t border-slate-300 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end break-inside-avoid print:break-inside-avoid">
            <div className="text-center">
              <div className="h-16 flex items-center justify-center">
                {(techSigCleaned || effectiveTechSig) ? (
                  <img src={techSigCleaned || effectiveTechSig} alt="Assinatura Técnico" className="max-h-14 max-w-full object-contain" />
                ) : (
                  <div className="text-xs text-slate-400 italic">Assinatura Eletrônica Registrada</div>
                )}
              </div>
              <div className="border-t border-slate-400 pt-1">
                <span className="font-bold text-xs text-slate-900 block">{test.technicianName}</span>
                <span className="text-[11px] text-slate-500">{test.technicianCftOrCrea || 'Analista Executor'}</span>
              </div>
            </div>

            <div className="text-center">
              <div className="h-16 flex items-center justify-center">
                {(rtSigCleaned || effectiveRTSig) ? (
                  <img src={rtSigCleaned || effectiveRTSig} alt="Assinatura RT" className="max-h-14 max-w-full object-contain" />
                ) : (
                  <div className="text-xs text-slate-400 italic">Assinatura Eletrônica Registrada</div>
                )}
              </div>
              <div className="border-t border-slate-400 pt-1">
                <span className="font-bold text-xs text-slate-900 block">{test.techResponsibleName}</span>
                <span className="text-[11px] text-slate-500 font-mono">{test.techResponsibleCrea}</span>
                <span className="text-[10px] text-slate-400 block font-medium">Responsável Técnico</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center text-center">
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR Code Validação" className="w-20 h-20 shadow-xs rounded-sm border border-slate-200" />
              )}
              <span className="text-[10px] font-bold text-slate-700 mt-1 uppercase tracking-wider">Validação Digital</span>
              <span className="text-[10px] font-mono text-blue-700 font-bold">{test.validationCode}</span>
            </div>
          </div>

          {/* Section 7: Photographic Evidence (Página 02 - Anexo Fotográfico) */}
          {test.photos.length > 0 && (
            <div className="page-break-before-always print:break-before-page pt-4">
              <div className="bg-[#0A2540] text-white text-xs font-bold px-3 py-1.5 rounded-t-md uppercase tracking-wider flex items-center justify-between">
                <span>7. Registro Fotográfico do Ensaio Dielétrico (Página 02 - Anexo)</span>
                <span className="text-[10px] font-normal text-slate-300">
                  {test.photos.length} registro(s) anexado(s) • Grade 2x2 (4 fotos por página)
                </span>
              </div>
              <div className="border border-slate-300 rounded-b-md p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 print:grid-cols-2 print:gap-4">
                {test.photos.map(ph => {
                  const catLabels: Record<string, { label: string; color: string }> = {
                    antes: { label: '1. Inspeção Visual Preliminar', color: 'bg-blue-100 text-blue-800' },
                    durante: { label: '2. Ensaio Hipot / Tensão', color: 'bg-amber-100 text-amber-800' },
                    depois: { label: '3. Inspeção Pós-Ensaio', color: 'bg-emerald-100 text-emerald-800' },
                    disrupcao: { label: '4. Disrupção / Avaria', color: 'bg-red-100 text-red-800' },
                    outro: { label: 'Evidência Geral', color: 'bg-slate-100 text-slate-800' }
                  };
                  const badge = catLabels[ph.category] || { label: ph.category.toUpperCase(), color: 'bg-slate-100 text-slate-800' };

                  return (
                    <div key={ph.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs flex flex-col break-inside-avoid print:break-inside-avoid print:h-[120mm]">
                      <div className="px-3 py-1.5 bg-[#0A2540] text-white flex items-center justify-between shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-wide">
                          {badge.label}
                        </span>
                      </div>
                      <div className="h-48 print:h-64 bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                        <img 
                          src={ph.url} 
                          alt={ph.caption} 
                          className="w-full h-full object-contain bg-slate-950 hover:scale-105 transition-transform duration-200" 
                        />
                      </div>
                      <div className="p-3 text-xs text-slate-700 flex-1 flex flex-col justify-between space-y-2">
                        <p className="font-medium text-slate-800 leading-snug">{ph.caption}</p>
                        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                          <span>{ph.timestamp ? new Date(ph.timestamp).toLocaleString('pt-BR') : 'Data registrada'}</span>
                          <span>{ph.userName || test.technicianName}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Laudo Técnico Oficial com Assinatura Digital e Rastreabilidade QR Code</span>
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
              title="Imprimir Laudo Técnico (Ctrl+P)"
            >
              <Printer className="w-4 h-4 text-blue-700" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={handleDownloadWord}
              disabled={isExportingWord}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-98 cursor-pointer"
              title="Exportar Laudo Técnico para Microsoft Word (.doc)"
            >
              <FileText className="w-4 h-4 text-blue-100" />
              <span>{isExportingWord ? 'Gerando Word...' : 'Exportar Word'}</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-98 cursor-pointer"
              title="Baixar Laudo Técnico em PDF"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Gerando PDF...' : 'Baixar PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors active:scale-98 cursor-pointer"
              title="Fechar visualização"
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
