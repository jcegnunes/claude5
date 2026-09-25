import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Award, 
  Calendar, 
  Building2, 
  Plus, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle,
  Eye,
  QrCode,
  Zap,
  ArrowUpRight,
  Printer,
  Sparkles,
  CheckSquare,
  Square,
  MinusSquare,
  Layers,
  Tag,
  Loader2,
  Check,
  X,
  User as UserIcon,
  RotateCcw,
  Building,
  Trash2,
  AlertTriangle,
  ClipboardList,
  Edit3,
  FileSpreadsheet
} from 'lucide-react';
import { TestRecord, TestResult, Client } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { StatusBadge } from '../components/StatusBadge';
import { formatDateBR } from '../utils/dateUtils';
import { isTestEligibleForCertificate } from '../services/normsEngine';
import { 
  exportMultipleLaudosCombinedPDF,
  exportMultipleCertificadosCombinedPDF,
  exportMultipleLaudosIndividualPDF,
  exportMultipleCertificadosIndividualPDF,
  exportMultipleEtiquetasPDF
} from '../services/pdfGenerator';
import { exportTestsSummaryReportPDF } from '../services/batchSummaryReportPdfService';
import { NiimbotLabelModal } from '../components/NiimbotLabelModal';

interface TestsListViewProps {
  onOpenLaudo: (test: TestRecord) => void;
  onOpenCertificado: (test: TestRecord) => void;
  onStartNewTest: () => void;
  onValidateOnline: (code: string) => void;
  onEditTest?: (test: TestRecord) => void;
  onOpenReportEmission?: () => void;
}

export const TestsListView: React.FC<TestsListViewProps> = ({
  onOpenLaudo,
  onOpenCertificado,
  onStartNewTest,
  onValidateOnline,
  onEditTest,
  onOpenReportEmission
}) => {
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResult, setFilterResult] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterCollaborator, setFilterCollaborator] = useState<string>('all');
  const [selectedQuickTestId, setSelectedQuickTestId] = useState<string>('');
  const [quickDocType, setQuickDocType] = useState<'laudo' | 'certificado'>('laudo');

  // Multi-Selection State for Batch Emission
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [isBatchEmitting, setIsBatchEmitting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Niimbot B1 Modal State
  const [isNiimbotModalOpen, setIsNiimbotModalOpen] = useState(false);
  const [niimbotModalTests, setNiimbotModalTests] = useState<TestRecord[]>([]);

  // Delete Confirmation States
  const [testToDelete, setTestToDelete] = useState<TestRecord | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const company = DielectricStorageService.getCompanyInfo();

  useEffect(() => {
    const refreshData = () => {
      const loadedTests = DielectricStorageService.getTests();
      const loadedClients = DielectricStorageService.getClients();
      setTests(loadedTests);
      setClients(loadedClients);
      if (loadedTests.length > 0) {
        setSelectedQuickTestId(prev => (loadedTests.some(t => t.id === prev) ? prev : loadedTests[0].id));
      } else {
        setSelectedQuickTestId('');
      }
    };

    refreshData();
    window.addEventListener('jvm-data-changed', refreshData);
    return () => window.removeEventListener('jvm-data-changed', refreshData);
  }, []);

  const handleConfirmDeleteSingle = () => {
    if (!testToDelete) return;
    const testIdentifier = testToDelete.reportNumber || testToDelete.testNumber || testToDelete.equipmentTag;
    DielectricStorageService.deleteTest(testToDelete.id);
    const updated = DielectricStorageService.getTests();
    setTests(updated);
    setSelectedTestIds(prev => prev.filter(id => id !== testToDelete.id));
    setFeedbackMessage({
      type: 'success',
      text: `Ensaio ${testIdentifier} excluído com sucesso!`
    });
    setTestToDelete(null);
  };

  const handleConfirmDeleteBulk = () => {
    if (selectedTestIds.length === 0) return;
    const count = selectedTestIds.length;
    DielectricStorageService.deleteMultipleTests(selectedTestIds);
    const updated = DielectricStorageService.getTests();
    setTests(updated);
    setSelectedTestIds([]);
    setIsBulkDeleteModalOpen(false);
    setFeedbackMessage({
      type: 'success',
      text: `${count} ensaios excluídos com sucesso!`
    });
  };

  // Compute unique companies list
  const uniqueClients = useMemo(() => {
    const namesSet = new Set<string>();
    clients.forEach(c => {
      if (c.companyName) namesSet.add(c.companyName);
    });
    tests.forEach(t => {
      if (t.clientName) namesSet.add(t.clientName);
    });
    return Array.from(namesSet).sort();
  }, [clients, tests]);

  // Compute unique collaborators list (scoped to selected client if applicable)
  const uniqueCollaborators = useMemo(() => {
    const collabsSet = new Set<string>();
    const testsToScan = filterClient === 'all' 
      ? tests 
      : tests.filter(t => t.clientName.toLowerCase() === filterClient.toLowerCase() || t.clientId === filterClient);
    
    testsToScan.forEach(t => {
      if (t.collaboratorName && t.collaboratorName.trim() !== '') {
        collabsSet.add(t.collaboratorName.trim());
      }
    });
    return Array.from(collabsSet).sort();
  }, [tests, filterClient]);

  const hasActiveFilters = searchTerm !== '' || filterResult !== 'all' || filterType !== 'all' || filterClient !== 'all' || filterCollaborator !== 'all';

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterResult('all');
    setFilterType('all');
    setFilterClient('all');
    setFilterCollaborator('all');
  };

  const handleQuickEmit = () => {
    const targetTest = tests.find(t => t.id === selectedQuickTestId);
    if (!targetTest) return;

    if (quickDocType === 'certificado') {
      if (isTestEligibleForCertificate(targetTest)) {
        onOpenCertificado(targetTest);
      } else {
        alert('Este ensaio não possui ferramentas ou equipamentos aprovados para emissão de certificado.');
        onOpenLaudo(targetTest);
      }
    } else {
      onOpenLaudo(targetTest);
    }
  };

  const filteredTests = tests.filter(t => {
    const matchesSearch =
      t.reportNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.equipmentTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.collaboratorName && t.collaboratorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.collaboratorSector && t.collaboratorSector.toLowerCase().includes(searchTerm.toLowerCase())) ||
      t.serviceOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.validationCode.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesResult = filterResult === 'all' || t.result === filterResult;
    const matchesType = filterType === 'all' || t.equipmentType === filterType;
    const matchesClient = filterClient === 'all' || 
      t.clientName.toLowerCase() === filterClient.toLowerCase() || 
      t.clientId === filterClient;
    
    const matchesCollaborator = filterCollaborator === 'all'
      ? true
      : filterCollaborator === '__sem_colaborador__'
      ? (!t.collaboratorName || t.collaboratorName.trim() === '')
      : (t.collaboratorName && t.collaboratorName.toLowerCase() === filterCollaborator.toLowerCase());

    return matchesSearch && matchesResult && matchesType && matchesClient && matchesCollaborator;
  });

  // Ensure quick selection has a valid test in the current filter view
  useEffect(() => {
    if (filteredTests.length > 0 && !filteredTests.some(t => t.id === selectedQuickTestId)) {
      setSelectedQuickTestId(filteredTests[0].id);
    }
  }, [filteredTests, selectedQuickTestId]);

  const totalApproved = tests.filter(t => isTestEligibleForCertificate(t)).length;
  const totalReproved = tests.filter(t => t.result === 'REPROVADO').length;

  // Selection helpers
  const selectedTests = tests.filter(t => selectedTestIds.includes(t.id));
  const selectedApprovedCount = selectedTests.filter(t => isTestEligibleForCertificate(t)).length;
  const allFilteredSelected = filteredTests.length > 0 && filteredTests.every(t => selectedTestIds.includes(t.id));
  const someFilteredSelected = filteredTests.some(t => selectedTestIds.includes(t.id)) && !allFilteredSelected;

  const handleToggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      // Unselect all currently filtered
      const filteredIds = new Set(filteredTests.map(t => t.id));
      setSelectedTestIds(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      // Select all currently filtered
      const newIds = new Set([...selectedTestIds, ...filteredTests.map(t => t.id)]);
      setSelectedTestIds(Array.from(newIds));
    }
  };

  const handleToggleTest = (id: string) => {
    setSelectedTestIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllApproved = () => {
    const approvedIds = tests.filter(t => isTestEligibleForCertificate(t)).map(t => t.id);
    setSelectedTestIds(approvedIds);
  };

  const handleClearSelection = () => {
    setSelectedTestIds([]);
  };

  // Batch Emission Handlers
  const handleBatchEmitCombinedLaudos = async () => {
    if (selectedTests.length === 0) return;
    setIsBatchEmitting(true);
    setFeedbackMessage(null);
    try {
      await exportMultipleLaudosCombinedPDF(selectedTests, company, (current, total, message) => {
        setBatchProgress({ current, total, message });
      });
      setFeedbackMessage({
        type: 'success',
        text: `Arquivo PDF unificado com ${selectedTests.length} laudos gerado com sucesso!`
      });
    } catch (err: any) {
      console.error(err);
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao gerar laudos compilados.'
      });
    } finally {
      setIsBatchEmitting(false);
      setBatchProgress(null);
    }
  };

  const handleBatchEmitIndividualLaudos = async () => {
    if (selectedTests.length === 0) return;
    setIsBatchEmitting(true);
    setFeedbackMessage(null);
    try {
      await exportMultipleLaudosIndividualPDF(selectedTests, company, (current, total, message) => {
        setBatchProgress({ current, total, message });
      });
      setFeedbackMessage({
        type: 'success',
        text: `${selectedTests.length} laudos individuais exportados em PDF!`
      });
    } catch (err: any) {
      console.error(err);
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao baixar laudos individuais.'
      });
    } finally {
      setIsBatchEmitting(false);
      setBatchProgress(null);
    }
  };

  const handleBatchEmitCombinedCertificados = async () => {
    const approved = selectedTests.filter(t => isTestEligibleForCertificate(t));
    if (approved.length === 0) {
      alert('Nenhum dos ensaios selecionados possui ferramentas ou equipamentos aprovados para emissão de certificado de conformidade.');
      return;
    }
    setIsBatchEmitting(true);
    setFeedbackMessage(null);
    try {
      await exportMultipleCertificadosCombinedPDF(approved, company, (current, total, message) => {
        setBatchProgress({ current, total, message });
      });
      setFeedbackMessage({
        type: 'success',
        text: `Certificados de conformidade compilados (${approved.length} itens) gerados com sucesso!`
      });
    } catch (err: any) {
      console.error(err);
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao gerar certificados compilados.'
      });
    } finally {
      setIsBatchEmitting(false);
      setBatchProgress(null);
    }
  };

  const handleBatchEmitIndividualCertificados = async () => {
    const approved = selectedTests.filter(t => isTestEligibleForCertificate(t));
    if (approved.length === 0) {
      alert('Nenhum dos ensaios selecionados possui ferramentas ou equipamentos aprovados para emissão de certificado.');
      return;
    }
    setIsBatchEmitting(true);
    setFeedbackMessage(null);
    try {
      await exportMultipleCertificadosIndividualPDF(approved, company, (current, total, message) => {
        setBatchProgress({ current, total, message });
      });
      setFeedbackMessage({
        type: 'success',
        text: `${approved.length} certificados individuais exportados em PDF!`
      });
    } catch (err: any) {
      console.error(err);
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao baixar certificados individuais.'
      });
    } finally {
      setIsBatchEmitting(false);
      setBatchProgress(null);
    }
  };

  const handleBatchEmitEtiquetas = async () => {
    if (selectedTests.length === 0) return;
    setNiimbotModalTests(selectedTests);
    setIsNiimbotModalOpen(true);
  };

  const handleBatchEmitSummaryReportPDF = async () => {
    if (selectedTests.length === 0) return;
    setIsBatchEmitting(true);
    setFeedbackMessage(null);
    try {
      await exportTestsSummaryReportPDF(selectedTests, company, clients);
      setFeedbackMessage({
        type: 'success',
        text: `Relatório Técnico Consolidado em PDF com a tabulação de ${selectedTests.length} ensaios organizado por colaborador gerado com sucesso!`
      });
    } catch (err: any) {
      console.error(err);
      setFeedbackMessage({
        type: 'error',
        text: err?.message || 'Erro ao gerar relatório consolidado em PDF.'
      });
    } finally {
      setIsBatchEmitting(false);
    }
  };

  const handleOpenNiimbotModalForSingle = (test: TestRecord) => {
    setNiimbotModalTests([test]);
    setIsNiimbotModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Histórico de Ensaios & Laudos Técnicos</h2>
          <p className="text-xs text-slate-500">
            Emissão individual ou simultânea em lote de laudos, certificados de conformidade e etiquetas NR-10
          </p>
        </div>

        <button
          onClick={onStartNewTest}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Ensaio Dielétrico
        </button>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
          feedbackMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-red-50 text-red-800 border border-red-300'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CAMPO DE EMISSÃO RÁPIDA DE CERTIFICADO / LAUDO (INDIVIDUAL) */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-blue-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-400/30">
                <Printer className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-sm text-white">Central de Emissão Direta</h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-md border border-emerald-500/30 uppercase tracking-wider">
                {totalApproved} Certificados Disponíveis
              </span>
            </div>
            <p className="text-xs text-slate-300">
              {hasActiveFilters 
                ? `Exibindo ${filteredTests.length} laudos filtrados para emissão rápida (ou use os filtros e checkboxes abaixo para emissão em lote)`
                : 'Emita documentos individualmente ou utilize os filtros por Empresa e Colaborador para emissão simultânea'}
            </p>
          </div>

          {/* Quick Emission Form Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-slate-950/60 p-2 rounded-xl border border-slate-700/60">
            <div className="min-w-[220px]">
              <select
                value={selectedQuickTestId}
                onChange={(e) => setSelectedQuickTestId(e.target.value)}
                className="w-full bg-slate-900 text-white text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {(filteredTests.length > 0 ? filteredTests : tests).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.reportNumber} - {t.equipmentTag} ({t.clientName}{t.collaboratorName ? ` - ${t.collaboratorName}` : ''}) [{t.result}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={quickDocType}
                onChange={(e) => setQuickDocType(e.target.value as any)}
                className="w-full bg-slate-900 text-amber-300 text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="certificado">🏆 Certificado de Conformidade</option>
                <option value="laudo">📄 Laudo Técnico Dielétrico</option>
              </select>
            </div>

            <button
              onClick={handleQuickEmit}
              disabled={!selectedQuickTestId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-98"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Emitir</span>
            </button>
          </div>
        </div>
      </div>

      {/* PAINEL DE EMISSÃO EM LOTE / SIMULTÂNEA (QUANDO HÁ ITENS SELECIONADOS) */}
      {selectedTestIds.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 rounded-2xl p-4 sm:p-5 shadow-lg border border-amber-300 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-slate-950 text-amber-400 rounded-lg">
                  <Layers className="w-4 h-4" />
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-950">
                  Emissão Simultânea em Lote ({selectedTestIds.length} laudos selecionados)
                </h3>
              </div>
              <p className="text-xs text-slate-900 font-medium">
                {selectedApprovedCount} Aprovados (com Certificado) • {selectedTestIds.length - selectedApprovedCount} Reprovados • Gere PDF unificado ou arquivos individuais
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Botão 1: Laudos Compilados (1 PDF) */}
              <button
                onClick={handleBatchEmitCombinedLaudos}
                disabled={isBatchEmitting}
                className="px-3.5 py-2 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-98"
                title="Gera 1 único arquivo PDF contendo todos os laudos técnicos selecionados em sequência"
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Laudos (PDF Compilado)</span>
              </button>

              {/* Botão 2: Baixar Laudos Individuais */}
              <button
                onClick={handleBatchEmitIndividualLaudos}
                disabled={isBatchEmitting}
                className="px-3 py-2 bg-white/90 hover:bg-white text-slate-900 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-98"
                title="Baixa cada laudo técnico como arquivo PDF individual"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Laudos Individuais</span>
              </button>

              {/* Botão 3: Certificados Compilados */}
              <button
                onClick={handleBatchEmitCombinedCertificados}
                disabled={isBatchEmitting || selectedApprovedCount === 0}
                className="px-3.5 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-98"
                title="Gera 1 arquivo PDF unificado com os certificados de conformidade dos ensaios aprovados"
              >
                <Award className="w-3.5 h-3.5 text-amber-300" />
                <span>Certificados ({selectedApprovedCount})</span>
              </button>

              {/* Botão 4: Relatório Consolidado em PDF dos Ensaios */}
              {onOpenReportEmission ? (
                <button
                  onClick={onOpenReportEmission}
                  disabled={isBatchEmitting}
                  className="px-3.5 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-98 cursor-pointer"
                  title="Abre o módulo de Emissão de Relatório Técnico Completo com Capa, Sumário, Introdução, Metodologia, Normas, Laudos e Conclusão"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-200" />
                  <span>Emissão de Dossiê Técnico</span>
                </button>
              ) : (
                <button
                  onClick={handleBatchEmitSummaryReportPDF}
                  disabled={isBatchEmitting}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-98 cursor-pointer"
                  title="Gera relatório técnico em PDF contendo cabeçalho do cliente, normas técnicas aplicadas e tabulação dos equipamentos organizada por colaborador"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Relatório Consolidado (PDF)</span>
                </button>
              )}

              {/* Botão 5: Etiquetas Térmicas Niimbot B1 em Lote */}
              <button
                onClick={handleBatchEmitEtiquetas}
                disabled={isBatchEmitting}
                className="px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-98 cursor-pointer"
                title="Gera e exporta etiquetas térmicas compatíveis com Niimbot B1 (Projeto .JCPS Oficial, 203 DPI, PDF 1:1, PNG, CSV Lote)"
              >
                <Tag className="w-3.5 h-3.5 text-white" />
                <span>Etiquetas Niimbot B1</span>
              </button>

              {/* Botão 6: Excluir Selecionados */}
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                disabled={isBatchEmitting}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-98 cursor-pointer"
                title="Excluir todos os ensaios selecionados"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir ({selectedTestIds.length})</span>
              </button>

              {/* Botão 7: Desmarcar */}
              <button
                onClick={handleClearSelection}
                disabled={isBatchEmitting}
                className="px-2.5 py-2 bg-black/10 hover:bg-black/20 text-slate-950 font-bold text-xs rounded-xl transition-colors"
                title="Desmarcar todos os itens selecionados"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROGRESS OVERLAY MODAL */}
      {isBatchEmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto animate-spin">
              <Loader2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-base text-slate-900">Processando Emissão em Lote</h4>
              <p className="text-xs text-slate-500 mt-1">
                {batchProgress?.message || 'Renderizando documentos e calculando assinaturas digitais...'}
              </p>
            </div>

            {batchProgress && (
              <div className="space-y-1.5">
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>{batchProgress.current} de {batchProgress.total}</span>
                  <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter Bar & Quick Selection Toolbar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
        {/* Title & Filter Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Filtros para Consulta & Emissão de Laudos
            </h3>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Limpar Filtros
            </button>
          )}
        </div>

        {/* 5-Field Responsive Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Busca Geral */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar Laudo, Tag, OS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* 2. FILTRO POR EMPRESA / CLIENTE */}
          <div className="relative">
            <Building2 className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={filterClient}
              onChange={(e) => {
                setFilterClient(e.target.value);
                setFilterCollaborator('all');
              }}
              className={`w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold truncate cursor-pointer ${
                filterClient !== 'all' ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-bold' : 'border-slate-300 text-slate-700 bg-white'
              }`}
              title="Filtrar ensaios por Empresa / Cliente"
            >
              <option value="all">🏢 Todas as Empresas</option>
              {uniqueClients.map(cName => (
                <option key={cName} value={cName}>
                  {cName}
                </option>
              ))}
            </select>
          </div>

          {/* 3. FILTRO POR COLABORADOR */}
          <div className="relative">
            <UserIcon className="w-4 h-4 text-orange-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={filterCollaborator}
              onChange={(e) => setFilterCollaborator(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-orange-500 font-semibold truncate cursor-pointer ${
                filterCollaborator !== 'all' ? 'border-orange-500 bg-orange-50/50 text-orange-900 font-bold' : 'border-slate-300 text-slate-700 bg-white'
              }`}
              title="Filtrar ensaios por Colaborador / Usuário do EPI"
            >
              <option value="all">👤 Todos os Colaboradores</option>
              {uniqueCollaborators.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="__sem_colaborador__">⚠️ Sem colaborador atribuído</option>
            </select>
          </div>

          {/* 4. Filtro por Resultado */}
          <div>
            <select
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              className={`w-full p-2 text-xs border rounded-xl focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer ${
                filterResult !== 'all' ? 'border-blue-500 bg-blue-50/40 text-blue-900 font-bold' : 'border-slate-300 text-slate-700 bg-white'
              }`}
            >
              <option value="all">Todos os Resultados</option>
              <option value="APROVADO">✅ Aprovados</option>
              <option value="REPROVADO">❌ Reprovados</option>
              <option value="PENDENTE">⏳ Pendentes</option>
            </select>
          </div>

          {/* 5. Filtro por Tipo de Equipamento */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`w-full p-2 text-xs border rounded-xl focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer ${
                filterType !== 'all' ? 'border-blue-500 bg-blue-50/40 text-blue-900 font-bold' : 'border-slate-300 text-slate-700 bg-white'
              }`}
            >
              <option value="all">Todos os Tipos de EPI / EPC</option>
              <option value="luva_isolante">🧤 Luvas Isolantes (NBR 16295)</option>
              <option value="manga_isolante">🛡️ Mangas Isolantes (NBR 10624)</option>
              <option value="manta_isolante">🟨 Mantas de Cobertura (ASTM D1048)</option>
              <option value="tapete_isolante">🟩 Tapetes Isolantes (ASTM D178-22)</option>
              <option value="bastao_manobra">🦯 Bastões de Manobra (NBR 14540)</option>
              <option value="vara_manobra">🔭 Varas Telescópicas</option>
              <option value="cobertura_rigida">🛡️ Coberturas Rígidas (ASTM F712)</option>
              <option value="ferramenta_isolada">🔧 Ferramentas Isoladas (NBR 9699)</option>
            </select>
          </div>
        </div>

        {/* Quick Selection Filter Chips & Summary */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">Seleção para Lote:</span>
            
            <button
              onClick={handleToggleSelectAllFiltered}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              <span>{allFilteredSelected ? 'Desmarcar Visíveis' : `Selecionar Todos Visíveis (${filteredTests.length})`}</span>
            </button>

            <button
              onClick={handleSelectAllApproved}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Selecionar Aprovados ({filteredTests.filter(t => t.result === 'APROVADO').length})</span>
            </button>

            {selectedTestIds.length > 0 && (
              <button
                onClick={handleClearSelection}
                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Limpar Seleção ({selectedTestIds.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
            {filterClient !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-semibold">
                <Building2 className="w-3 h-3" /> {filterClient}
              </span>
            )}
            {filterCollaborator !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-md font-semibold">
                <UserIcon className="w-3 h-3" /> {filterCollaborator === '__sem_colaborador__' ? 'Sem Colaborador' : filterCollaborator}
              </span>
            )}
            <span>Exibindo <strong>{filteredTests.length}</strong> de {tests.length} ensaios</span>
          </div>
        </div>
      </div>

      {/* Tests Table with Checkboxes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                {/* SELECT ALL CHECKBOX COLUMN */}
                <th className="p-3.5 w-10 text-center">
                  <button
                    onClick={handleToggleSelectAllFiltered}
                    className="p-1 rounded text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                    title={allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : someFilteredSelected ? (
                      <MinusSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="p-3.5">Nº do Laudo</th>
                <th className="p-3.5">Tag & Equipamento</th>
                <th className="p-3.5">Empresa / Cliente</th>
                <th className="p-3.5">Colaborador / Setor</th>
                <th className="p-3.5">Data / Hora</th>
                <th className="p-3.5">Tensão Aplicada</th>
                <th className="p-3.5">Fuga Medida</th>
                <th className="p-3.5">Próximo Reensaio</th>
                <th className="p-3.5">Resultado</th>
                <th className="p-3.5 text-right">Documentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredTests.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 space-y-2">
                    <p className="text-sm font-semibold text-slate-600">Nenhum ensaio encontrado para os filtros selecionados.</p>
                    <p className="text-xs text-slate-400">Tente ajustar a busca, empresa ou colaborador selecionado.</p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Limpar Todos os Filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTests.map(test => {
                  const isSelected = selectedTestIds.includes(test.id);
                  return (
                    <tr 
                      key={test.id} 
                      className={`transition-colors ${
                        isSelected ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* ROW CHECKBOX */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleTest(test.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5">
                        <span className="font-extrabold font-mono text-blue-700 block">{test.reportNumber}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Val: {test.validationCode}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-slate-900 block">{test.equipmentTag}</span>
                        <span className="text-[11px] text-slate-500 uppercase">{test.equipmentType.replace('_', ' ')} (Classe {test.equipmentClass})</span>
                      </td>
                      <td className="p-3.5">
                        <span className="text-slate-900 font-bold block flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          {test.clientName}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono block">OS: {test.serviceOrderNumber}</span>
                      </td>
                      <td className="p-3.5">
                        {test.collaboratorName ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 flex items-center gap-1 text-xs">
                              <UserIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                              {test.collaboratorName}
                            </span>
                            {test.collaboratorSector && (
                              <span className="text-[10px] text-slate-500 block truncate max-w-[160px]">
                                {test.collaboratorSector}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Não atribuído</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        <div>{formatDateBR(test.testDate)}</div>
                        <div className="text-[10px] text-slate-400">{test.testTime}</div>
                      </td>
                      <td className="p-3.5 font-bold font-mono text-slate-800">
                        {test.appliedVoltage_kV} kV {test.voltageType}
                      </td>
                      <td className="p-3.5 font-bold font-mono text-blue-700">
                        {test.measuredLeakageCurrent_mA} {test.currentUnit}
                      </td>
                      <td className="p-3.5 font-bold font-mono text-slate-800">
                        {formatDateBR(test.retestDueDate)}
                      </td>
                      <td className="p-3.5">
                        <StatusBadge type="test" status={test.result} size="sm" />
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onEditTest && (
                            <button
                              onClick={() => onEditTest(test)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Editar este Ensaio Concluído"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                              <span>Editar</span>
                            </button>
                          )}

                          <button
                            onClick={() => onOpenLaudo(test)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Abrir Laudo Técnico Completo"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" /> Laudo
                          </button>

                          {isTestEligibleForCertificate(test) && (
                            <button
                              onClick={() => onOpenCertificado(test)}
                              className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Abrir Certificado de Conformidade"
                            >
                              <Award className="w-3.5 h-3.5 text-orange-600" /> Certificado
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenNiimbotModalForSingle(test)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            title="Gerar e Imprimir Etiqueta Niimbot B1 (203 DPI)"
                          >
                            <Tag className="w-3.5 h-3.5 text-amber-600" />
                            <span className="hidden xl:inline">Etiqueta B1</span>
                          </button>

                          <button
                            onClick={() => onValidateOnline(test.validationCode)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            title="Validar Autenticidade no Portal Público"
                          >
                            <QrCode className="w-3.5 h-3.5 text-slate-700" />
                          </button>

                          <button
                            onClick={() => setTestToDelete(test)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Excluir este Ensaio Dielétrico"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO INDIVIDUAL */}
      {testToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Excluir Ensaio Dielétrico</h4>
                <p className="text-xs text-slate-500">Confirmação de exclusão auditada</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Nº Laudo:</span>
                <span className="font-bold font-mono text-slate-900">{testToDelete.reportNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Tag / Equipamento:</span>
                <span className="font-bold text-slate-900">{testToDelete.equipmentTag} ({testToDelete.equipmentType.replace('_', ' ')})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Empresa / Cliente:</span>
                <span className="font-semibold text-slate-800">{testToDelete.clientName}</span>
              </div>
              {testToDelete.collaboratorName && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Colaborador:</span>
                  <span className="font-semibold text-slate-800">{testToDelete.collaboratorName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Data do Ensaio:</span>
                <span className="font-mono text-slate-700">{formatDateBR(testToDelete.testDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Resultado:</span>
                <span className={`font-bold ${testToDelete.result === 'APROVADO' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {testToDelete.result}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Tem certeza que deseja excluir este ensaio? O registro será marcado como excluído e o histórico de auditoria será atualizado.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setTestToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteSingle}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO EM LOTE */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Excluir Ensaios em Lote</h4>
                <p className="text-xs text-slate-500">{selectedTestIds.length} ensaios selecionados</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você selecionou <strong>{selectedTestIds.length} ensaio(s)</strong> para exclusão definitiva. Todos os laudos e registros vinculados a estes ensaios serão excluídos com rastreabilidade nos logs de auditoria.
            </p>

            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 space-y-1">
              {selectedTests.map(t => (
                <div key={t.id} className="text-[11px] flex items-center justify-between py-1 px-2 border-b border-slate-100 last:border-0">
                  <span className="font-mono font-bold text-slate-800">{t.reportNumber}</span>
                  <span className="text-slate-600">{t.equipmentTag} - {t.clientName}</span>
                  <span className={`font-bold ${t.result === 'APROVADO' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {t.result}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDeleteBulk}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir {selectedTestIds.length} Itens</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ETIQUETAS NIIMBOT B1 */}
      <NiimbotLabelModal
        isOpen={isNiimbotModalOpen}
        onClose={() => setIsNiimbotModalOpen(false)}
        tests={niimbotModalTests}
        company={company}
      />
    </div>
  );
};
