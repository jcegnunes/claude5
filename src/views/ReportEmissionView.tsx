import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Save, 
  Plus, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle, 
  Building2, 
  ClipboardList, 
  Calendar, 
  Shield, 
  Gauge, 
  UserCheck, 
  FileCheck2, 
  Eye, 
  Edit3, 
  Trash2, 
  CheckSquare, 
  Square, 
  Search, 
  Filter, 
  BookOpen, 
  Layers, 
  FileSpreadsheet, 
  QrCode, 
  ChevronRight, 
  Sparkles,
  ExternalLink,
  Award,
  Paperclip,
  FileDown
} from 'lucide-react';
import { 
  ConsolidatedReport, 
  TestRecord, 
  Client, 
  ServiceOrder, 
  CompanyLabInfo, 
  User, 
  LabInstrument 
} from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { formatDateBR } from '../utils/dateUtils';
import { exportConsolidatedReportPDF } from '../services/consolidatedReportPdfService';
import { exportTestsSummaryReportPDF } from '../services/batchSummaryReportPdfService';
import { exportReportToWord } from '../services/wordReportService';
import { getApplicableNormsList, getEquipmentTypeDescription, exportTestsSpreadsheet } from '../services/spreadsheetService';
import { getEffectiveCollaborator } from '../services/pdfGenerator';

interface ReportEmissionViewProps {
  currentUser: User;
  onOpenTestLaudo?: (test: TestRecord) => void;
  preSelectedOSId?: string;
  preSelectedClientId?: string;
}

export const ReportEmissionView: React.FC<ReportEmissionViewProps> = ({
  currentUser,
  onOpenTestLaudo,
  preSelectedOSId,
  preSelectedClientId
}) => {
  // Navigation tabs inside the report module
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'history'>('preview');

  // Report Format: 'simplificado' (Resumo por Colaborador) vs 'completo' (Dossiê Completo NR-10)
  const [reportFormat, setReportFormat] = useState<'simplificado' | 'completo'>('simplificado');

  // Data from storage
  const [clients, setClients] = useState<Client[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [allTests, setAllTests] = useState<TestRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [labInstruments, setLabInstruments] = useState<LabInstrument[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyLabInfo>(() => DielectricStorageService.getCompanyInfo());
  const [savedReports, setSavedReports] = useState<ConsolidatedReport[]>([]);

  // Selection & Filters
  const [selectedClientId, setSelectedClientId] = useState<string>(preSelectedClientId || '');
  const [selectedOSId, setSelectedOSId] = useState<string>(preSelectedOSId || '');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Report Editable State
  const [reportCode, setReportCode] = useState<string>('');
  const [reportTitle, setReportTitle] = useState<string>('RELATÓRIO TÉCNICO SIMPLIFICADO & TABULAÇÃO DE ENSAIOS DIELÉTRICOS');
  const [artNumber, setArtNumber] = useState<string>('');
  const [emissionDate, setEmissionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState<string>('Laboratório Móvel JVM');
  const [technicianName, setTechnicianName] = useState<string>('');
  const [technicianCreaOrCft, setTechnicianCreaOrCft] = useState<string>('');
  const [techResponsibleName, setTechResponsibleName] = useState<string>('');
  const [techResponsibleCrea, setTechResponsibleCrea] = useState<string>('');
  const [techResponsibleRnp, setTechResponsibleRnp] = useState<string>('');

  // Customizable Text Sections
  const [introductionText, setIntroductionText] = useState<string>('');
  const [methodologyText, setMethodologyText] = useState<string>('');
  const [normsText, setNormsText] = useState<string>('');
  const [resultsAnalysisText, setResultsAnalysisText] = useState<string>('');
  const [conclusionText, setConclusionText] = useState<string>('');

  // Annex Configuration State
  const [includeIndividualReportsAnnex, setIncludeIndividualReportsAnnex] = useState<boolean>(true);
  const [annexTitle, setAnnexTitle] = useState<string>('ANEXO I – LAUDOS TÉCNICOS INDIVIDUAIS DOS ENSAIOS DIELÉTRICOS');

  // Export / Progress State
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [isExportingWord, setIsExportingWord] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Load Initial Data
  const loadData = () => {
    const cls = DielectricStorageService.getClients();
    const sos = DielectricStorageService.getServiceOrders();
    const tests = DielectricStorageService.getTests();
    const usrs = DielectricStorageService.getUsers();
    const insts = DielectricStorageService.getInstruments();
    const comp = DielectricStorageService.getCompanyInfo();
    const reps = DielectricStorageService.getConsolidatedReports();

    setClients(cls);
    setServiceOrders(sos);
    setAllTests(tests);
    setUsers(usrs);
    setLabInstruments(insts);
    setCompanyInfo(comp);
    setSavedReports(reps);

    // Initial Responsible Technical info
    if (!techResponsibleName) {
      setTechResponsibleName(comp.technicalResponsible.name || 'Eng. João Nunes');
      setTechResponsibleCrea(comp.technicalResponsible.creaNumber || 'CREA-SP 5069812401');
      setTechResponsibleRnp(comp.technicalResponsible.rnp || '261984210-9');
    }

    if (!technicianName) {
      const techUser = usrs.find(u => u.role === 'tecnico' || u.role === 'responsavel_tecnico') || currentUser;
      setTechnicianName(techUser.name);
      setTechnicianCreaOrCft(techUser.creaOrCft || 'CFT-BR 145982');
    }

    if (!reportCode) {
      setReportCode(DielectricStorageService.generateNextReportCode());
    }
  };

  useEffect(() => {
    loadData();
    const handleChanged = () => loadData();
    window.addEventListener('jvm-data-changed', handleChanged);
    return () => window.removeEventListener('jvm-data-changed', handleChanged);
  }, []);

  // Sync selected OS with Client and initial test batch
  useEffect(() => {
    if (selectedOSId) {
      const os = serviceOrders.find(o => o.id === selectedOSId || o.osNumber === selectedOSId);
      if (os) {
        if (!selectedClientId) setSelectedClientId(os.clientId);
        if (os.artNumber) setArtNumber(os.artNumber);
        
        // Auto-select all tests belonging to this OS
        const osTests = allTests.filter(t => t.serviceOrderId === os.id || t.serviceOrderNumber === os.osNumber);
        if (osTests.length > 0) {
          setSelectedTestIds(osTests.map(t => t.id));
        }
      }
    }
  }, [selectedOSId, serviceOrders, allTests]);

  // Sync Client selection with tests if no OS is picked
  useEffect(() => {
    if (selectedClientId && !selectedOSId) {
      const clientTests = allTests.filter(t => t.clientId === selectedClientId);
      setSelectedTestIds(clientTests.map(t => t.id));
    }
  }, [selectedClientId, selectedOSId, allTests]);

  // Filtered Tests available for selection
  const availableTests = useMemo(() => {
    return allTests.filter(test => {
      if (selectedClientId && test.clientId !== selectedClientId) return false;
      if (selectedOSId) {
        const os = serviceOrders.find(o => o.id === selectedOSId);
        if (os && test.serviceOrderId !== os.id && test.serviceOrderNumber !== os.osNumber) return false;
      }
      if (filterStartDate && test.testDate < filterStartDate) return false;
      if (filterEndDate && test.testDate > filterEndDate) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const tag = (test.equipmentTag || '').toLowerCase();
        const client = (test.clientName || '').toLowerCase();
        const rep = (test.reportNumber || '').toLowerCase();
        const os = (test.serviceOrderNumber || '').toLowerCase();
        const eqType = (test.equipmentType || '').toLowerCase();
        if (!tag.includes(term) && !client.includes(term) && !rep.includes(term) && !os.includes(term) && !eqType.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [allTests, selectedClientId, selectedOSId, filterStartDate, filterEndDate, searchTerm, serviceOrders]);

  // Included tests in current report
  const selectedTests = useMemo(() => {
    return allTests.filter(t => selectedTestIds.includes(t.id));
  }, [allTests, selectedTestIds]);

  // Statistics calculation
  const reportStats = useMemo(() => {
    const total = selectedTests.length;
    const approved = selectedTests.filter(t => t.result === 'APROVADO').length;
    const rejected = selectedTests.filter(t => t.result === 'REPROVADO').length;
    const approvalRate = total > 0 ? (approved / total) * 100 : 100;
    return { total, approved, rejected, approvalRate };
  }, [selectedTests]);

  // Selected Client Object
  const currentClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || {
      id: selectedClientId || 'c-default',
      razaoSocial: selectedTests[0]?.clientName || 'Cliente Solicitante',
      nomeFantasia: selectedTests[0]?.clientName || 'Cliente Solicitante',
      cnpj: 'Consulte cadastro do cliente',
      endereco: 'Endereço registrado na OS',
      numero: 'S/N',
      bairro: 'Industrial',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000-000',
      telefone: '(11) 99999-9999',
      email: 'contato@cliente.com.br',
      responsavel: 'SESMT / Segurança do Trabalho',
      cargoResponsavel: 'Coordenador de SST',
      createdAt: '',
      updatedAt: ''
    };
  }, [clients, selectedClientId, selectedTests]);

  // Helper to fill default text contents if empty
  const getDefaultIntro = () => {
    return `O presente Relatório Técnico tem por objetivo consolidar e apresentar os resultados dos ensaios de rigidez dielétrica e inspeções visuais periódicas realizadas no lote de Equipamentos de Proteção Individual (EPI) e Equipamentos de Proteção Coletiva (EPC) pertencentes à empresa ${currentClient.razaoSocial}.\n\n` +
      `Em atendimento estrito às diretrizes da Norma Regulamentadora NR-10 (Segurança em Instalações e Serviços em Eletricidade), especificamente o item 10.7.8 que preconiza que "os equipamentos, ferramentas e dispositivos isolantes ou equipados com materiais isolantes destinados ao trabalho em alta tensão devem ser submetidos a testes elétricos periódicos", este documento atesta a conformidade dos equipamentos quanto à integridade física e capacidade de suportabilidade dielétrica para o nível de tensão de trabalho requerido.\n\n` +
      `Os ensaios foram conduzidos no laboratório especializado da ${companyInfo.name} com instrumentos rastreáveis à Rede Brasileira de Calibração (RBC), garantindo total confiabilidade metrológica, segurança aos operadores e rastreabilidade jurídica conforme exigido pelas normas técnicas brasileiras e internacionais aplicáveis.`;
  };

  const getDefaultAnalysis = () => {
    return `Do total de ${reportStats.total} equipamentos ensaiados e inspecionados pertencentes à empresa ${currentClient.razaoSocial}, registrou-se ${reportStats.approved} itens em plena conformidade técnica e operacional (${reportStats.approvalRate.toFixed(1)}% de aprovação), e ${reportStats.rejected} itens não conformes (${((reportStats.rejected / (reportStats.total || 1)) * 100).toFixed(1)}% de reprovação).\n\n` +
      `As medições de corrente de fuga mantiveram-se dentro da margem de segurança operacional em relação aos tetos normativos estabelecidos pelas normas ABNT NBR 16295 e correlatas. Não foram identificados efeitos térmicos de aquecimento anômalo ou perfuração dielétrica nos itens aprovados. Os equipamentos aprovados encontram-se liberados para uso contínuo em intervenções elétricas no escopo de suas respectivas classes de tensão.`;
  };

  const getDefaultConclusion = () => {
    return `Conclui-se que o lote de equipamentos analisado atende aos requisitos técnicos de segurança prescritos na Norma Regulamentadora NR-10 e normas técnicas correlatas para os itens classificados como APROVADOS.\n\n` +
      `RECOMENDAÇÕES E DIRETRIZES DE USO:\n` +
      `1. Periodicidade de Reensaio: Os equipamentos devem ser submetidos a novo ensaio dielétrico em laboratório no prazo de 6 (seis) meses para luvas e mangas de borracha, e até 12 (doze) meses para mantas, tapetes, ferramentas e bastões isolantes, ou imediatamente caso sofram agressão mecânica, química ou perfuração suspeita.\n` +
      `2. Inspeção Diária Pré-Uso: O usuário deve obrigatoriamente realizar o teste de insuflação de ar em luvas antes de cada início de jornada de trabalho.\n` +
      `3. Acondicionamento: Armazenar em local seco, fresco, abrigado da luz solar direta, calor, óleo e produtos químicos agressivos.\n` +
      `4. Itens Reprovados: Os equipamentos reprovados devem ser destruídos/descartados para impedir seu reuso inadvertido.`;
  };

  // Applicable Norms calculation
  const applicableNorms = useMemo(() => {
    return getApplicableNormsList(selectedTests);
  }, [selectedTests]);

  // Prepared data grouped & ordered by Collaborator
  const preparedCollaboratorGroups = useMemo(() => {
    const workOrders = serviceOrders;
    const equipments = DielectricStorageService.getEquipment();

    const items = selectedTests.map(test => {
      const matchingOS = workOrders.find(o => o.id === test.serviceOrderId || o.osNumber === test.serviceOrderNumber);
      const matchingEq = equipments.find(e => e.id === test.equipmentId || e.tag === test.equipmentTag);

      const collaboratorName = getEffectiveCollaborator(test) || 'Colaborador Não Especificado / Geral';
      const collaboratorRegistration = test.collaboratorRegistration || matchingOS?.collaboratorRegistration || matchingEq?.collaboratorRegistration || '-';
      const collaboratorSector = test.collaboratorSector || matchingOS?.collaboratorSector || matchingEq?.collaboratorSector || matchingEq?.sector || 'Geral';

      let dimensionOrLength = '-';
      if (test.gloveLength_mm) {
        dimensionOrLength = `${test.gloveLength_mm}mm`;
      } else if (test.blanketDimensions) {
        dimensionOrLength = test.blanketDimensions;
      } else if (test.mattingDimensions) {
        dimensionOrLength = test.mattingDimensions;
      } else if (matchingEq?.sizeOrLength) {
        dimensionOrLength = matchingEq.sizeOrLength;
      }

      return {
        test,
        collaboratorName,
        collaboratorRegistration,
        collaboratorSector,
        reportNumber: test.reportNumber || test.testNumber,
        certificateNumber: test.certificateNumber || (test.result === 'APROVADO' ? '-' : 'N/A'),
        equipmentTag: test.equipmentTag || '-',
        equipmentTypeName: getEquipmentTypeDescription(test.equipmentType, matchingEq?.customTypeName),
        caNumber: test.equipmentCa || matchingEq?.caNumber || '-',
        dielectricClass: `Cl. ${test.equipmentClass || '0'}`,
        dimensionOrLength,
        appliedVoltage_kV: test.appliedVoltage_kV || 0,
        voltageType: test.voltageType || 'AC',
        measuredLeakage_mA: Number(test.measuredLeakageCurrent_mA?.toFixed(2)) || 0,
        leakageLimit_mA: Number(test.leakageCurrentLimit_mA?.toFixed(2)) || 0,
        testDate: formatDateBR(test.testDate),
        retestDueDate: formatDateBR(test.retestDueDate),
        result: test.result
      };
    });

    // Group by collaborator
    const groups: Record<string, typeof items> = {};
    items.forEach(item => {
      const key = item.collaboratorName;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    // Sort keys: non-generic first, then alphabetical
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const aIsGen = a.includes('Não Especificado');
      const bIsGen = b.includes('Não Especificado');
      if (aIsGen && !bIsGen) return 1;
      if (!aIsGen && bIsGen) return -1;
      return a.localeCompare(b, 'pt-BR');
    });

    return sortedKeys.map(key => {
      const groupItems = groups[key].sort((a, b) => a.equipmentTag.localeCompare(b.equipmentTag, 'pt-BR'));
      const total = groupItems.length;
      const approved = groupItems.filter(i => i.result === 'APROVADO').length;
      const rejected = total - approved;
      const reg = groupItems.find(i => i.collaboratorRegistration && i.collaboratorRegistration !== '-')?.collaboratorRegistration || '';
      const sector = groupItems.find(i => i.collaboratorSector && i.collaboratorSector !== 'Geral')?.collaboratorSector || '';

      return {
        collaboratorName: key,
        collaboratorRegistration: reg,
        collaboratorSector: sector,
        items: groupItems,
        total,
        approved,
        rejected
      };
    });
  }, [selectedTests, serviceOrders]);

  // Build the consolidated report object
  const buildReportObject = (): ConsolidatedReport => {
    const selectedOS = serviceOrders.find(o => o.id === selectedOSId);
    return {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      reportCode: reportCode || DielectricStorageService.generateNextReportCode(),
      title: reportTitle,
      clientId: currentClient.id,
      clientName: currentClient.razaoSocial,
      clientCnpj: currentClient.cnpj,
      clientAddress: `${currentClient.endereco}, ${currentClient.numero} - ${currentClient.cidade}/${currentClient.estado}`,
      clientContact: `${currentClient.responsavel} (${currentClient.cargoResponsavel})`,
      serviceOrderId: selectedOS?.id,
      serviceOrderNumber: selectedOS?.osNumber,
      artNumber: artNumber || selectedOS?.artNumber,
      emissionDate: emissionDate,
      testPeriodStart: selectedTests[0]?.testDate || emissionDate,
      testPeriodEnd: selectedTests[selectedTests.length - 1]?.testDate || emissionDate,
      location: location,
      testIds: selectedTestIds,
      testsSummary: {
        total: reportStats.total,
        approved: reportStats.approved,
        rejected: reportStats.rejected,
        approvalRate: reportStats.approvalRate
      },
      executiveSummary: `Relatório Técnico de Ensaios Dielétricos em ${reportStats.total} EPIs/EPCs da empresa ${currentClient.razaoSocial}. Taxa de conformidade: ${reportStats.approvalRate.toFixed(1)}%.`,
      introductionText: introductionText || getDefaultIntro(),
      methodologyText: methodologyText || '',
      normsText: normsText || '',
      resultsAnalysisText: resultsAnalysisText || getDefaultAnalysis(),
      conclusionText: conclusionText || getDefaultConclusion(),
      recommendationsText: 'Conforme descrito na Seção 7',
      includeIndividualReportsAnnex: includeIndividualReportsAnnex,
      annexTitle: annexTitle,
      technicianName: technicianName || currentUser.name,
      technicianCreaOrCft: technicianCreaOrCft,
      techResponsibleName: techResponsibleName,
      techResponsibleCrea: techResponsibleCrea,
      techResponsibleRnp: techResponsibleRnp,
      validationCode: `VAL-REL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  // Save report to storage
  const handleSaveReport = () => {
    if (selectedTestIds.length === 0) {
      setToastMessage({ type: 'error', text: 'Selecione ao menos 1 ensaio/laudo para gerar o relatório.' });
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const reportObj = buildReportObject();
    DielectricStorageService.saveConsolidatedReport(reportObj);
    setSavedReports(DielectricStorageService.getConsolidatedReports());
    setToastMessage({ type: 'success', text: `Relatório ${reportObj.reportCode} salvo com sucesso no histórico!` });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Export PDF with format support (simplificado vs completo)
  const handleExportPDF = async (forcedFormat?: 'simplificado' | 'completo') => {
    if (selectedTestIds.length === 0) {
      setToastMessage({ type: 'error', text: 'Selecione ao menos 1 ensaio/laudo para exportar o relatório.' });
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const activeFormat = forcedFormat || reportFormat;
    setIsExportingPDF(true);
    const reportObj = buildReportObject();

    try {
      if (activeFormat === 'simplificado') {
        setExportProgress({ current: 1, total: 2, message: 'Gerando Relatório Simplificado & Tabulação por Colaborador...' });
        await exportTestsSummaryReportPDF(
          selectedTests,
          companyInfo,
          clients,
          {
            reportCode: reportCode || reportObj.reportCode,
            reportTitle: reportTitle || 'RELATÓRIO TÉCNICO SIMPLIFICADO & TABULAÇÃO DE ENSAIOS DIELÉTRICOS (NR-10)',
            artNumber: artNumber || reportObj.artNumber,
            emissionDate: emissionDate,
            techResponsibleName: techResponsibleName,
            techResponsibleCrea: techResponsibleCrea,
            techResponsibleRnp: techResponsibleRnp
          }
        );
      } else {
        await exportConsolidatedReportPDF(
          reportObj,
          selectedTests,
          companyInfo,
          (current, total, message) => {
            setExportProgress({ current, total, message });
          }
        );
      }

      // Also save to history automatically
      DielectricStorageService.saveConsolidatedReport(reportObj);
      setSavedReports(DielectricStorageService.getConsolidatedReports());

      setToastMessage({
        type: 'success',
        text: `Relatório PDF (${activeFormat === 'simplificado' ? 'Simplificado' : 'Consolidado'}) ${reportObj.reportCode} gerado e baixado com sucesso!`
      });
    } catch (err: any) {
      console.error('Erro ao gerar PDF do relatório:', err);
      setToastMessage({
        type: 'error',
        text: 'Erro na geração do PDF. Verifique os dados e tente novamente.'
      });
    } finally {
      setIsExportingPDF(false);
      setExportProgress(null);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Export Word (.doc/.docx) with full layout preservation
  const handleExportWord = async (forcedFormat?: 'simplificado' | 'completo') => {
    if (selectedTestIds.length === 0) {
      setToastMessage({ type: 'error', text: 'Selecione ao menos 1 ensaio/laudo para exportar o relatório em Word.' });
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    const activeFormat = forcedFormat || reportFormat;
    setIsExportingWord(true);
    const reportObj = buildReportObject();

    try {
      await exportReportToWord({
        report: reportObj,
        tests: selectedTests,
        companyInfo,
        clientsList: clients,
        exportOptions: {
          reportFormat: activeFormat,
          reportCode: reportCode || reportObj.reportCode,
          reportTitle: reportTitle,
          artNumber: artNumber || reportObj.artNumber,
          emissionDate: emissionDate,
          location: location,
          technicianName: technicianName || currentUser.name,
          technicianCreaOrCft: technicianCreaOrCft,
          techResponsibleName: techResponsibleName,
          techResponsibleCrea: techResponsibleCrea,
          techResponsibleRnp: techResponsibleRnp,
          introductionText: introductionText,
          resultsAnalysisText: resultsAnalysisText,
          conclusionText: conclusionText,
          includeIndividualReportsAnnex: includeIndividualReportsAnnex,
          annexTitle: annexTitle,
          selectedOSId: selectedOSId
        }
      });

      // Also save to history automatically
      DielectricStorageService.saveConsolidatedReport(reportObj);
      setSavedReports(DielectricStorageService.getConsolidatedReports());

      setToastMessage({
        type: 'success',
        text: `Relatório Word (.doc/.docx) ${reportObj.reportCode} (${activeFormat === 'simplificado' ? 'Simplificado' : 'Dossiê'}) exportado com sucesso mantendo a mesma formatação e layout!`
      });
    } catch (err: any) {
      console.error('Erro ao exportar relatório em Word:', err);
      setToastMessage({
        type: 'error',
        text: err?.message || 'Erro na geração do documento Word. Tente novamente.'
      });
    } finally {
      setIsExportingWord(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Excel Spreadsheet Export Handler
  const handleExportExcel = async () => {
    if (selectedTestIds.length === 0) {
      setToastMessage({ type: 'error', text: 'Selecione ao menos 1 ensaio para exportar a planilha.' });
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }
    try {
      await exportTestsSpreadsheet(selectedTests, companyInfo, clients);
      setToastMessage({
        type: 'success',
        text: 'Planilha Excel (.xlsx) gerada e salva com sucesso no dispositivo!'
      });
    } catch (err: any) {
      console.error('Erro ao exportar planilha Excel:', err);
      setToastMessage({
        type: 'error',
        text: err?.message || 'Erro ao gerar planilha Excel.'
      });
    }
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Print Report Handler (window.print)
  const handlePrintReport = () => {
    setActiveTab('preview');
    setTimeout(() => {
      window.print();
    }, 400);
  };

  // Load saved report into editor/preview
  const handleLoadSavedReport = (rep: ConsolidatedReport) => {
    setReportCode(rep.reportCode);
    setReportTitle(rep.title);
    setSelectedClientId(rep.clientId);
    if (rep.serviceOrderId) setSelectedOSId(rep.serviceOrderId);
    if (rep.artNumber) setArtNumber(rep.artNumber);
    setEmissionDate(rep.emissionDate);
    setLocation(rep.location);
    setSelectedTestIds(rep.testIds || []);
    setTechnicianName(rep.technicianName);
    setTechnicianCreaOrCft(rep.technicianCreaOrCft || '');
    setTechResponsibleName(rep.techResponsibleName);
    setTechResponsibleCrea(rep.techResponsibleCrea);
    setTechResponsibleRnp(rep.techResponsibleRnp || '');
    setIntroductionText(rep.introductionText || '');
    setResultsAnalysisText(rep.resultsAnalysisText || '');
    setConclusionText(rep.conclusionText || '');
    if (rep.includeIndividualReportsAnnex !== undefined) {
      setIncludeIndividualReportsAnnex(rep.includeIndividualReportsAnnex);
    }
    if (rep.annexTitle) {
      setAnnexTitle(rep.annexTitle);
    }
    setActiveTab('preview');
    setToastMessage({ type: 'info', text: `Relatório ${rep.reportCode} carregado na visualização.` });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Toggle selection of all available tests
  const handleToggleSelectAll = () => {
    if (selectedTestIds.length === availableTests.length) {
      setSelectedTestIds([]);
    } else {
      setSelectedTestIds(availableTests.map(t => t.id));
    }
  };

  // Toggle single test
  const handleToggleTest = (id: string) => {
    if (selectedTestIds.includes(id)) {
      setSelectedTestIds(selectedTestIds.filter(i => i !== id));
    } else {
      setSelectedTestIds([...selectedTestIds, id]);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-semibold transition-all ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950 text-emerald-100 border-emerald-700/60' 
            : toastMessage.type === 'error'
            ? 'bg-red-950 text-red-100 border-red-700/60'
            : 'bg-blue-950 text-blue-100 border-blue-700/60'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />}
          {toastMessage.type === 'info' && <FileText className="w-5 h-5 text-blue-400 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/30 border border-blue-500/40 rounded-full text-xs font-bold text-blue-300">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                <span>Emissão de Relatórios Técnicos NR-10</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                reportFormat === 'simplificado'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              }`}>
                Formato: {reportFormat === 'simplificado' ? 'Simplificado (por Colaborador)' : 'Dossiê Completo'}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              {reportFormat === 'simplificado' 
                ? 'Relatório Técnico Simplificado & Tabulação por Colaborador' 
                : 'Relatório Técnico Consolidado & Dossiê Completo'}
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              {reportFormat === 'simplificado'
                ? 'Gera relatório simplificado e objetivo com identificação da empresa, relação de normas técnicas e tabulação dos ensaios ordenada por colaborador e equipamentos.'
                : 'Gere dossiês técnicos oficiais com Capa, Sumário Executivo, Introdução Normativa, Metodologia de Ensaios, Normas Aplicadas, Dossiê de Laudos de Ensaios Individuais, Análise de Resultados e Conclusão com Assinaturas Oficiais.'}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Format Toggle Pill */}
            <div className="bg-slate-800/90 border border-slate-700 p-1 rounded-xl flex items-center gap-1">
              <button
                onClick={() => {
                  setReportFormat('simplificado');
                  if (reportTitle.includes('CONSOLIDADO')) {
                    setReportTitle('RELATÓRIO TÉCNICO SIMPLIFICADO & TABULAÇÃO DE ENSAIOS DIELÉTRICOS');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reportFormat === 'simplificado'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
                title="Relatório Simplificado com normas e resumo ordenado por colaborador"
              >
                Simplificado
              </button>
              <button
                onClick={() => {
                  setReportFormat('completo');
                  if (reportTitle.includes('SIMPLIFICADO')) {
                    setReportTitle('RELATÓRIO TÉCNICO CONSOLIDADO DE ENSAIOS DIELÉTRICOS');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reportFormat === 'completo'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
                title="Dossiê Completo multipáginas com capa e laudos anexos"
              >
                Completo (Dossiê)
              </button>
            </div>

            <button
              onClick={() => handleExportPDF()}
              disabled={isExportingPDF || selectedTestIds.length === 0}
              className={`px-4 py-2.5 text-white rounded-xl text-xs font-bold shadow-lg inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
                reportFormat === 'simplificado'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/20'
              }`}
              title={`Exportar ${reportFormat === 'simplificado' ? 'Relatório Simplificado' : 'Dossiê Completo'} em PDF`}
            >
              <Download className="w-4 h-4" />
              <span>
                {isExportingPDF 
                  ? 'Gerando PDF...' 
                  : reportFormat === 'simplificado' ? 'Exportar PDF' : 'Exportar Dossiê PDF'}
              </span>
            </button>

            <button
              onClick={() => handleExportWord()}
              disabled={isExportingWord || selectedTestIds.length === 0}
              className="px-3.5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white border border-blue-500/50 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-blue-900/30"
              title={`Exportar ${reportFormat === 'simplificado' ? 'Relatório Simplificado' : 'Dossiê Completo'} para Microsoft Word (.doc/.docx)`}
            >
              <FileDown className="w-4 h-4 text-blue-200" />
              <span>{isExportingWord ? 'Gerando Word...' : 'Exportar Word'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={selectedTestIds.length === 0}
              className="px-3.5 py-2.5 bg-emerald-800/80 hover:bg-emerald-700 text-white border border-emerald-600/50 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              title="Exportar Planilha Excel (.xlsx) dos ensaios"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>

            <button
              onClick={handlePrintReport}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer"
              title="Imprimir visualização"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={handleSaveReport}
              disabled={selectedTestIds.length === 0}
              className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              title="Salvar no Histórico"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Salvar</span>
            </button>
          </div>
        </div>

        {/* Progress Bar when generating PDF */}
        {isExportingPDF && exportProgress && (
          <div className="mt-5 p-3.5 bg-blue-900/40 border border-blue-500/40 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs text-blue-200">
              <span className="font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
                {exportProgress.message}
              </span>
              <span>Etapa {exportProgress.current} de {exportProgress.total}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-orange-500 to-amber-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Pré-visualização do Relatório</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'editor'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Configurar Seções & Lote</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Histórico ({savedReports.length})</span>
          </button>
        </div>

        {/* Selected Batch Counter Badge */}
        <div className="hidden sm:flex items-center gap-3 text-xs font-bold">
          <span className="text-slate-500">Lote Selecionado:</span>
          <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-800">
            {reportStats.total} ensaios
          </span>
          <span className="px-2.5 py-1 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg">
            {reportStats.approved} aprovados ({reportStats.approvalRate.toFixed(0)}%)
          </span>
          {reportStats.rejected > 0 && (
            <span className="px-2.5 py-1 bg-red-100 border border-red-200 text-red-800 rounded-lg">
              {reportStats.rejected} reprovados
            </span>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PRÉ-VISUALIZAÇÃO COMPLETA DO RELATÓRIO (PREVIEW) */}
      {/* ======================================================== */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          {/* Quick Selection & Format Toolbar for Preview */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Format Switcher Pills */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => {
                    setReportFormat('simplificado');
                    if (reportTitle.includes('CONSOLIDADO')) {
                      setReportTitle('RELATÓRIO TÉCNICO SIMPLIFICADO & TABULAÇÃO DE ENSAIOS DIELÉTRICOS');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                    reportFormat === 'simplificado'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Relatório Simplificado (por Colaborador)</span>
                </button>

                <button
                  onClick={() => {
                    setReportFormat('completo');
                    if (reportTitle.includes('SIMPLIFICADO')) {
                      setReportTitle('RELATÓRIO TÉCNICO CONSOLIDADO DE ENSAIOS DIELÉTRICOS');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                    reportFormat === 'completo'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Dossiê Completo NR-10</span>
                </button>
              </div>

              <div className="h-6 w-px bg-slate-200 hidden md:block" />

              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-700">Cliente:</span>
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    setSelectedOSId('');
                  }}
                  className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="">-- Todos os Clientes --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.razaoSocial} ({c.nomeFantasia || c.razaoSocial})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-bold text-slate-700">OS:</span>
                <select
                  value={selectedOSId}
                  onChange={(e) => setSelectedOSId(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="">-- Todas as OSs / Avulso --</option>
                  {serviceOrders
                    .filter(os => !selectedClientId || os.clientId === selectedClientId)
                    .map(os => (
                      <option key={os.id} value={os.id}>{os.osNumber} - {os.clientName || 'Cliente'}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportPDF()}
                disabled={isExportingPDF || selectedTestIds.length === 0}
                className={`px-3 py-1.5 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  reportFormat === 'simplificado'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{reportFormat === 'simplificado' ? 'Baixar PDF' : 'Baixar Dossiê PDF'}</span>
              </button>

              <button
                onClick={() => handleExportWord()}
                disabled={isExportingWord || selectedTestIds.length === 0}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Exportar Relatório para Microsoft Word (.doc/.docx)"
              >
                <FileDown className="w-3.5 h-3.5 text-blue-200" />
                <span>{isExportingWord ? 'Gerando Word...' : 'Exportar Word'}</span>
              </button>

              <button
                onClick={() => setActiveTab('editor')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Configurar</span>
              </button>
            </div>
          </div>

          {/* Paper View Container */}
          <div className="bg-slate-100 p-4 sm:p-8 rounded-3xl border border-slate-300 shadow-inner flex flex-col items-center space-y-8 print:p-0 print:bg-white print:border-none print:shadow-none">
            
            {/* ========================================================================= */}
            {/* FORMATO 1: RELATÓRIO TÉCNICO SIMPLIFICADO & TABULAÇÃO POR COLABORADOR     */}
            {/* ========================================================================= */}
            {reportFormat === 'simplificado' && (
              <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-slate-300 p-6 sm:p-10 space-y-8 print:p-0 print:shadow-none print:border-none print:rounded-none print:m-0">
                {/* Cabeçalho Oficial do Laboratório */}
                <div className="border-b-2 border-slate-900 pb-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="inline-block px-2.5 py-0.5 bg-slate-900 text-white text-[10px] font-black uppercase rounded tracking-wider mb-1">
                        LABORATÓRIO DE ENSAIOS DIELÉTRICOS & METROLOGIA (NR-10)
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                        {companyInfo.name}
                      </h2>
                      <p className="text-xs text-slate-600 font-medium">
                        CNPJ: <strong className="text-slate-800">{companyInfo.cnpj}</strong> • Registro CREA PJ: <strong className="text-slate-800">{companyInfo.creaCompanyRegister}</strong>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {companyInfo.address} • Fone: {companyInfo.phone} • E-mail: {companyInfo.email}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-right shrink-0 space-y-1 w-full sm:w-auto">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Código do Relatório</div>
                      <div className="font-mono text-base font-black text-blue-900">{reportCode || 'REL-SIMP-001'}</div>
                      <div className="text-[11px] text-slate-600">
                        Emissão: <strong className="text-slate-900">{formatDateBR(emissionDate)}</strong>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Lote: <strong className="text-slate-800">{reportStats.total} itens</strong> ({reportStats.approved} aprovados)
                      </div>
                    </div>
                  </div>

                  {/* Título Principal */}
                  <div className="mt-5 pt-4 border-t border-slate-200 text-center bg-slate-900 text-white py-2.5 px-4 rounded-xl">
                    <h1 className="text-sm sm:text-base font-black tracking-wider uppercase">
                      {reportTitle || 'RELATÓRIO TÉCNICO SIMPLIFICADO & TABULAÇÃO DE ENSAIOS DIELÉTRICOS'}
                    </h1>
                    <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                      Atendimento à Norma Regulamentadora NR-10 (item 10.7.8) e Normas Técnicas Brasileiras ABNT / Internacionais ASTM
                    </p>
                  </div>
                </div>

                {/* Seção 1: Dados da Empresa Solicitante / Cliente */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b-2 border-blue-900 pb-1.5">
                    <Building2 className="w-4 h-4 text-blue-900" />
                    <h3 className="text-xs font-black uppercase text-blue-950 tracking-wider">
                      1. DADOS DA EMPRESA SOLICITANTE / CLIENTE
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Razão Social / Nome</span>
                      <p className="font-black text-slate-900">{currentClient.razaoSocial}</p>
                      {currentClient.nomeFantasia && currentClient.nomeFantasia !== currentClient.razaoSocial && (
                        <p className="text-[11px] text-slate-600">Fantasia: {currentClient.nomeFantasia}</p>
                      )}
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">CNPJ / CPF</span>
                      <p className="font-mono font-bold text-slate-900">{currentClient.cnpj || 'Consulte cadastro'}</p>
                      <p className="text-[11px] text-slate-600">Inscr. Estadual: {currentClient.inscricaoEstadual || 'Isento / Não inf.'}</p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Ordem de Serviço & ART</span>
                      <p className="font-bold text-slate-900">OS: {serviceOrders.find(o => o.id === selectedOSId)?.osNumber || 'Avulso / Geral'}</p>
                      <p className="text-[11px] text-slate-600">ART: <strong className="text-slate-800">{artNumber || serviceOrders.find(o => o.id === selectedOSId)?.artNumber || 'Conforme ART Geral do Laboratório'}</strong></p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Endereço Completo</span>
                      <p className="font-medium text-slate-800">
                        {currentClient.endereco ? `${currentClient.endereco}, ${currentClient.numero || 'S/N'} - ${currentClient.bairro || ''}, ${currentClient.cidade || ''}/${currentClient.estado || ''} - CEP: ${currentClient.cep || ''}` : 'Endereço registrado no cadastro'}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Contato / SST</span>
                      <p className="font-medium text-slate-800">{currentClient.responsavel || 'SESMT / Segurança do Trabalho'}</p>
                      <p className="text-[11px] text-slate-500">{currentClient.telefone} • {currentClient.email}</p>
                    </div>
                  </div>

                  {/* Resumo do Lote */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-950">Resumo Geral do Lote:</span>
                      <span className="px-2 py-0.5 bg-blue-900 text-white rounded font-bold text-[11px]">{reportStats.total} ensaios</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-800">✓ {reportStats.approved} Aprovados ({reportStats.approvalRate.toFixed(1)}%)</span>
                      {reportStats.rejected > 0 ? (
                        <span className="font-bold text-red-700">✕ {reportStats.rejected} Reprovados</span>
                      ) : (
                        <span className="text-[11px] text-emerald-700 font-semibold">100% de Conformidade</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seção 2: Relação de Normas Técnicas e Critérios de Conformidade */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b-2 border-blue-900 pb-1.5">
                    <Shield className="w-4 h-4 text-blue-900" />
                    <h3 className="text-xs font-black uppercase text-blue-950 tracking-wider">
                      2. NORMAS TÉCNICAS E CRITÉRIOS DE CONFORMIDADE APLICADOS
                    </h3>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed text-justify">
                    Os ensaios de rigidez dielétrica e as inspeções visuais/mecânicas foram executados em estrita observância aos requisitos das normas técnicas nacionais e internacionais vigentes, conforme detalhado na tabela abaixo:
                  </p>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[10px] uppercase">
                          <th className="py-2 px-3 font-bold w-12 text-center">Item</th>
                          <th className="py-2 px-3 font-bold w-40">Código da Norma</th>
                          <th className="py-2 px-3 font-bold">Título / Denominação Técnica</th>
                          <th className="py-2 px-3 font-bold w-44">Equipamentos Abrangidos</th>
                          <th className="py-2 px-3 font-bold">Critério / Parâmetro Avaliado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {applicableNorms.map((norm, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                            <td className="py-2 px-3 text-center font-bold text-slate-500">{`2.${idx + 1}`}</td>
                            <td className="py-2 px-3 font-bold text-blue-900 font-mono text-[10px]">{norm.code}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{norm.title}</td>
                            <td className="py-2 px-3 text-slate-600 font-semibold">{norm.scope}</td>
                            <td className="py-2 px-3 text-slate-600 text-[10px]">{norm.criteria}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Seção 3: Tabulação Resumo dos Equipamentos Ensaiados Ordenada por Colaborador */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-blue-900 pb-1.5">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-blue-900" />
                      <h3 className="text-xs font-black uppercase text-blue-950 tracking-wider">
                        3. TABULAÇÃO RESUMO DOS EQUIPAMENTOS ENSAIADOS (ORDENADA POR COLABORADOR)
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Total de Colaboradores: {preparedCollaboratorGroups.length}
                    </span>
                  </div>

                  <div className="space-y-6">
                    {preparedCollaboratorGroups.map((group, gIdx) => (
                      <div key={gIdx} className="rounded-xl border border-slate-300 overflow-hidden shadow-xs">
                        {/* Faixa do Colaborador */}
                        <div className="bg-slate-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-black">
                              {gIdx + 1}
                            </div>
                            <div>
                              <span className="font-bold text-white uppercase text-xs sm:text-sm">
                                {group.collaboratorName}
                              </span>
                              {(group.collaboratorRegistration || group.collaboratorSector) && (
                                <span className="text-[11px] text-slate-300 ml-2">
                                  {group.collaboratorRegistration && group.collaboratorRegistration !== '-' && `• Matrícula: ${group.collaboratorRegistration} `}
                                  {group.collaboratorSector && group.collaboratorSector !== 'Geral' && `• Setor: ${group.collaboratorSector}`}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="px-2.5 py-0.5 bg-slate-700 text-slate-200 rounded font-semibold">
                              {group.total} equipamento(s)
                            </span>
                            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-bold">
                              {group.approved} Aprovado(s)
                            </span>
                            {group.rejected > 0 && (
                              <span className="px-2.5 py-0.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded font-bold">
                                {group.rejected} Reprovado(s)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Tabela dos Equipamentos deste Colaborador */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px] text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-300">
                                <th className="py-2 px-2.5">Nº Laudo</th>
                                <th className="py-2 px-2.5">TAG / Ident.</th>
                                <th className="py-2 px-2.5">Tipo de Equipamento</th>
                                <th className="py-2 px-2">CA</th>
                                <th className="py-2 px-2">Classe</th>
                                <th className="py-2 px-2 text-center">Tensão Ensaio</th>
                                <th className="py-2 px-2 text-center">Fuga Medida</th>
                                <th className="py-2 px-2 text-center">Limite Máx.</th>
                                <th className="py-2 px-2.5">Data Ensaio</th>
                                <th className="py-2 px-2.5">Validade</th>
                                <th className="py-2 px-2.5 text-center">Parecer</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {group.items.map((item, iIdx) => {
                                const isApproved = item.result === 'APROVADO';
                                return (
                                  <tr key={iIdx} className={iIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                    <td className="py-2 px-2.5 font-mono font-bold text-blue-950 text-[10px] whitespace-nowrap">
                                      {item.reportNumber}
                                    </td>
                                    <td className="py-2 px-2.5 font-bold text-slate-900 whitespace-nowrap">
                                      {item.equipmentTag}
                                    </td>
                                    <td className="py-2 px-2.5 font-medium text-slate-800 max-w-xs truncate" title={item.equipmentTypeName}>
                                      {item.equipmentTypeName}
                                    </td>
                                    <td className="py-2 px-2 text-slate-700 font-mono text-[10px] whitespace-nowrap">
                                      {item.caNumber}
                                    </td>
                                    <td className="py-2 px-2 text-slate-700 whitespace-nowrap font-semibold">
                                      {item.dielectricClass}
                                    </td>
                                    <td className="py-2 px-2 text-center font-bold text-slate-800 whitespace-nowrap">
                                      {item.appliedVoltage_kV} kV {item.voltageType}
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono font-bold whitespace-nowrap text-slate-900">
                                      {item.measuredLeakage_mA.toFixed(2)} mA
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono text-[10px] text-slate-500 whitespace-nowrap">
                                      ≤ {item.leakageLimit_mA.toFixed(2)} mA
                                    </td>
                                    <td className="py-2 px-2.5 text-slate-700 whitespace-nowrap">
                                      {item.testDate}
                                    </td>
                                    <td className="py-2 px-2.5 font-bold text-emerald-800 whitespace-nowrap">
                                      {item.retestDueDate}
                                    </td>
                                    <td className="py-2 px-2.5 text-center whitespace-nowrap">
                                      {isApproved ? (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase inline-flex items-center gap-1">
                                          <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                                          APROVADO
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-black rounded-full uppercase inline-flex items-center gap-1">
                                          <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                                          REPROVADO
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Seção 4: Termo de Conformidade e Rastreabilidade Metrológica */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2 border-b-2 border-blue-900 pb-1.5">
                    <Award className="w-4 h-4 text-blue-900" />
                    <h3 className="text-xs font-black uppercase text-blue-950 tracking-wider">
                      4. TERMO DE CONFORMIDADE TÉCNICA & RASTREABILIDADE METROLÓGICA (RBC)
                    </h3>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-[11px] leading-relaxed text-slate-700 space-y-2 text-justify">
                    <p>
                      Atestamos que os equipamentos de proteção individual (EPI) e proteção coletiva (EPC) relacionados neste relatório técnico simplificado foram ensaiados em laboratório especializado sob condições ambientais controladas (Temperatura: 23°C ± 2°C, Umidade Relativa do Ar: 55% ± 10%). Todos os instrumentos geradores e medidores de alta tensão possuem certificados de calibração vigentes emitidos por laboratórios acreditados pela Cgcre/INMETRO pertencentes à Rede Brasileira de Calibração (RBC).
                    </p>
                    <p>
                      Os itens identificados como <strong>APROVADOS</strong> apresentaram suportabilidade à tensão de prova aplicada, ausência de perfuração dielétrica e correntes de fuga estritamente inferiores aos limites máximos normativos, encontrando-se aptos e liberados para intervenções elétricas em conformidade com o item 10.7.8 da Norma Regulamentadora NR-10. Os itens porventura identificados como <strong>REPROVADOS</strong> devem ser imediatamente retirados de operação e descartados.
                    </p>
                  </div>
                </div>

                {/* Seção 5: Assinaturas e Responsabilidade Técnica */}
                <div className="pt-6 border-t-2 border-slate-900">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs">
                    <div className="space-y-1.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="w-48 h-10 border-b border-slate-400 mx-auto flex items-end justify-center pb-1">
                        <span className="font-serif italic text-slate-400 text-xs">[Assinatura Digital / Técnico]</span>
                      </div>
                      <p className="font-black text-slate-900 text-sm">{technicianName || currentUser.name}</p>
                      <p className="text-[11px] text-slate-600 font-medium">{technicianCreaOrCft || 'Técnico em Eletrotécnica / Inspetor Dielétrico'}</p>
                      <p className="text-[10px] text-slate-400">Executor do Ensaio Dielétrico</p>
                    </div>

                    <div className="space-y-1.5 p-4 rounded-xl bg-blue-50/50 border border-blue-200">
                      <div className="w-48 h-10 border-b border-blue-900 mx-auto flex items-end justify-center pb-1">
                        <span className="font-serif italic text-blue-800 text-xs">[Assinado Digitalmente via ICP-Brasil]</span>
                      </div>
                      <p className="font-black text-blue-950 text-sm">
                        {techResponsibleName || companyInfo.technicalResponsible.name}
                      </p>
                      <p className="text-[11px] text-slate-700 font-bold">Engenheiro Eletricista / Seg. Trabalho</p>
                      <p className="text-[10px] text-slate-600">
                        CREA: <strong>{techResponsibleCrea || companyInfo.technicalResponsible.crea}</strong>
                        {techResponsibleRnp ? ` • RNP: ${techResponsibleRnp}` : (companyInfo.technicalResponsible.rnp ? ` • RNP: ${companyInfo.technicalResponsible.rnp}` : '')}
                      </p>
                      <p className="text-[9px] text-slate-400">Responsável Técnico pelo Laboratório</p>
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-slate-400 pt-6">
                    Documento técnico emitido digitalmente em {formatDateBR(emissionDate)} • Laboratório {companyInfo.name} • Código: {reportCode || 'REL-SIMP-001'}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* FORMATO 2: DOSSIÊ COMPLETO MULTIPÁGINAS COM ANEXOS                        */}
            {/* ========================================================================= */}
            {reportFormat === 'completo' && (
              <>
            {/* ---------------------------------------------------- */}
            {/* FOLHA 1: CAPA OFICIAL (COVER PAGE) */}
            {/* ---------------------------------------------------- */}
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-300 p-8 sm:p-12 space-y-8 min-h-[1050px] relative flex flex-col justify-between print:shadow-none print:rounded-none print:border-none print:m-0 print:p-8 print:page-break-after">
              
              {/* Header Strip */}
              <div className="border-b-2 border-slate-900 pb-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                      {companyInfo.name}
                    </h2>
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                      Laboratório Especializado de Ensaios Dielétricos & Inspeção de EPIs/EPCs
                    </p>
                    <p className="text-[11px] text-slate-500">
                      CNPJ: {companyInfo.cnpj} • Registro CREA PJ: {companyInfo.creaCompanyRegister}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {companyInfo.address} • Tel: {companyInfo.phone} • {companyInfo.email}
                    </p>
                  </div>

                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center text-white font-black text-2xl shadow-md shrink-0 border-2 border-blue-500/30">
                    JVM
                  </div>
                </div>
              </div>

              {/* Title Card */}
              <div className="my-auto py-10 space-y-4 text-center">
                <div className="inline-block px-4 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-black rounded-full uppercase tracking-wider">
                  Dossiê Técnico Conclusivo • Conforme NR-10
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug uppercase max-w-2xl mx-auto">
                  {reportTitle}
                </h1>

                <p className="text-xs text-slate-600 max-w-xl mx-auto font-medium">
                  Avaliação da integridade física, medição de corrente de fuga e ensaios de rigidez dielétrica em Equipamentos de Proteção Individual e Coletiva conforme item 10.7.8 da NR-10 e Normas ABNT / ASTM.
                </p>

                <div className="pt-4 flex items-center justify-center gap-3">
                  <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold">
                    Código: {reportCode}
                  </span>
                  <span className="px-3 py-1 bg-orange-100 text-orange-900 border border-orange-200 rounded-lg text-xs font-bold">
                    OS: {serviceOrders.find(o => o.id === selectedOSId)?.osNumber || 'OS-AVULSA'}
                  </span>
                  {artNumber && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold">
                      ART: {artNumber}
                    </span>
                  )}
                </div>
              </div>

              {/* Client & Metadata Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Box */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase border-b border-slate-200 pb-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Dados do Cliente / Solicitante</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-700">
                    <p><strong className="text-slate-900">Razão Social:</strong> {currentClient.razaoSocial}</p>
                    <p><strong className="text-slate-900">CNPJ:</strong> {currentClient.cnpj}</p>
                    <p><strong className="text-slate-900">Endereço:</strong> {currentClient.endereco}, {currentClient.numero} - {currentClient.cidade}/{currentClient.estado}</p>
                    <p><strong className="text-slate-900">Contato:</strong> {currentClient.responsavel} ({currentClient.cargoResponsavel})</p>
                  </div>
                </div>

                {/* Report Info Box */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase border-b border-slate-200 pb-1.5">
                    <Award className="w-4 h-4 text-orange-600" />
                    <span>Informações da Emissão & Lote</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-700">
                    <p><strong className="text-slate-900">Data de Emissão:</strong> {formatDateBR(emissionDate)}</p>
                    <p><strong className="text-slate-900">Local de Ensaio:</strong> {location}</p>
                    <p><strong className="text-slate-900">Quantidade Inspecionada:</strong> {reportStats.total} equipamentos</p>
                    <p><strong className="text-slate-900">Índice de Aprovação:</strong> <span className="text-emerald-700 font-bold">{reportStats.approvalRate.toFixed(1)}%</span> ({reportStats.approved} aprovados / {reportStats.rejected} reprovados)</p>
                  </div>
                </div>
              </div>

              {/* Cover Footer & Signatures preview */}
              <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
                <div className="space-y-0.5 text-center sm:text-left">
                  <p className="font-bold text-slate-800">Responsável Técnico: {techResponsibleName} (CREA: {techResponsibleCrea})</p>
                  <p>Laboratorista / Técnico Executor: {technicianName}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  <QrCode className="w-4 h-4 text-slate-600" />
                  <span>Autenticidade rastreável online</span>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* FOLHA 2: SUMÁRIO & INTRODUÇÃO */}
            {/* ---------------------------------------------------- */}
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-300 p-8 sm:p-12 space-y-8 min-h-[1050px] print:shadow-none print:rounded-none print:border-none print:m-0 print:p-8 print:page-break-after">
              
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  1. Sumário & Introdução Normativa
                </span>
                <span className="text-xs text-slate-400">{reportCode}</span>
              </div>

              {/* Sumário */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Sumário Geral do Relatório
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center border-b border-dotted border-slate-300 pb-1">
                    <span className="font-semibold text-slate-800">1. Capa & Identificação Geral do Cliente</span>
                    <span className="text-slate-500 font-mono">Pág. 01</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dotted border-slate-300 pb-1">
                    <span className="font-semibold text-slate-800">2. Sumário Executivo & Introdução Normativa (NR-10)</span>
                    <span className="text-slate-500 font-mono">Pág. 02</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dotted border-slate-300 pb-1">
                    <span className="font-semibold text-slate-800">3. Metodologia de Ensaios & Rastreabilidade dos Instrumentos</span>
                    <span className="text-slate-500 font-mono">Pág. 03</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dotted border-slate-300 pb-1">
                    <span className="font-semibold text-slate-800">4. Normas Técnicas Aplicadas & Critérios de Rigidez</span>
                    <span className="text-slate-500 font-mono">Pág. 04</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dotted border-slate-300 pb-1">
                    <span className="font-semibold text-slate-800">5. Dossiê de Laudos dos Ensaios Realizados</span>
                    <span className="text-slate-500 font-mono">Pág. 05</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dotted border-slate-300 pb-1">
                    <span className="font-semibold text-slate-800">6. Análise Estatística & Diagnóstico Técnico</span>
                    <span className="text-slate-500 font-mono">Pág. 06</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dotted border-slate-300 pb-1">
                    <span className="font-semibold text-slate-800">7. Conclusão Técnica, Recomendações e Assinaturas</span>
                    <span className="text-slate-500 font-mono">Pág. 06</span>
                  </div>
                  {includeIndividualReportsAnnex && (
                    <div className="flex justify-between items-center border-b border-dotted border-slate-300 pb-1 bg-blue-50/50 px-2 py-0.5 rounded-lg">
                      <span className="font-bold text-blue-900">8. ANEXO I – Laudos Técnicos Individuais dos Ensaios ({selectedTests.length} laudos anexados)</span>
                      <span className="text-blue-700 font-mono font-bold">Pág. 07+</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Introdução */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-300 pb-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase">
                    2. Introdução e Contexto Normativo
                  </h3>
                </div>
                <div className="text-xs text-slate-700 leading-relaxed space-y-3 whitespace-pre-line text-justify">
                  {introductionText || getDefaultIntro()}
                </div>
              </div>

              {/* Escopo do Lote */}
              <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-blue-950 uppercase">
                  Escopo e Relação do Lote Inspecionado
                </h4>
                <ul className="text-xs text-blue-900 space-y-1.5 list-disc pl-4">
                  <li><strong>Total de Itens Inspecionados:</strong> {reportStats.total} unidades de EPIs/EPCs.</li>
                  <li><strong>Ordem de Serviço de Referência:</strong> {serviceOrders.find(o => o.id === selectedOSId)?.osNumber || 'OS-AVULSA'} (ART: {artNumber || 'Conforme OS'}).</li>
                  <li><strong>Tipologias Avaliadas:</strong> Luvas isolantes, mangas, mantas, tapetes, ferramentas isoladas 1000V, escadas e bastões de manobra.</li>
                  <li><strong>Finalidade:</strong> Garantir que os trabalhadores eletricistas atuem protegidos contra riscos de choque elétrico e arco elétrico conforme as exigências da NR-10.</li>
                </ul>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* FOLHA 3: METODOLOGIA & INSTRUMENTOS */}
            {/* ---------------------------------------------------- */}
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-300 p-8 sm:p-12 space-y-6 min-h-[1050px] print:shadow-none print:rounded-none print:border-none print:m-0 print:p-8 print:page-break-after">
              
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  2. Metodologia de Ensaios & Instrumentos Rastreáveis
                </span>
                <span className="text-xs text-slate-400">{reportCode}</span>
              </div>

              {/* Metodologia de Ensaio */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-300 pb-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase">
                    3. Metodologia e Procedimentos de Ensaio
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <p className="font-bold text-slate-900">3.1 Inspeção Visual & Pneumática</p>
                    <p className="text-slate-600 leading-relaxed">
                      Avaliação rigorosa de furos, trincas, ressecamento, fissuras por ozônio e incrustações. Insuflação pneumática em luvas de borracha.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <p className="font-bold text-slate-900">3.2 Condicionamento & Higienização</p>
                    <p className="text-slate-600 leading-relaxed">
                      Higienização com solução neutra, secagem climatizada e estabilização de umidade e temperatura controladas.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <p className="font-bold text-slate-900">3.3 Aplicação de Alta Tensão (Hipot)</p>
                    <p className="text-slate-600 leading-relaxed">
                      Submissão do item à tensão de ensaio de prova (kV CA 60Hz) com rampa de subida gradual e tempo de ensaio normatizado (60s a 180s).
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <p className="font-bold text-slate-900">3.4 Medição da Corrente de Fuga</p>
                    <p className="text-slate-600 leading-relaxed">
                      Registro contínuo da corrente de fuga em miliampères (mA). Comparação com os tetos normativos da ABNT/ASTM.
                    </p>
                  </div>
                </div>
              </div>

              {/* Rastreabilidade dos Instrumentos */}
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2 border-b border-slate-300 pb-2">
                  <Gauge className="w-4 h-4 text-orange-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase">
                    3.5 Rastreabilidade Metrológica dos Instrumentos do Laboratório
                  </h3>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2.5">Instrumento</th>
                        <th className="p-2.5">Fabricante / Modelo</th>
                        <th className="p-2.5">Nº de Série</th>
                        <th className="p-2.5">Certificado RBC</th>
                        <th className="p-2.5 text-right">Validade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {labInstruments.slice(0, 4).map((inst) => (
                        <tr key={inst.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">{inst.type}</td>
                          <td className="p-2.5">{inst.manufacturer} {inst.model}</td>
                          <td className="p-2.5 font-mono text-[11px]">{inst.serialNumber}</td>
                          <td className="p-2.5 font-mono text-[11px]">{inst.calibrationCertNumber}</td>
                          <td className="p-2.5 text-right font-semibold text-emerald-700">
                            {formatDateBR(inst.calibrationExpiryDate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* FOLHA 4: NORMAS APLICADAS & CRITÉRIOS */}
            {/* ---------------------------------------------------- */}
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-300 p-8 sm:p-12 space-y-6 min-h-[1050px] print:shadow-none print:rounded-none print:border-none print:m-0 print:p-8 print:page-break-after">
              
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  3. Normas Técnicas & Critérios de Aceitação
                </span>
                <span className="text-xs text-slate-400">{reportCode}</span>
              </div>

              {/* Matriz de Normas */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-300 pb-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase">
                    4. Normas Técnicas Aplicadas
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <strong className="text-blue-900 block">ABNT NBR 16295 / IEC 60903</strong>
                    <span className="text-slate-600">Luvas de material isolante para trabalhos em tensão.</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <strong className="text-blue-900 block">ABNT NBR 10624 / ASTM D1051</strong>
                    <span className="text-slate-600">Mangas de borracha isolante para proteção de braços.</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <strong className="text-blue-900 block">ASTM D1048</strong>
                    <span className="text-slate-600">Mantas isolantes de borracha elastomérica.</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <strong className="text-blue-900 block">ASTM D178</strong>
                    <span className="text-slate-600">Tapetes e estrados de borracha isolante para piso.</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <strong className="text-blue-900 block">ABNT NBR 14540 / ASTM F711</strong>
                    <span className="text-slate-600">Tubos e bastões de manobra em fibra de vidro.</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <strong className="text-blue-900 block">ABNT NBR IEC 60900</strong>
                    <span className="text-slate-600">Ferramentas manuais isoladas para trabalhos até 1000V.</span>
                  </div>
                </div>
              </div>

              {/* Tabela de Classes e Tensões */}
              <div className="space-y-3 pt-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase">
                  4.1 Classes de Isolação, Tensões de Uso e Tensões de Ensaio
                </h4>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2">Classe</th>
                        <th className="p-2">Máx. Uso (CA)</th>
                        <th className="p-2">Máx. Uso (CC)</th>
                        <th className="p-2">Tensão Ensaio</th>
                        <th className="p-2">Tempo</th>
                        <th className="p-2 text-right">Limite Fuga (mA)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700 text-[11px]">
                      <tr>
                        <td className="p-2 font-bold text-slate-900">Classe 00</td>
                        <td className="p-2">500 V</td>
                        <td className="p-2">750 V</td>
                        <td className="p-2 font-semibold text-blue-700">2.500 V (2,5 kV)</td>
                        <td className="p-2">60 s</td>
                        <td className="p-2 text-right font-bold">10 a 14 mA</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-900">Classe 0</td>
                        <td className="p-2">1.000 V (1 kV)</td>
                        <td className="p-2">1.500 V</td>
                        <td className="p-2 font-semibold text-blue-700">5.000 V (5 kV)</td>
                        <td className="p-2">60 s</td>
                        <td className="p-2 text-right font-bold">12 a 16 mA</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-900">Classe 1</td>
                        <td className="p-2">7.500 V (7,5 kV)</td>
                        <td className="p-2">11.250 V</td>
                        <td className="p-2 font-semibold text-blue-700">10.000 V (10 kV)</td>
                        <td className="p-2">60 s</td>
                        <td className="p-2 text-right font-bold">14 a 18 mA</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-900">Classe 2</td>
                        <td className="p-2">17.000 V (17 kV)</td>
                        <td className="p-2">25.500 V</td>
                        <td className="p-2 font-semibold text-blue-700">20.000 V (20 kV)</td>
                        <td className="p-2">60 s</td>
                        <td className="p-2 text-right font-bold">16 a 20 mA</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-900">Classe 3</td>
                        <td className="p-2">26.500 V (26,5 kV)</td>
                        <td className="p-2">39.750 V</td>
                        <td className="p-2 font-semibold text-blue-700">30.000 V (30 kV)</td>
                        <td className="p-2">60 s</td>
                        <td className="p-2 text-right font-bold">18 a 22 mA</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-900">Classe 4</td>
                        <td className="p-2">36.000 V (36 kV)</td>
                        <td className="p-2">54.000 V</td>
                        <td className="p-2 font-semibold text-blue-700">40.000 V (40 kV)</td>
                        <td className="p-2">60 s</td>
                        <td className="p-2 text-right font-bold">20 a 24 mA</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* FOLHA 5: DOSSIÊ DE LAUDOS DOS ENSAIOS */}
            {/* ---------------------------------------------------- */}
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-300 p-8 sm:p-12 space-y-6 min-h-[1050px] print:shadow-none print:rounded-none print:border-none print:m-0 print:p-8 print:page-break-after">
              
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  4. Dossiê de Laudos dos Ensaios Realizados
                </span>
                <span className="text-xs text-slate-400">{reportCode}</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-black text-slate-900 uppercase">
                      5. Relação Consolidada dos Ensaios ({selectedTests.length} itens)
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    Cliente: {currentClient.nomeFantasia || currentClient.razaoSocial}
                  </span>
                </div>

                {selectedTests.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
                    Nenhum ensaio selecionado para este relatório. Vá até a aba "Configurar Seções & Lote" para marcar os ensaios desejados.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                          <th className="p-2">#</th>
                          <th className="p-2">TAG / ID</th>
                          <th className="p-2">Equipamento</th>
                          <th className="p-2">Classe</th>
                          <th className="p-2">Tensão</th>
                          <th className="p-2">Fuga (mA)</th>
                          <th className="p-2">Limite</th>
                          <th className="p-2">Status</th>
                          <th className="p-2 text-right">Laudo Nº</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-700 text-[11px]">
                        {selectedTests.map((t, idx) => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="p-2 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-2 font-bold text-slate-900">{t.equipmentTag}</td>
                            <td className="p-2">{t.equipmentType.replace('_', ' ').toUpperCase()}</td>
                            <td className="p-2">Cl. {t.equipmentClass || '0'}</td>
                            <td className="p-2 font-semibold text-blue-700">{t.appliedVoltage_kV} kV</td>
                            <td className="p-2 font-bold">{t.measuredLeakageCurrent_mA?.toFixed(1) || '0.0'} mA</td>
                            <td className="p-2 text-slate-500">≤{t.leakageCurrentLimit_mA || 12} mA</td>
                            <td className="p-2">
                              {t.result === 'APROVADO' ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                                  APROVADO
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded text-[10px]">
                                  REPROVADO
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-right font-mono font-semibold text-slate-600">
                              {onOpenTestLaudo ? (
                                <button
                                  onClick={() => onOpenTestLaudo(t)}
                                  className="text-blue-600 hover:underline cursor-pointer"
                                  title="Ver Laudo Individual"
                                >
                                  {t.reportNumber}
                                </button>
                              ) : (
                                t.reportNumber
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* FOLHA 6: ANÁLISE DOS RESULTADOS, CONCLUSÃO & ASSINATURAS */}
            {/* ---------------------------------------------------- */}
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-300 p-8 sm:p-12 space-y-6 min-h-[1050px] flex flex-col justify-between print:shadow-none print:rounded-none print:border-none print:m-0 print:p-8">
              
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    5. Análise dos Resultados, Conclusão & Assinaturas
                  </span>
                  <span className="text-xs text-slate-400">{reportCode}</span>
                </div>

                {/* Análise Estatística */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-300 pb-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-black text-slate-900 uppercase">
                      6. Análise Técnica dos Resultados Obtidos
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Ensaiado</span>
                      <span className="text-xl font-black text-slate-900">{reportStats.total}</span>
                      <span className="text-[10px] text-slate-400 block">EPIs e EPCs</span>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Aprovados</span>
                      <span className="text-xl font-black text-emerald-800">{reportStats.approved}</span>
                      <span className="text-[10px] text-emerald-600 block">{reportStats.approvalRate.toFixed(1)}% do lote</span>
                    </div>

                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                      <span className="text-[10px] uppercase font-bold text-red-700 block">Reprovados</span>
                      <span className="text-xl font-black text-red-800">{reportStats.rejected}</span>
                      <span className="text-[10px] text-red-600 block">{((reportStats.rejected / (reportStats.total || 1)) * 100).toFixed(1)}% do lote</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify pt-2">
                    {resultsAnalysisText || getDefaultAnalysis()}
                  </div>
                </div>

                {/* Conclusão Técnica */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 border-b border-slate-300 pb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-black text-slate-900 uppercase">
                      7. Conclusão Técnica e Recomendações
                    </h3>
                  </div>

                  <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                    {conclusionText || getDefaultConclusion()}
                  </div>
                </div>
              </div>

              {/* Assinaturas Oficiais */}
              <div className="pt-8 border-t-2 border-slate-200 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs">
                  {/* Left Signature: Técnico */}
                  <div className="space-y-2">
                    <div className="w-48 h-10 border-b border-slate-800 mx-auto flex items-end justify-center pb-1">
                      <span className="font-serif italic text-sm text-slate-700 font-semibold">{technicianName}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{technicianName}</p>
                      <p className="text-[11px] text-slate-500">Técnico Executor / Laboratorista ({technicianCreaOrCft})</p>
                    </div>
                  </div>

                  {/* Right Signature: RT */}
                  <div className="space-y-2">
                    <div className="w-48 h-10 border-b border-slate-800 mx-auto flex items-end justify-center pb-1">
                      <span className="font-serif italic text-sm text-slate-700 font-semibold">{techResponsibleName}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{techResponsibleName}</p>
                      <p className="text-[11px] text-slate-500">Engenheiro Eletricista • Responsável Técnico</p>
                      <p className="text-[10px] text-slate-400">CREA: {techResponsibleCrea} • RNP: {techResponsibleRnp}</p>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-400">
                  Emitido por {companyInfo.name} em {formatDateBR(emissionDate)} • Autenticidade garantida por chave criptográfica.
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* FOLHA 7+: ANEXO I - LAUDOS TÉCNICOS INDIVIDUAIS */}
            {/* ---------------------------------------------------- */}
            {includeIndividualReportsAnnex && (
              <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-300 p-8 sm:p-12 space-y-6 min-h-[1050px] print:shadow-none print:rounded-none print:border-none print:m-0 print:p-8 print:page-break-after">
                
                {/* Header Folha */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Anexo I: Laudos Técnicos Individuais dos Ensaios Dielétricos
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{reportCode}</span>
                </div>

                {/* Banner de Abertura do Anexo */}
                <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full border border-blue-400/30">
                      Anexo Oficial Integrado
                    </span>
                    <span className="text-xs font-mono text-slate-300">
                      {selectedTests.length} Laudos Técnicos Anexados
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                    {annexTitle || 'ANEXO I – LAUDOS TÉCNICOS INDIVIDUAIS DOS ENSAIOS DIELÉTRICOS'}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Dossiê completo contendo a íntegra de cada Certificado Individual de Ensaio Elétrico de Prova, com medições de corrente de fuga, inspeções visuais/pneumáticas, rastreabilidade metrológica e validação eletrônica.
                  </p>
                </div>

                {/* Declaração de Rastreabilidade */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs text-slate-700">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2 uppercase text-[11px]">
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    <span>Declaração de Rastreabilidade Metrológica e Validade Jurídica</span>
                  </h4>
                  <p className="text-[11px] leading-relaxed text-justify">
                    Cada certificado individual anexado a este relatório possui numeração própria, parâmetros elétricos certificados, código de validação digital e conformidade com as normas ABNT NBR 16295, ASTM D1051, ASTM D1048 e NR-10. Todos os ensaios foram realizados utilizando instrumentos com calibração RBC vigente.
                  </p>
                </div>

                {/* Lista / Cards dos Laudos Técnicos Individuais */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-xs font-black text-slate-900 uppercase flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-blue-600" />
                      <span>Laudos Técnicos Individuais Integrados ({selectedTests.length})</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {reportStats.approved} Aprovados • {reportStats.rejected} Reprovados
                    </span>
                  </div>

                  <div className="space-y-4">
                    {selectedTests.map((test, index) => {
                      const isApproved = test.result === 'APROVADO';
                      return (
                        <div 
                          key={test.id}
                          className={`p-4 rounded-xl border transition-all ${
                            isApproved 
                              ? 'bg-slate-50/70 border-slate-200 hover:border-blue-300' 
                              : 'bg-red-50/50 border-red-200 hover:border-red-300'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                                {index + 1}
                              </span>
                              <div>
                                <span className="font-mono font-bold text-xs text-blue-900">{test.reportNumber}</span>
                                <span className="text-[11px] text-slate-500 ml-2">TAG: <strong className="text-slate-800">{test.equipmentTag}</strong></span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                Cl. {test.equipmentClass || '0'}
                              </span>
                              {isApproved ? (
                                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                                  APROVADO
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 bg-red-100 text-red-800 text-[10px] font-black rounded-full uppercase flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-red-600" />
                                  REPROVADO
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Grid com detalhes do laudo */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                            <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-0.5">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Equipamento</span>
                              <p className="font-semibold text-slate-800 truncate">{test.equipmentType.replace('_', ' ').toUpperCase()}</p>
                              <p className="text-[10px] text-slate-500 truncate">{test.manufacturer || 'Fabricante N/D'} • S/N: {test.serialNumber || 'S/N'}</p>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-0.5">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Tensão de Prova</span>
                              <p className="font-bold text-blue-950">{test.appliedVoltage_kV} kV CA</p>
                              <p className="text-[10px] text-slate-500">Duração: {test.testDuration_seconds || 60}s</p>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-0.5">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Corrente de Fuga</span>
                              <p className={`font-mono font-bold ${isApproved ? 'text-slate-800' : 'text-red-700'}`}>
                                {test.measuredLeakageCurrent_mA?.toFixed(1) || '0.0'} mA
                              </p>
                              <p className="text-[10px] text-slate-500">Limite: ≤{test.leakageCurrentLimit_mA || 12} mA</p>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-0.5">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">Validação & QR</span>
                              <p className="font-mono text-[10px] text-slate-700 truncate">{test.validationCode || 'VAL-CERT'}</p>
                              <p className="text-[10px] text-emerald-700 font-semibold">Validade: {formatDateBR(test.nextTestDate || emissionDate)}</p>
                            </div>
                          </div>

                          {/* Observações / Não conformidades se houver */}
                          {test.observations && (
                            <div className="mt-2 text-[10px] text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-100">
                              <strong className="text-slate-700">Observações:</strong> {test.observations}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-200">
                  Fim do Anexo I • Todos os laudos individuais encontram-se vinculados ao Relatório Consolidado {reportCode}.
                </div>
              </div>
            )}
            </>
            )}

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CONFIGURADOR DE SEÇÕES & SELEÇÃO DE LAUDOS (EDITOR) */}
      {/* ======================================================== */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Metadata & Selection (1 col) */}
          <div className="space-y-6">
            
            {/* Formato de Relatório Selector Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Modelo & Tipo do Relatório</span>
              </h3>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setReportFormat('simplificado');
                    if (reportTitle.includes('CONSOLIDADO')) {
                      setReportTitle('RELATÓRIO TÉCNICO SIMPLIFICADO & TABULAÇÃO DE ENSAIOS DIELÉTRICOS');
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    reportFormat === 'simplificado'
                      ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    reportFormat === 'simplificado' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Relatório Simplificado</span>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                        Novo
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Exibe identificação da empresa, normas técnicas e tabela resumo dos ensaios agrupada e ordenada por <strong>colaborador e equipamentos</strong>.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReportFormat('completo');
                    if (reportTitle.includes('SIMPLIFICADO')) {
                      setReportTitle('RELATÓRIO TÉCNICO CONSOLIDADO DE ENSAIOS DIELÉTRICOS');
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    reportFormat === 'completo'
                      ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    reportFormat === 'completo' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Dossiê Completo NR-10</span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                        Multipáginas
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Dossiê completo com Capa, Sumário Executivo, Introdução, Metodologia, Normas, Laudos Individuais em Anexo e Conclusão.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Filter & Selection Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>1. Filtros de Seleção do Lote</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cliente Solicitante:</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => {
                      setSelectedClientId(e.target.value);
                      setSelectedOSId('');
                    }}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="">-- Todos os Clientes --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.razaoSocial} ({c.nomeFantasia || c.razaoSocial})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ordem de Serviço (OS):</label>
                  <select
                    value={selectedOSId}
                    onChange={(e) => setSelectedOSId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="">-- Todas as OSs / Avulso --</option>
                    {serviceOrders
                      .filter(os => !selectedClientId || os.clientId === selectedClientId)
                      .map(os => (
                        <option key={os.id} value={os.id}>{os.osNumber} - {os.clientName || 'Cliente'}</option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Data Início:</label>
                    <input
                      type="date"
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Data Fim:</label>
                    <input
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Buscar por TAG / Laudo:</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Ex: LUV-001, LAU-2608..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl pl-9 p-2.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Report Header Metadata Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Edit3 className="w-4 h-4 text-orange-600" />
                <span>2. Identificação do Relatório</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código do Relatório:</label>
                  <input
                    type="text"
                    value={reportCode}
                    onChange={(e) => setReportCode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2.5 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Título do Documento:</label>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ART CREA Vinculada:</label>
                  <input
                    type="text"
                    placeholder="Ex: ART-CREA-SP-2026-9812401"
                    value={artNumber}
                    onChange={(e) => setArtNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2.5 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Data Emissão:</label>
                    <input
                      type="date"
                      value={emissionDate}
                      onChange={(e) => setEmissionDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Local:</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2"
                    />
                  </div>
                </div>

                {/* Responsible Engineering */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Responsável Técnico (Engenheiro):</label>
                    <input
                      type="text"
                      value={techResponsibleName}
                      onChange={(e) => setTechResponsibleName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2 font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">CREA:</label>
                      <input
                        type="text"
                        value={techResponsibleCrea}
                        onChange={(e) => setTechResponsibleCrea(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">RNP:</label>
                      <input
                        type="text"
                        value={techResponsibleRnp}
                        onChange={(e) => setTechResponsibleRnp(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Technician */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Técnico / Laboratorista:</label>
                    <input
                      type="text"
                      value={technicianName}
                      onChange={(e) => setTechnicianName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Registro CFT/CREA:</label>
                    <input
                      type="text"
                      value={technicianCreaOrCft}
                      onChange={(e) => setTechnicianCreaOrCft(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Middle & Right Column: Selection List & Custom Text Areas (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Ensaios Checkbox Selector */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    3. Selecionar Laudos de Ensaios ({selectedTestIds.length} de {availableTests.length} marcados)
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleSelectAll}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    {selectedTestIds.length === availableTests.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                  </button>
                </div>
              </div>

              {availableTests.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl">
                  Nenhum ensaio disponível com os filtros atuais. Altere o cliente ou os filtros de data.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {availableTests.map((test) => {
                    const isSelected = selectedTestIds.includes(test.id);
                    return (
                      <div
                        key={test.id}
                        onClick={() => handleToggleTest(test.id)}
                        className={`p-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer text-xs ${
                          isSelected ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="text-blue-600 focus:outline-hidden"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>

                          <div>
                            <span className="font-bold text-slate-900">{test.equipmentTag}</span>
                            <span className="text-slate-400 ml-2">({test.equipmentType.replace('_', ' ')})</span>
                            <span className="text-slate-500 block text-[11px]">
                              {test.clientName} • OS: {test.serviceOrderNumber || 'Avulso'} • {formatDateBR(test.testDate)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-slate-700">{test.appliedVoltage_kV} kV</span>
                          <span className="font-mono text-slate-500">{test.measuredLeakageCurrent_mA?.toFixed(1)} mA</span>
                          {test.result === 'APROVADO' ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                              APROVADO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded">
                              REPROVADO
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom Text Areas: Introdução */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>4. Texto da Introdução & Contextualização NR-10</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIntroductionText(getDefaultIntro())}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  Restaurar Padrão NR-10
                </button>
              </div>

              <textarea
                rows={5}
                value={introductionText || getDefaultIntro()}
                onChange={(e) => setIntroductionText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-3 focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
              />
            </div>

            {/* Custom Text Areas: Análise de Resultados */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  <span>5. Análise Técnica e Diagnóstico dos Resultados</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setResultsAnalysisText(getDefaultAnalysis())}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  Restaurar Análise Padrão
                </button>
              </div>

              <textarea
                rows={5}
                value={resultsAnalysisText || getDefaultAnalysis()}
                onChange={(e) => setResultsAnalysisText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-3 focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
              />
            </div>

            {/* Custom Text Areas: Conclusão e Recomendações */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>6. Conclusão Técnica e Recomendações de Reensaio</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setConclusionText(getDefaultConclusion())}
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  Restaurar Conclusão Padrão
                </button>
              </div>

              <textarea
                rows={6}
                value={conclusionText || getDefaultConclusion()}
                onChange={(e) => setConclusionText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-3 focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
              />
            </div>

            {/* Custom Section 7: Configuração do Anexo de Laudos Individuais */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-blue-600" />
                  <span>7. Anexo de Laudos Técnicos Individuais (NR-10)</span>
                </h3>
                <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {selectedTests.length} Laudos Selecionados
                </span>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900">
                    Incluir Laudos Técnicos Individuais como Anexo
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Gera e anexa a íntegra de cada certificado técnico individual no PDF consolidado.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeIndividualReportsAnnex}
                    onChange={(e) => setIncludeIndividualReportsAnnex(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {includeIndividualReportsAnnex && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Título do Anexo no Relatório:</label>
                    <input
                      type="text"
                      value={annexTitle}
                      onChange={(e) => setAnnexTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-semibold"
                      placeholder="Ex: ANEXO I – LAUDOS TÉCNICOS INDIVIDUAIS DOS ENSAIOS DIELÉTRICOS"
                    />
                  </div>

                  <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl text-[11px] text-blue-900 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                      Estrutura do Dossiê Completo:
                    </p>
                    <p className="text-blue-800 text-[10px]">
                      O relatório PDF conterá a Capa + Sumário Geral + Metodologia + Normas + Tabela Síntese + Análise e Conclusão com Assinaturas + <strong>Capa do Anexo I e todas as folhas dos laudos individuais de cada equipamento</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setActiveTab('preview')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Visualizar Relatório Formatado</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: HISTÓRICO DE RELATÓRIOS SALVOS (HISTORY) */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Histórico de Relatórios Técnicos Consolidados
              </h3>
              <p className="text-xs text-slate-500">
                Relação dos dossiês técnicos gerados no sistema para consulta e re-emissão de PDFs.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg">
              {savedReports.length} relatórios registrados
            </span>
          </div>

          {savedReports.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
              <ClipboardList className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Nenhum relatório consolidado salvo ainda.</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Crie um novo relatório a partir da aba de pré-visualização e clique em "Salvar Dossiê" ou "Exportar PDF Completo".
              </p>
              <button
                onClick={() => setActiveTab('preview')}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
              >
                Criar Novo Relatório
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3.5">Código</th>
                    <th className="p-3.5">Cliente</th>
                    <th className="p-3.5">OS / ART</th>
                    <th className="p-3.5">Data Emissão</th>
                    <th className="p-3.5">Total de Laudos</th>
                    <th className="p-3.5">Aprovação</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {savedReports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-bold font-mono text-slate-900">{rep.reportCode}</td>
                      <td className="p-3.5 font-semibold text-slate-800">{rep.clientName}</td>
                      <td className="p-3.5">
                        <span className="text-slate-700 block">{rep.serviceOrderNumber || 'Avulso'}</span>
                        {rep.artNumber && <span className="text-[10px] text-amber-700 font-mono">{rep.artNumber}</span>}
                      </td>
                      <td className="p-3.5">{formatDateBR(rep.emissionDate)}</td>
                      <td className="p-3.5 font-bold">{rep.testsSummary?.total || rep.testIds?.length || 0} itens</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                          {rep.testsSummary?.approvalRate?.toFixed(0) || 100}%
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleLoadSavedReport(rep)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            title="Abrir e Visualizar Relatório"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Abrir</span>
                          </button>

                          <button
                            onClick={async () => {
                              const repTests = allTests.filter(t => (rep.testIds || []).includes(t.id));
                              await exportConsolidatedReportPDF(rep, repTests, companyInfo);
                            }}
                            className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            title="Baixar PDF do Relatório"
                          >
                            <Download className="w-3.5 h-3.5 text-orange-600" />
                            <span>PDF</span>
                          </button>

                          <button
                            onClick={async () => {
                              const repTests = allTests.filter(t => (rep.testIds || []).includes(t.id));
                              await exportReportToWord({
                                report: rep,
                                tests: repTests,
                                companyInfo,
                                clientsList: clients,
                                exportOptions: {
                                  reportFormat: 'completo',
                                  reportCode: rep.reportCode,
                                  reportTitle: rep.title
                                }
                              });
                            }}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            title="Exportar para Microsoft Word (.doc/.docx)"
                          >
                            <FileDown className="w-3.5 h-3.5 text-blue-700" />
                            <span>Word</span>
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`Tem certeza que deseja excluir o relatório ${rep.reportCode}?`)) {
                                DielectricStorageService.deleteConsolidatedReport(rep.id);
                                setSavedReports(DielectricStorageService.getConsolidatedReports());
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Excluir do Histórico"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
