import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Check, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  Sliders, 
  Zap, 
  Clock, 
  X,
  AlertCircle,
  Table as TableIcon,
  Info,
  Layers,
  Sparkles,
  CheckCircle2,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import { NormCriterion, EquipmentType, DielectricClass } from '../types';
import { DielectricStorageService } from '../services/syncEngine';
import { TABELA_4_NBR_16295, NBR16295TableEntry, GloveLength_mm } from '../services/nbr16295Service';
import { 
  TABELA_ASTM_D1048, 
  TABELA_ASTM_D178, 
  getASTMD1048Entry,
  getASTMD178Entry,
  BLANKET_STYLES_INFO, 
  BLANKET_TYPES_INFO, 
  BLANKET_SIZES_INFO,
  MATTING_SURFACES_INFO 
} from '../services/astmBlanketMattingService';
import { 
  IEC_61243_1_TABLE,
  IEC_61243_CLIMATIC_CATEGORIES,
  IEC_61243_TEST_STEPS,
  calculateIEC61243ThresholdRange
} from '../services/iec61243DetectorService';
import {
  TABELA_NORMAS_ESCADAS_FIBRA,
  LADDER_TYPES_INFO,
  LADDER_TEST_METHODS_INFO
} from '../services/ladderNormsService';
import { getNormPresetForEquipment } from '../services/normsEngine';

export const NormsView: React.FC = () => {
  const [norms, setNorms] = useState<NormCriterion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'lista' | 'tabela4_nbr16295' | 'astm_d1048' | 'astm_d178' | 'escadas_normas' | 'iec_61243_1' | 'nbr_9699_ferramentas'>('lista');
  const [selectedClassInTable, setSelectedClassInTable] = useState<DielectricClass | null>(null);
  const [selectedDetectorEntryId, setSelectedDetectorEntryId] = useState<string | null>(null);
  const [selectedLadderNormId, setSelectedLadderNormId] = useState<string | null>(null);
  const [detectorSimVoltage, setDetectorSimVoltage] = useState<number>(13.8);
  const [toolSimQuantity, setToolSimQuantity] = useState<number>(5);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNorm, setEditingNorm] = useState<NormCriterion | null>(null);

  // Form State
  const [normCode, setNormCode] = useState('NBR 16295 Tabela 4');
  const [normName, setNormName] = useState('Luvas de Material Isolante');
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('luva_isolante');
  const [dielectricClass, setDielectricClass] = useState<DielectricClass>('2');
  const [testVoltage_kV, setTestVoltage_kV] = useState(20);
  const [voltageType, setVoltageType] = useState<'AC' | 'DC'>('AC');
  const [testDurationSeconds, setTestDurationSeconds] = useState(60);
  const [maxLeakageCurrent, setMaxLeakageCurrent] = useState(16);
  const [currentUnit, setCurrentUnit] = useState<'mA' | 'uA'>('mA');
  const [retestIntervalMonths, setRetestIntervalMonths] = useState(6);
  const [standardProcedureCode, setStandardProcedureCode] = useState('PR-JVM-LAB-01 Rev.08');
  const [description, setDescription] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const applyEquipmentPreset = (type: EquipmentType, cl: DielectricClass = dielectricClass) => {
    const preset = getNormPresetForEquipment(type, cl);
    setNormCode(preset.normCode);
    setNormName(preset.normName);
    setTestVoltage_kV(preset.testVoltage_kV);
    setVoltageType(preset.voltageType);
    setTestDurationSeconds(preset.testDurationSeconds);
    setMaxLeakageCurrent(preset.maxLeakageCurrent);
    setCurrentUnit(preset.currentUnit);
    setRetestIntervalMonths(preset.retestIntervalMonths);
    setStandardProcedureCode(preset.standardProcedureCode);
    setDescription(preset.description);
  };

  const loadNorms = () => {
    setNorms(DielectricStorageService.getNorms());
  };

  useEffect(() => {
    loadNorms();
  }, []);

  const handleOpenCreate = () => {
    setEditingNorm(null);
    setIsDeleting(false);
    setEquipmentType('luva_isolante');
    setDielectricClass('2');
    applyEquipmentPreset('luva_isolante', '2');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (norm: NormCriterion) => {
    setEditingNorm(norm);
    setIsDeleting(false);
    setNormCode(norm.normCode);
    setNormName(norm.normName);
    setEquipmentType(norm.applicableEquipmentTypes?.[0] || 'luva_isolante');
    setDielectricClass(norm.dielectricClass as DielectricClass);
    setTestVoltage_kV(norm.testVoltage_kV);
    setVoltageType(norm.voltageType);
    setTestDurationSeconds(norm.testDurationSeconds);
    setMaxLeakageCurrent(norm.maxLeakageCurrent);
    setCurrentUnit(norm.currentUnit);
    setRetestIntervalMonths(norm.defaultRetestMonths || 6);
    setStandardProcedureCode('PR-JVM-LAB-01');
    setDescription(norm.notes || '');
    setIsModalOpen(true);
  };

  const handleDeleteNorm = () => {
    if (!editingNorm) return;
    DielectricStorageService.deleteNorm(editingNorm.id);
    loadNorms();
    setIsModalOpen(false);
    setEditingNorm(null);
    setIsDeleting(false);
  };

  const handleSaveNorm = (e: React.FormEvent) => {
    e.preventDefault();

    const newCriterion: NormCriterion = {
      id: editingNorm?.id || 'norm-' + Date.now(),
      normCode: normCode.trim(),
      normName: normName.trim(),
      editionOrVersion: editingNorm?.editionOrVersion || '2023 - Vigente',
      effectiveDate: editingNorm?.effectiveDate || '2023-01-01',
      applicableEquipmentTypes: [equipmentType],
      dielectricClass,
      nominalVoltageMaxAC_kV: Number(testVoltage_kV) / 2,
      nominalVoltageMaxDC_kV: Number(testVoltage_kV) / 1.5,
      testVoltage_kV: Number(testVoltage_kV),
      voltageType,
      testDurationSeconds: Number(testDurationSeconds),
      maxLeakageCurrent: Number(maxLeakageCurrent),
      currentUnit,
      defaultRetestMonths: Number(retestIntervalMonths),
      approvalCriterion: 'visual_and_leakage',
      notes: description.trim(),
      status: 'active'
    };

    DielectricStorageService.saveNorm(newCriterion);
    loadNorms();
    setIsModalOpen(false);
  };

  const filteredNorms = norms.filter(n => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      String(n.normCode || '').toLowerCase().includes(term) ||
      String(n.normName || '').toLowerCase().includes(term) ||
      (Array.isArray(n.applicableEquipmentTypes) && n.applicableEquipmentTypes.some(t => String(t).toLowerCase().includes(term)));

    const matchesType = filterType === 'all' || (n.applicableEquipmentTypes && n.applicableEquipmentTypes.includes(filterType as any));
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Motor de Normas & Critérios Técnicos</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full border border-blue-200">
              <Sparkles className="w-3 h-3 text-blue-600" /> ABNT NBR 16295 / Tabela 4 Ativa
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Critérios normativos oficiais, métodos de ensaio de prova, rigidez dielétrica e limites por comprimento de luva
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab buttons */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold flex-wrap">
            <button
              onClick={() => setActiveTab('lista')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'lista'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Critérios Cadastrados ({norms.length})
            </button>
            <button
              onClick={() => setActiveTab('tabela4_nbr16295')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'tabela4_nbr16295'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-blue-600" /> Luvas NBR 16295
            </button>
            <button
              onClick={() => setActiveTab('astm_d1048')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'astm_d1048'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-amber-600" /> Mantas ASTM D1048
            </button>
            <button
              onClick={() => setActiveTab('astm_d178')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'astm_d178'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-emerald-600" /> Tapetes ASTM D178-22
            </button>
            <button
              onClick={() => setActiveTab('escadas_normas')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'escadas_normas'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" /> Escadas EN 50528 / NBR 61478
            </button>
            <button
              onClick={() => setActiveTab('iec_61243_1')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'iec_61243_1'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Detectores IEC 61243-1
            </button>
            <button
              onClick={() => setActiveTab('nbr_9699_ferramentas')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'nbr_9699_ferramentas'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-blue-600" /> Ferramentas NBR 9699
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Critério
          </button>
        </div>
      </div>

      {activeTab === 'tabela4_nbr16295' ? (
        /* TABELA 4 NBR 16295 DEDICATED VIEW */
        <div className="space-y-6">
          {/* Card: Official Standard Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-700 text-white font-mono font-bold text-xs rounded-md">
                    ABNT NBR 16295:2023
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs rounded-md">
                    IEC 60903 (Ed. 3.0)
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Vigente
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mt-2">
                  Tabela 4 — Ensaio de prova e ensaio de rigidez dielétrica
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Trabalhos em linha viva — Luvas de material isolante (Ensaios em Corrente Alternada CA 60Hz e Corrente Contínua CC)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">Destacar Classe:</span>
                {(['00', '0', '1', '2', '3', '4'] as DielectricClass[]).map(cl => (
                  <button
                    key={cl}
                    onClick={() => setSelectedClassInTable(selectedClassInTable === cl ? null : cl)}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                      selectedClassInTable === cl
                        ? 'bg-blue-600 text-white shadow-xs scale-105'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Cl {cl}
                  </button>
                ))}
              </div>
            </div>

            {/* Official Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold text-center">
                    <th rowSpan={3} className="p-2.5 border border-slate-300 bg-slate-200/80">
                      Classe de luvas <sup className="text-blue-600 font-bold">d</sup>
                    </th>
                    <th colSpan={7} className="p-2 border border-slate-300 bg-blue-50/70 text-blue-950 font-extrabold">
                      Ensaios de CA (Corrente Alternada 60 Hz)
                    </th>
                    <th colSpan={3} className="p-2 border border-slate-300 bg-amber-50/70 text-amber-950 font-extrabold">
                      Ensaios de CC (Corrente Contínua)
                    </th>
                  </tr>
                  <tr className="bg-slate-100/70 text-slate-800 border-b border-slate-300 text-center font-bold text-[11px]">
                    <th rowSpan={2} className="p-2 border border-slate-300">
                      Tensão máxima de uso<br/><span className="text-slate-500 font-normal">kVrms</span>
                    </th>
                    <th rowSpan={2} className="p-2 border border-slate-300">
                      Tensão de prova<br/><span className="text-slate-500 font-normal">kVrms</span>
                    </th>
                    <th colSpan={4} className="p-1.5 border border-slate-300 bg-blue-100/50">
                      Corrente máxima de fuga <sup className="text-blue-600">b, c</sup><br/>
                      <span className="font-semibold">mArms</span> por Comprimento da luva (mm)
                    </th>
                    <th rowSpan={2} className="p-2 border border-slate-300">
                      Tensão de rigidez dielétrica<br/><span className="text-slate-500 font-normal">kVrms</span>
                    </th>
                    <th rowSpan={2} className="p-2 border border-slate-300 bg-amber-50/40">
                      Tensão máxima de uso Média<br/><span className="text-slate-500 font-normal">kV</span>
                    </th>
                    <th rowSpan={2} className="p-2 border border-slate-300 bg-amber-50/40">
                      Tensão de prova Média<br/><span className="text-slate-500 font-normal">kV</span>
                    </th>
                    <th rowSpan={2} className="p-2 border border-slate-300 bg-amber-50/40">
                      Tensão de rigidez dielétrica Média<br/><span className="text-slate-500 font-normal">kV</span>
                    </th>
                  </tr>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-300 text-center font-mono font-bold text-[11px]">
                    <th className="p-1.5 border border-slate-300 w-16">280</th>
                    <th className="p-1.5 border border-slate-300 w-16">360</th>
                    <th className="p-1.5 border border-slate-300 w-16">410</th>
                    <th className="p-1.5 border border-slate-300 w-16">≥ 460</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {TABELA_4_NBR_16295.map((entry) => {
                    const isHighlighted = selectedClassInTable === entry.classe;
                    return (
                      <tr 
                        key={entry.classe}
                        onClick={() => setSelectedClassInTable(isHighlighted ? null : entry.classe)}
                        className={`cursor-pointer transition-colors text-center ${
                          isHighlighted 
                            ? 'bg-blue-100/80 font-bold ring-2 ring-blue-600 ring-inset' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-2.5 font-bold font-mono text-slate-900 border border-slate-300 bg-slate-50">
                          Classe {entry.classe}
                        </td>
                        <td className="p-2 font-mono border border-slate-300">
                          {entry.tensaoMaximaUsoAC_kV.toFixed(1).replace('.0', '')}
                        </td>
                        <td className="p-2 font-mono font-bold text-blue-700 border border-slate-300">
                          {entry.tensaoProvaAC_kV.toFixed(1).replace('.0', '')}
                        </td>
                        
                        {/* Fuga 280 mm */}
                        <td className="p-2 font-mono border border-slate-300">
                          {entry.limitesFugaAC_mA[280] !== null ? (
                            <span className="font-bold text-slate-900">{entry.limitesFugaAC_mA[280]}</span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">N/a <sup className="text-slate-400">a</sup></span>
                          )}
                        </td>

                        {/* Fuga 360 mm */}
                        <td className="p-2 font-mono border border-slate-300">
                          {entry.limitesFugaAC_mA[360] !== null ? (
                            <span className="font-bold text-slate-900">{entry.limitesFugaAC_mA[360]}</span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">N/a <sup className="text-slate-400">a</sup></span>
                          )}
                        </td>

                        {/* Fuga 410 mm */}
                        <td className="p-2 font-mono border border-slate-300">
                          {entry.limitesFugaAC_mA[410] !== null ? (
                            <span className="font-bold text-slate-900">{entry.limitesFugaAC_mA[410]}</span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">N/a <sup className="text-slate-400">a</sup></span>
                          )}
                        </td>

                        {/* Fuga >= 460 mm */}
                        <td className="p-2 font-mono border border-slate-300">
                          {entry.limitesFugaAC_mA[460] !== null ? (
                            <span className="font-bold text-slate-900">{entry.limitesFugaAC_mA[460]}</span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">N/a <sup className="text-slate-400">a</sup></span>
                          )}
                        </td>

                        {/* Tensão Rigidez CA */}
                        <td className="p-2 font-mono font-bold text-emerald-800 border border-slate-300">
                          {entry.tensaoRigidezAC_kV}
                        </td>

                        {/* Ensaios CC */}
                        <td className="p-2 font-mono border border-slate-300 bg-amber-50/20">
                          {entry.tensaoMaximaUsoDC_kV}
                        </td>
                        <td className="p-2 font-mono font-bold text-amber-800 border border-slate-300 bg-amber-50/20">
                          {entry.tensaoProvaDC_kV}
                        </td>
                        <td className="p-2 font-mono font-bold text-red-800 border border-slate-300 bg-amber-50/20">
                          {entry.tensaoRigidezDC_kV}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Normative Footnotes (Notas a, b, c, d) */}
            <div className="mt-4 pt-3 border-t border-slate-200 space-y-2 text-[11px] text-slate-600 bg-slate-50/80 p-3.5 rounded-xl">
              <div className="flex items-start gap-2">
                <span className="font-bold text-blue-700 w-4 shrink-0 font-mono">a</span>
                <span><strong>N/a = Não aplicável:</strong> Comprimentos não padronizados para a respectiva classe de luva.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-blue-700 w-4 shrink-0 font-mono">b</span>
                <span>
                  As luvas que durante os ensaios mostrarem valores de corrente de fuga igual ou menor que os valores indicados na <strong>Tabela 4</strong> terão, durante o uso normal, valores de corrente de fuga reais muito mais baixos que o limite inicial de fibrilação ventricular. Isto é porque a região de contato com a água durante estes ensaios é muito maior que a região de contato da mão dentro da luva e a região de contato da luva com as partes elétricas de linha viva do equipamento manuseado durante o uso normal. Além disso, a tensão do ensaio de prova é mais alta que a tensão de uso máxima recomendada.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-blue-700 w-4 shrink-0 font-mono">c</span>
                <span>
                  Para os ensaios de tipo e de amostragem que necessitam de condicionamento para absorção de umidade, a corrente de fuga fornecida pela Tabela 5 deve ser acrescida em <strong>2 mA</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-blue-700 w-4 shrink-0 font-mono">d</span>
                <span>
                  Consultar o Anexo D para a seleção da classe das luvas.
                </span>
              </div>
              <div className="flex items-start gap-2 pt-2 border-t border-blue-200/60 bg-blue-50/70 p-2 rounded-lg">
                <span className="font-bold text-blue-700 w-4 shrink-0 font-mono">⚡</span>
                <span className="text-blue-900 font-medium">
                  <strong>Ensaio com 2 Luvas Simultâneas:</strong> Nos ensaios realizados com duas luvas em paralelo na mesma cuba de teste, o sistema considera automaticamente o dobro da corrente de fuga permitida pela Tabela 4 (Limite = Limite Tabela 4 × 2).
                </span>
              </div>
            </div>

            {/* Normative Methods and Approval Criteria Clauses */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs">
                <h4 className="font-bold text-blue-900 flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  Critério de Aprovação no Ensaio de Prova (8.4.2.1 CA / 8.4.3.1 CC)
                </h4>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  O ensaio de prova é considerado <strong>BEM-SUCEDIDO (APROVADO)</strong> se:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1 text-[11px] text-slate-700">
                  <li>A <strong>tensão de prova for alcançada e mantida</strong> durante todo o período de ensaio (sem ocorrência de disrupção, descarga ou perfuração);</li>
                  <li>A <strong>corrente de fuga não exceder os valores especificados</strong> na Tabela 4 durante o período de ensaio. A medição de corrente pode ser realizada continuamente ou no final do período de ensaio.</li>
                </ul>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                <h4 className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Critério de Aprovação na Rigidez Dielétrica (8.4.2.2 CA / 8.4.3.2 CC)
                </h4>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  O ensaio de rigidez dielétrica é considerado <strong>BEM-SUCEDIDO</strong> se a tensão em que a perfuração elétrica ocorrer for igual ou exceder os valores especificados na <strong>Tabela 4</strong> (5 kV a 50 kV CA / 8 kV a 90 kV CC).
                </p>
                <div className="mt-2 text-[10px] text-emerald-800 bg-white/80 p-2 rounded-lg border border-emerald-200 font-mono">
                  Inspeção visual preliminar com teste de retenção e inflamento de ar é obrigatória antes de qualquer ensaio elétrico (Item 8.2).
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'astm_d1048' ? (
        /* ASTM D-1048-14 MANTAS ISOLANTES VIEW */
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-extrabold text-xs rounded-lg border border-amber-300">
                  ASTM D-1048-14 (Reapproved 2020)
                </span>
                <span className="text-xs font-bold text-slate-500">• Mantas e Lençóis Isolantes de Borracha</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mt-1">
                Tabela 1 e Tabela 2 — Requisitos Elétricos, Espessura e Folga de Eletrodo Anti-Arco (Flashover)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Standard Specification for Rubber Insulating Blankets (Ensaios em Corrente Alternada CA 60Hz e Corrente Contínua CC)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Destacar Classe:</span>
              {(['0', '1', '2', '3', '4'] as DielectricClass[]).map(cl => (
                <button
                  key={cl}
                  onClick={() => setSelectedClassInTable(selectedClassInTable === cl ? null : cl)}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                    selectedClassInTable === cl
                      ? 'bg-amber-600 text-white shadow-xs scale-105'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cl {cl}
                </button>
              ))}
            </div>
          </div>

          {/* ASTM D1048 Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold text-center">
                  <th rowSpan={2} className="p-2.5 border border-slate-300 bg-slate-200/80">
                    Classe Dielétrica
                  </th>
                  <th colSpan={3} className="p-2 border border-slate-300 bg-amber-50 text-amber-950 font-extrabold">
                    Ensaios CA 60 Hz (Tabela 1)
                  </th>
                  <th colSpan={3} className="p-2 border border-slate-300 bg-orange-50 text-orange-950 font-extrabold">
                    Ensaios CC (Tabela 1)
                  </th>
                  <th colSpan={2} className="p-2 border border-slate-300 bg-slate-100 text-slate-900 font-bold">
                    Requisitos Físicos (Tabela 2)
                  </th>
                </tr>
                <tr className="bg-slate-50 text-slate-800 border-b border-slate-300 text-center font-bold text-[11px]">
                  <th className="p-2 border border-slate-300">Tensão Máx. Uso<br/><span className="text-slate-500 font-normal">V CA rms</span></th>
                  <th className="p-2 border border-slate-300">Tensão Prova (60s)<br/><span className="text-amber-800 font-bold">kV CA</span></th>
                  <th className="p-2 border border-slate-300">Rigidez Dielétrica<br/><span className="text-indigo-800 font-bold">kV CA</span></th>
                  <th className="p-2 border border-slate-300">Tensão Máx. Uso<br/><span className="text-slate-500 font-normal">V CC méd</span></th>
                  <th className="p-2 border border-slate-300">Tensão Prova (60s)<br/><span className="text-orange-800 font-bold">kV CC</span></th>
                  <th className="p-2 border border-slate-300">Rigidez Dielétrica<br/><span className="text-red-800 font-bold">kV CC</span></th>
                  <th className="p-2 border border-slate-300">Espessura (Tab. 2)<br/><span className="text-slate-500 font-normal">mm (mín - máx)</span></th>
                  <th className="p-2 border border-slate-300">Folga Eletrodo (Clearance)<br/><span className="text-blue-700 font-bold">mm (pol)</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {TABELA_ASTM_D1048.map((entry) => {
                  const isHighlighted = selectedClassInTable === entry.classe;
                  return (
                    <tr
                      key={entry.classe}
                      onClick={() => setSelectedClassInTable(isHighlighted ? null : entry.classe)}
                      className={`cursor-pointer transition-colors text-center ${
                        isHighlighted 
                          ? 'bg-amber-100/80 font-bold ring-2 ring-amber-600 ring-inset' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-2.5 font-bold font-mono text-slate-900 border border-slate-300 bg-slate-50">
                        Classe {entry.classe}
                      </td>
                      <td className="p-2 font-mono border border-slate-300">
                        {(entry.tensaoMaximaUsoAC_kV * 1000).toLocaleString('pt-BR')} V
                      </td>
                      <td className="p-2 font-mono font-bold text-amber-900 border border-slate-300">
                        {entry.tensaoProvaAC_kV} kV
                      </td>
                      <td className="p-2 font-mono font-bold text-indigo-900 border border-slate-300">
                        {entry.tensaoRigidezAC_kV} kV
                      </td>
                      <td className="p-2 font-mono border border-slate-300 bg-orange-50/20">
                        {(entry.tensaoMaximaUsoDC_kV * 1000).toLocaleString('pt-BR')} V
                      </td>
                      <td className="p-2 font-mono font-bold text-orange-900 border border-slate-300 bg-orange-50/20">
                        {entry.tensaoProvaDC_kV} kV
                      </td>
                      <td className="p-2 font-mono font-bold text-red-900 border border-slate-300 bg-orange-50/20">
                        {entry.tensaoRigidezDC_kV} kV
                      </td>
                      <td className="p-2 font-mono border border-slate-300 font-semibold text-slate-800">
                        {entry.espessuraMin_mm} a {entry.espessuraMax_mm} mm
                      </td>
                      <td className="p-2 font-mono border border-slate-300 font-bold text-blue-700">
                        {entry.distanciaBordaEletrodo_pol}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Technical Explanations ASTM D1048 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1.5">
              <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Estilos Construtivos (Styles)
              </h4>
              <ul className="space-y-1 text-[11px] text-slate-700">
                {BLANKET_STYLES_INFO.map(s => (
                  <li key={s.value}><strong>{s.label}:</strong> {s.desc}</li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1.5">
              <h4 className="font-bold text-blue-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Tipos de Elastômero (Types)
              </h4>
              <ul className="space-y-1.5 text-[11px] text-slate-700">
                {BLANKET_TYPES_INFO.map(t => (
                  <li key={t.value}><strong>{t.label}:</strong> {t.desc}</li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1.5">
              <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Critério de Aprovação ASTM D1048
              </h4>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                A manta é considerada <strong>APROVADA</strong> se suportar a tensão de prova especificada durante 60 segundos sem ocorrência de disrupção dielétrica, perfuração mecânica ou centelhamento na folga de borda eletrodo-isolante (Flashover Clearance).
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === 'astm_d178' ? (
        /* ASTM D-178-22 TAPETES ISOLANTES VIEW */
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 font-extrabold text-xs rounded-lg border border-emerald-300">
                  ASTM D178-22 (Vigente)
                </span>
                <span className="text-xs font-bold text-slate-500">• Tapetes Isolantes de Borracha (Rubber Insulating Matting)</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mt-1">
                Tabela 1 e Tabela 2 — Requisitos de Tensão de Prova, Rigidez Dielétrica e Espessura Mínima
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Standard Specification for Rubber Insulating Matting (Aplicação em pisos de subestações e painéis elétricos)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Destacar Classe:</span>
              {(['0', '1', '2', '3', '4'] as DielectricClass[]).map(cl => (
                <button
                  key={cl}
                  onClick={() => setSelectedClassInTable(selectedClassInTable === cl ? null : cl)}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                    selectedClassInTable === cl
                      ? 'bg-emerald-600 text-white shadow-xs scale-105'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Cl {cl}
                </button>
              ))}
            </div>
          </div>

          {/* ASTM D178 Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold text-center">
                  <th rowSpan={2} className="p-2.5 border border-slate-300 bg-slate-200/80">
                    Classe Dielétrica
                  </th>
                  <th colSpan={3} className="p-2 border border-slate-300 bg-emerald-50 text-emerald-950 font-extrabold">
                    Ensaios CA 60 Hz (Tabela 1)
                  </th>
                  <th colSpan={3} className="p-2 border border-slate-300 bg-orange-50 text-orange-950 font-extrabold">
                    Ensaios CC (Tabela 1)
                  </th>
                  <th colSpan={2} className="p-2 border border-slate-300 bg-slate-100 text-slate-900 font-bold">
                    Requisitos Físicos (Tabela 2)
                  </th>
                </tr>
                <tr className="bg-slate-50 text-slate-800 border-b border-slate-300 text-center font-bold text-[11px]">
                  <th className="p-2 border border-slate-300">Tensão Máx. Uso<br/><span className="text-slate-500 font-normal">V CA rms</span></th>
                  <th className="p-2 border border-slate-300">Tensão Prova (60s)<br/><span className="text-emerald-800 font-bold">kV CA</span></th>
                  <th className="p-2 border border-slate-300">Rigidez Dielétrica<br/><span className="text-indigo-800 font-bold">kV CA</span></th>
                  <th className="p-2 border border-slate-300">Tensão Máx. Uso<br/><span className="text-slate-500 font-normal">V CC méd</span></th>
                  <th className="p-2 border border-slate-300">Tensão Prova (60s)<br/><span className="text-orange-800 font-bold">kV CC</span></th>
                  <th className="p-2 border border-slate-300">Rigidez Dielétrica<br/><span className="text-red-800 font-bold">kV CC</span></th>
                  <th className="p-2 border border-slate-300">Espessura Mínima<br/><span className="text-slate-500 font-normal">mm (Tabela 2)</span></th>
                  <th className="p-2 border border-slate-300">Espessura Nominal<br/><span className="text-emerald-700 font-bold">pol (mm)</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {TABELA_ASTM_D178.map((entry) => {
                  const isHighlighted = selectedClassInTable === entry.classe;
                  return (
                    <tr
                      key={entry.classe}
                      onClick={() => setSelectedClassInTable(isHighlighted ? null : entry.classe)}
                      className={`cursor-pointer transition-colors text-center ${
                        isHighlighted 
                          ? 'bg-emerald-100/80 font-bold ring-2 ring-emerald-600 ring-inset' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-2.5 font-bold font-mono text-slate-900 border border-slate-300 bg-slate-50">
                        Classe {entry.classe}
                      </td>
                      <td className="p-2 font-mono border border-slate-300">
                        {(entry.tensaoMaximaUsoAC_kV * 1000).toLocaleString('pt-BR')} V
                      </td>
                      <td className="p-2 font-mono font-bold text-emerald-900 border border-slate-300">
                        {entry.tensaoProvaAC_kV} kV
                      </td>
                      <td className="p-2 font-mono font-bold text-indigo-900 border border-slate-300">
                        {entry.tensaoRigidezAC_kV} kV
                      </td>
                      <td className="p-2 font-mono border border-slate-300 bg-orange-50/20">
                        {(entry.tensaoMaximaUsoDC_kV * 1000).toLocaleString('pt-BR')} V
                      </td>
                      <td className="p-2 font-mono font-bold text-orange-900 border border-slate-300 bg-orange-50/20">
                        {entry.tensaoProvaDC_kV} kV
                      </td>
                      <td className="p-2 font-mono font-bold text-red-900 border border-slate-300 bg-orange-50/20">
                        {entry.tensaoRigidezDC_kV} kV
                      </td>
                      <td className="p-2 font-mono border border-slate-300 font-bold text-slate-900">
                        {entry.espessuraMinima_mm} mm
                      </td>
                      <td className="p-2 font-mono border border-slate-300 font-bold text-emerald-700">
                        {entry.espessuraMinima_pol}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Technical Explanations ASTM D178 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1.5">
              <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Padrões de Superfície (ASTM D178)
              </h4>
              <ul className="space-y-1 text-[11px] text-slate-700">
                {MATTING_SURFACES_INFO.map(s => (
                  <li key={s.value}><strong>{s.label}:</strong> {s.desc}</li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1.5">
              <h4 className="font-bold text-blue-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Método de Ensaio com Eletrodo Contínuo
              </h4>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                Os ensaios em tapetes de borracha devem cobrir 100% da área útil através de eletrodos metálicos planos paralelos ou roletes condutivos em velocidade controlada com aplicação de 60 segundos por seção ensaiada.
              </p>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1.5">
              <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                Critério de Aprovação ASTM D178
              </h4>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                O tapete é considerado <strong>APROVADO</strong> se a espessura medida for igual ou superior ao limite mínimo da Tabela 2 e não ocorrer qualquer disrupção ou perfuração elétrica durante a aplicação da tensão de prova de 60 segundos.
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === 'escadas_normas' ? (
        /* ESCADAS DE MATERIAL ISOLANTE (EN 50528:2024 / NBR IEC 61478 / NBR 16308) DEDICATED VIEW */
        <div className="space-y-6">
          {/* Card: Official Standard Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300">
                    EN 50528:2024 (Vigente / Baixa Tensão)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                    ABNT NBR IEC 61478:2018 (Linha Viva)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                    ABNT NBR 16308:2014
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    NR-10 Homologado
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  Escadas de Material Isolante (PRFV) — Baixa Tensão (EN 50528:2024) e Linha Viva
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-4xl leading-relaxed">
                  Critérios técnicos normativos para ensaios dielétricos periódicos em escadas com montantes isolantes de fibra de vidro (PRFV). A norma <strong className="text-indigo-900">EN 50528:2024</strong> regulamenta escadas portáteis para uso em ou próximo a instalações de Baixa Tensão (≤ 1.000 V CA / 1.500 V CC), elevando a tensão de ensaio para <strong className="text-indigo-900">36 kV CA (60s)</strong> nos montantes e entre degraus, em harmonia com a ABNT NBR IEC 61478 para alta tensão.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    handleOpenCreate();
                    setNormCode('EN 50528:2024');
                    setNormName('Escada Isolante em Fibra de Vidro - Baixa Tensão (36 kV CA)');
                    setEquipmentType('escada_isolada');
                    setDielectricClass('0');
                    setTestVoltage_kV(36);
                    setTestDurationSeconds(60);
                    setMaxLeakageCurrent(0.5);
                    setCurrentUnit('mA');
                    setRetestIntervalMonths(12);
                    setStandardProcedureCode('PR-JVM-LAB-09-BT Rev.01');
                    setDescription('Ensaio dielétrico em montantes e degraus de PRFV com 36 kV CA por 60 segundos com corrente de fuga máx de 0,50 mA conforme EN 50528:2024 Cláusula 5.7 e NR-10.');
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Critério EN 50528:2024 (BT)
                </button>
              </div>
            </div>

            {/* Quick summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <span className="text-[10px] text-indigo-800 font-bold block uppercase tracking-wider">Baixa Tensão (EN 50528)</span>
                <span className="text-sm font-black text-indigo-950 block mt-0.5">36,0 kV CA (60s)</span>
                <span className="text-[10px] text-indigo-700">Fuga máx: ≤ 0,50 mA (500 µA)</span>
              </div>
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-[10px] text-blue-800 font-bold block uppercase tracking-wider">Degraus BT (EN 50528)</span>
                <span className="text-sm font-black text-blue-950 block mt-0.5">36,0 kV CA (60s)</span>
                <span className="text-[10px] text-blue-700">Fuga máx: ≤ 0,30 mA (300 µA)</span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                <span className="text-[10px] text-amber-800 font-bold block uppercase tracking-wider">Linha Viva (NBR IEC 61478)</span>
                <span className="text-sm font-black text-amber-950 block mt-0.5">100,0 kV CA / 300 mm</span>
                <span className="text-[10px] text-amber-700">Fuga máx: ≤ 0,10 mA (100 µA)</span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">Metro Linear (NBR 16308)</span>
                <span className="text-sm font-black text-emerald-950 block mt-0.5">90,0 kV CA (60s)</span>
                <span className="text-[10px] text-emerald-700">Fuga máx: ≤ 0,50 mA (500 µA)</span>
              </div>
            </div>
          </div>

          {/* Interactive Criteria Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-indigo-600" />
                  Tabela Comparativa de Métodos e Critérios de Ensaio Dielétrico para Escadas
                </h4>
                <p className="text-xs text-slate-500">
                  Clique em um método para expandir os requisitos de suportabilidade, cláusulas normativas e instruções de ensaio.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-2.5 px-3">Norma / Edição</th>
                    <th className="py-2.5 px-3">Método / Escopo</th>
                    <th className="py-2.5 px-3 text-center">Tensão de Ensaio</th>
                    <th className="py-2.5 px-3 text-center">Duração</th>
                    <th className="py-2.5 px-3 text-center">Fuga Máx. Seco</th>
                    <th className="py-2.5 px-3 text-center">Fuga Máx. Úmido</th>
                    <th className="py-2.5 px-3 text-center">Periodicidade</th>
                    <th className="py-2.5 px-3">Cláusulas Normativas</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {TABELA_NORMAS_ESCADAS_FIBRA.map((item) => {
                    const isSelected = selectedLadderNormId === item.id;
                    const isEN50528 = item.normCode.includes('EN 50528');
                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          onClick={() => setSelectedLadderNormId(isSelected ? null : item.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected 
                              ? isEN50528 ? 'bg-indigo-50/80 font-medium' : 'bg-blue-50/80 font-medium'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                isEN50528 ? 'bg-indigo-600' : 'bg-blue-600'
                              }`} />
                              <div>
                                <span className={`font-bold block ${isEN50528 ? 'text-indigo-950' : 'text-slate-900'}`}>
                                  {item.normCode}
                                </span>
                                <span className="text-[10px] text-slate-500 block">{item.edition}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800 block">{item.methodLabel}</span>
                            <span className="text-[11px] text-slate-500 block line-clamp-1">{item.normName}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`font-black px-2 py-0.5 rounded border ${
                              isEN50528 
                                ? 'text-indigo-700 bg-indigo-50 border-indigo-200' 
                                : 'text-amber-700 bg-amber-50 border-amber-200'
                            }`}>
                              {item.testVoltageAC_kV.toFixed(1)} kV CA
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-700">
                            {item.testDurationSeconds}s
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              ≤ {item.maxLeakageCurrent_mA.toFixed(2)} mA ({(item.maxLeakageCurrent_mA * 1000).toFixed(0)} µA)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.maxLeakageCurrentWet_mA ? (
                              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                ≤ {item.maxLeakageCurrentWet_mA.toFixed(2)} mA
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {item.retestMonths} meses
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[11px] font-semibold text-slate-700 block">{item.normClauses}</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCreate();
                                setNormCode(item.normCode);
                                setNormName(item.normName);
                                setEquipmentType('escada_isolada');
                                setDielectricClass(isEN50528 ? '0' : 'Geral');
                                setTestVoltage_kV(item.testVoltageAC_kV);
                                setTestDurationSeconds(item.testDurationSeconds);
                                setMaxLeakageCurrent(item.maxLeakageCurrent_mA);
                                setCurrentUnit('mA');
                                setRetestIntervalMonths(item.retestMonths);
                                setStandardProcedureCode(isEN50528 ? 'PR-JVM-LAB-09-BT Rev.01' : 'PR-JVM-LAB-09 Rev.02');
                                setDescription(item.description);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-900 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Usar
                            </button>
                          </td>
                        </tr>

                        {isSelected && (
                          <tr className={isEN50528 ? 'bg-indigo-50/40 border-b border-indigo-200' : 'bg-blue-50/40 border-b border-blue-200'}>
                            <td colSpan={9} className="p-4">
                              <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                    <Info className="w-4 h-4 text-indigo-600" />
                                    Detalhamento Técnico e Critério de Suportabilidade ({item.normCode})
                                  </h5>
                                  <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full">
                                    {item.edition}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Critério de Aprovação / Suportabilidade Dielétrica
                                    </span>
                                    <p className="text-slate-800 text-[11px] leading-relaxed">
                                      {item.withstandRequirement}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Descrição do Procedimento de Ensaio
                                    </span>
                                    <p className="text-slate-800 text-[11px] leading-relaxed">
                                      {item.description}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  <span className="text-[11px] font-bold text-slate-600">Modelos Aplicáveis:</span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {item.applicableLadderTypes.map(t => {
                                      const info = LADDER_TYPES_INFO[t];
                                      return (
                                        <span key={t} className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold text-slate-700 flex items-center gap-1">
                                          {info?.icon || '🪜'} {info?.label || t}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Types and Inspection Guide Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tipos de Escadas Isoladas */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                Modelos de Escadas Isolantes de Fibra de Vidro (PRFV)
              </h4>
              <div className="space-y-2">
                {Object.values(LADDER_TYPES_INFO).map((ladder) => (
                  <div key={ladder.type} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{ladder.icon}</span> {ladder.label}
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        Cap. {ladder.standardCapacityKg} kg
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{ladder.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-semibold mt-1">
                      <span>Degraus: {ladder.commonRungs}</span>
                      <span>Alturas: {ladder.typicalHeights}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Checklist de Inspeção Visual e Mecânica */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Inspeção Visual e Mecânica Obrigatória (EN 50528 / NBR 16308)
              </h4>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-black text-[10px] flex items-center justify-center">1</span>
                    Montantes (Longerons) Isolantes em PRFV
                  </h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                    Superfície lisa sem fissuras, delaminações, fibras de vidro expostas ou desfiadas, queimaduras de arco elétrico ou deformações estruturais.
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-black text-[10px] flex items-center justify-center">2</span>
                    Degraus Estriados Antiderrapantes
                  </h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                    Degraus em alumínio estriado ou PRFV firmemente fixados, sem amassamentos, trincas ou folga rotacional nos pontos de cravamento/rebites.
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-black text-[10px] flex items-center justify-center">3</span>
                    Sapatas Articuladas e Ponteiras de Borracha
                  </h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                    Borracha antiderrapante íntegra, sem desgaste excessivo, ressecamento ou corte, com pinos e buchas de articulação seguros.
                  </p>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-black text-[10px] flex items-center justify-center">4</span>
                    Catracas de Travamento, Corda e Roldana
                  </h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                    Catracas com molas de retenção atuando livremente, engate firme no degrau, corda sem desfiamento e roldana guia desobstruída.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'iec_61243_1' ? (
        /* ABNT NBR IEC 61243-1 DEDICATED VIEW */
        <div className="space-y-6">
          {/* Card: Official Standard Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                    ABNT NBR IEC 61243-1:2020 (Vigente)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                    IEC 61243-1:2009+AMD1:2021
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                    Correlata: IEC 60855-1 / ABNT NBR 16603
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    NR-10 Homologado
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Trabalhos em Linha Viva — Detectores de Tensão Capacitivos (&gt; 1 kV c.a.)
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-4xl leading-relaxed">
                  Critérios técnicos normativos para ensaios periódicos de rigidez dielétrica e corrente de fuga do elemento/haste isolante de prolongamento (100 kV CA / 300 mm), isolamento da carcaça do detector (40 kV / 100 kV CA), tensão limiar de resposta clara (15% a 45% de Un) e autoteste óptico/acústico.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    handleOpenCreate();
                    setNormCode('ABNT NBR IEC 61243-1');
                    setNormName('Detector de Tensão - Ensaio de Isolação e Funcionamento');
                    setEquipmentType('detector_tensao');
                    setTestVoltage_kV(100);
                    setTestDurationSeconds(60);
                    setMaxLeakageCurrent(0.1);
                    setCurrentUnit('mA');
                    setRetestIntervalMonths(12);
                    setStandardProcedureCode('PR-JVM-LAB-10 Rev.03');
                    setDescription('Ensaio de rigidez dielétrica da haste isolante (100 kV/300mm), isolamento da carcaça e verificação de limiar de sensibilidade conforme IEC 61243-1.');
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Critério com este Padrão
                </button>
              </div>
            </div>

            {/* Quick summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                <span className="text-[10px] text-amber-800 font-bold block uppercase tracking-wider">Haste Isolante</span>
                <span className="text-sm font-black text-amber-950 block mt-0.5">100 kV CA / 300 mm</span>
                <span className="text-[10px] text-amber-700">Fuga máx: ≤ 100 µA (0,10 mA)</span>
              </div>
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <span className="text-[10px] text-blue-800 font-bold block uppercase tracking-wider">Carcaça / Cabeçote MT</span>
                <span className="text-sm font-black text-blue-950 block mt-0.5">40,0 kV CA (60s)</span>
                <span className="text-[10px] text-blue-700">Fuga máx: ≤ 0,50 mA (MT 1-36 kV)</span>
              </div>
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                <span className="text-[10px] text-purple-800 font-bold block uppercase tracking-wider">Carcaça / Blindagem AT</span>
                <span className="text-sm font-black text-purple-950 block mt-0.5">100,0 kV CA (60s)</span>
                <span className="text-[10px] text-purple-700">Fuga máx: ≤ 1,00 mA (AT &gt;36 kV)</span>
              </div>
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">Limiar de Atuação</span>
                <span className="text-sm font-black text-emerald-950 block mt-0.5">15% a 45% de Un_mín</span>
                <span className="text-[10px] text-emerald-700">Som ≥ 70 dB(A) + LED Visível</span>
              </div>
            </div>
          </div>

          {/* Interactive Criteria Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-amber-600" />
                  Critérios Oficiais de Ensaio Dielétrico e Funcional (IEC 61243-1)
                </h4>
                <p className="text-xs text-slate-500">
                  Clique em um item da tabela para visualizar o método de ensaio e detalhamento normativo.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="py-2.5 px-3">Item / Componente Ensaiado</th>
                    <th className="py-2.5 px-3">Faixa Nominal</th>
                    <th className="py-2.5 px-3 text-center">Tensão Ensaio</th>
                    <th className="py-2.5 px-3 text-center">Duração</th>
                    <th className="py-2.5 px-3 text-center">Fuga Máx.</th>
                    <th className="py-2.5 px-3 text-center">Limiar / Resposta</th>
                    <th className="py-2.5 px-3 text-center">Nível Sonoro</th>
                    <th className="py-2.5 px-3">Cláusula / Procedimento</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {IEC_61243_1_TABLE.map((item) => {
                    const isSelected = selectedDetectorEntryId === item.id;
                    return (
                      <React.Fragment key={item.id}>
                        <tr 
                          onClick={() => setSelectedDetectorEntryId(isSelected ? null : item.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-amber-50/80 font-medium' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                item.targetComponent === 'haste_isolante' ? 'bg-amber-500' :
                                item.targetComponent === 'carcaca_detector' ? 'bg-blue-500' :
                                item.targetComponent === 'limiar_sensibilidade' ? 'bg-emerald-500' : 'bg-purple-500'
                              }`} />
                              <div>
                                <span className="font-bold text-slate-900 block">{item.testItem}</span>
                                <span className="text-[11px] text-slate-500 block">{item.componentLabel}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {item.nominalRangeLabel}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.testVoltage_kV > 0 ? (
                              <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                {item.testVoltage_kV.toFixed(1)} kV {item.voltageType}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">N/A (Funcional)</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-700">
                            {item.testDurationSeconds}s
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.maxLeakageCurrent_mA > 0 ? (
                              <span className="font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                ≤ {item.maxLeakageCurrent_mA} mA ({item.maxLeakageCurrent_uA} µA)
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.thresholdMinPercent > 0 ? (
                              <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                                {item.thresholdMinPercent}% a {item.thresholdMaxPercent}% Un
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {item.minSoundPressure_dBA > 0 ? (
                              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                                ≥ {item.minSoundPressure_dBA} dB(A)
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[11px] font-semibold text-slate-600 block">{item.normClause}</span>
                            <span className="text-[10px] text-slate-400 block">{item.standardProcedureCode}</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCreate();
                                setNormCode('ABNT NBR IEC 61243-1');
                                setNormName(item.testItem);
                                setEquipmentType('detector_tensao');
                                setTestVoltage_kV(item.testVoltage_kV || 20);
                                setTestDurationSeconds(item.testDurationSeconds || 60);
                                setMaxLeakageCurrent(item.maxLeakageCurrent_mA || 0.5);
                                setCurrentUnit(item.currentUnit);
                                setRetestIntervalMonths(item.retestIntervalMonths);
                                setStandardProcedureCode(item.standardProcedureCode);
                                setDescription(`${item.approvalCriteria} (${item.normClause})`);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 rounded-lg text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Usar
                            </button>
                          </td>
                        </tr>

                        {isSelected && (
                          <tr className="bg-amber-50/40 border-b border-amber-200">
                            <td colSpan={9} className="p-4">
                              <div className="bg-white rounded-xl p-4 border border-amber-200 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h5 className="font-bold text-amber-950 text-xs flex items-center gap-2">
                                    <Info className="w-4 h-4 text-amber-600" />
                                    Detalhamento do Critério Normativo: {item.testItem}
                                  </h5>
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                    {item.normClause}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Critério de Aprovação / Reprovação
                                    </span>
                                    <p className="text-slate-800 text-[11px] leading-relaxed">
                                      {item.approvalCriteria}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                      Instruções de Execução no Laboratório
                                    </span>
                                    <p className="text-slate-800 text-[11px] leading-relaxed">
                                      {item.notes}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Calculator: Threshold Voltage & Non-Actuation Limits */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-600" />
                  Calculadora de Tensão Limiar de Resposta (Cláusula 4.3 da IEC 61243-1)
                </h4>
                <p className="text-xs text-slate-500">
                  Simule a tensão nominal mínima da escala do detector para obter a faixa normativa de atuação e proteção contra tensões induzidas.
                </p>
              </div>

              {/* Quick Voltage Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-bold mr-1">Tensão Nominal (kV):</span>
                {[1.0, 3.8, 13.8, 23.0, 34.5, 69.0, 138.0].map((v) => (
                  <button
                    key={v}
                    onClick={() => setDetectorSimVoltage(v)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                      detectorSimVoltage === v 
                        ? 'bg-amber-600 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {v} kV
                  </button>
                ))}
              </div>
            </div>

            {/* Live calculation results */}
            {(() => {
              const res = calculateIEC61243ThresholdRange(detectorSimVoltage);
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                        Faixa de Atuação Obrigatória
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">
                        15% a 45% de Un_mín
                      </span>
                    </div>
                    <div className="text-lg font-black text-emerald-950 mt-1">
                      {res.minThreshold_kV.toFixed(2)} kV a {res.maxThreshold_kV.toFixed(2)} kV
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-1 leading-tight">
                      O detector DEVE emitir obrigatoriamente alarme acústico e luminoso dentro deste intervalo.
                    </p>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                        Não Atuação Segura (&lt; 10%)
                      </span>
                      <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                        Indução / Ruído
                      </span>
                    </div>
                    <div className="text-lg font-black text-amber-950 mt-1">
                      &lt; {res.nonActuationMax_kV.toFixed(2)} kV
                    </div>
                    <p className="text-[11px] text-amber-700 mt-1 leading-tight">
                      Abaixo deste limite o detector NÃO pode disparar falso alarme por efeito capacitivo ou indução.
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                        Sinalização e Resposta
                      </span>
                      <span className="text-[10px] font-bold bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded">
                        Imediato &lt; 1s
                      </span>
                    </div>
                    <div className="text-lg font-black text-blue-950 mt-1">
                      ≥ 70 dB(A) a 2m
                    </div>
                    <p className="text-[11px] text-blue-700 mt-1 leading-tight">
                      Sinal acústico audível e LED de alta intensidade visível sob iluminação solar direta de 8.000 lux.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Categorias Climáticas e Procedimento de Ensaio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categorias Climáticas */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                Categorias Climáticas de Operação (IEC 61243-1)
              </h4>
              <div className="space-y-2">
                {IEC_61243_CLIMATIC_CATEGORIES.map((cat) => (
                  <div key={cat.code} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900">{cat.name}</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        {cat.temperatureRange}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{cat.description}</p>
                    <span className="text-[10px] text-amber-700 font-semibold block mt-1">Umidade: {cat.humidity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Roteiro Passo a Passo de Ensaio */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Roteiro Sequencial de Ensaio no Laboratório
              </h4>
              <div className="space-y-2">
                {IEC_61243_TEST_STEPS.map((st) => (
                  <div key={st.step} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {st.step}
                    </span>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs">{st.title}</h5>
                      <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">{st.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'nbr_9699_ferramentas' ? (
        /* ABNT NBR 9699 / IEC 60900 DEDICATED VIEW */
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[11px] font-extrabold rounded-lg">
                    NORMA TÉCNICA OFICIAL
                  </span>
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg">
                    ABNT NBR 9699:2022 / IEC 60900:2018
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mt-2 flex items-center gap-2">
                  <Wrench className="w-6 h-6 text-blue-600" />
                  Ferramentas Manuais Isoladas (1.000 V CA / 1.500 V CC)
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                  Critérios técnicos e procedimentos para ensaios dielétricos e inspeção visual de alicates, chaves de fenda, chaves estrela, catracas e soquetes isolados para trabalho em circuitos elétricos energizados de baixa tensão.
                </p>
              </div>

              <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl shrink-0">
                <span className="text-[10px] font-bold text-blue-900 uppercase block tracking-wider">
                  Regra Normativa de Corrente de Fuga
                </span>
                <span className="text-base font-black text-blue-950 block mt-0.5">
                  1,0 mA por ferramenta ensaiada
                </span>
                <span className="text-[11px] text-blue-700 font-medium block">
                  Limite do Lote = Qtd Ferramentas × 1,0 mA
                </span>
              </div>
            </div>

            {/* Norm Parameters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Tensão Máxima de Uso</span>
                <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">1.000 V CA / 1.500 V CC</span>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Símbolo do triângulo duplo 1000V</span>
              </div>

              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Tensão de Prova Dielétrica</span>
                <span className="text-base font-bold text-blue-900 font-mono mt-0.5 block">10.000 V CA (10 kV)</span>
                <span className="text-[11px] text-blue-700 mt-0.5 block">Sob frequência industrial de 60 Hz</span>
              </div>

              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Tempo de Aplicação</span>
                <span className="text-base font-bold text-emerald-900 font-mono mt-0.5 block">180 segundos (3 min)</span>
                <span className="text-[11px] text-emerald-700 mt-0.5 block">Após 24h de condicionamento</span>
              </div>

              <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200">
                <span className="text-[10px] font-bold text-amber-700 uppercase block">Critério de Rigidez</span>
                <span className="text-base font-bold text-amber-900 mt-0.5 block">Zero Perfurações</span>
                <span className="text-[11px] text-amber-700 mt-0.5 block">Sem disrupção ou centelhamento</span>
              </div>
            </div>
          </div>

          {/* Interactive Calculator: Batch Leakage Limit Calculator */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  Simulador Normativo de Limite Máximo de Fuga por Quantidade de Ferramentas
                </h4>
                <p className="text-xs text-slate-500">
                  De acordo com a ABNT NBR 9699 e IEC 60900, o limite máximo aceitável de fuga em ensaio conjunto é a multiplicação direta de 1,0 mA pela quantidade de ferramentas imersas/ensaiadas.
                </p>
              </div>

              {/* Tool quantity quick presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-bold mr-1">Qtd no Lote:</span>
                {[1, 2, 3, 5, 8, 10, 12, 15, 20].map((q) => (
                  <button
                    key={q}
                    onClick={() => setToolSimQuantity(q)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      toolSimQuantity === q 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {q} un
                  </button>
                ))}
              </div>
            </div>

            {/* Calculation output cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                    Quantidade no Ensaio
                  </span>
                  <span className="text-[10px] font-bold bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded">
                    Lote
                  </span>
                </div>
                <div className="text-2xl font-black text-blue-950 mt-1">
                  {toolSimQuantity} ferramenta(s)
                </div>
                <p className="text-[11px] text-blue-700 mt-1 leading-tight">
                  Base de cálculo para o ensaio simultâneo ou individual na cuba de ensaio.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                    Limite Máximo de Fuga
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">
                    Normativo
                  </span>
                </div>
                <div className="text-2xl font-black text-emerald-950 mt-1">
                  {(toolSimQuantity * 1.0).toFixed(1)} mA
                </div>
                <p className="text-[11px] text-emerald-700 mt-1 leading-tight">
                  {toolSimQuantity} × 1,0 mA = {(toolSimQuantity * 1.0).toFixed(1)} mA máx admissível.
                </p>
              </div>

              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider">
                    Pareceres Técnicos
                  </span>
                  <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded">
                    Dois Pareceres
                  </span>
                </div>
                <div className="text-sm font-bold text-purple-950 mt-1">
                  Aprovadas + Reprovadas
                </div>
                <p className="text-[11px] text-purple-700 mt-1 leading-tight">
                  Se houver ferramentas defeituosas no lote, o sistema emite automaticamente dois pareceres técnicos independentes.
                </p>
              </div>
            </div>
          </div>

          {/* Covered Tools Catalog according to NBR 9699 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-600" />
                Catálogo de Ferramentas Manuais Abrangidas (ABNT NBR 9699 / IEC 60900)
              </h4>
              <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2.5 py-1 rounded-lg">
                100% Compatível com Laudo e Certificado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
              {[
                { name: 'Chave Arco Serra com Cabo Isolado', spec: 'Lâmina 12" (300mm) 1000V', tag: 'Corte / Serralheria' },
                { name: 'Chave Isolada Tipo Ajustável', spec: 'Abertura 30mm (8" ou 10")', tag: 'Aperto Regulável' },
                { name: 'Chave Isolada Tipo Allen', spec: 'Hexagonal 3mm a 12mm', tag: 'Parafusos Hexagonais' },
                { name: 'Chave Isolada Tipo Boca', spec: 'Fixa Simples 6mm a 32mm', tag: 'Porcas e Parafusos' },
                { name: 'Chave Isolada Tipo Canhão', spec: 'Sextavada Tubular 5mm a 14mm', tag: 'Porcas em Haste Longa' },
                { name: 'Chave Isolada Tipo Faca', spec: 'Lâmina Reta/Curva Decapadora', tag: 'Decapagem de Condutores' },
                { name: 'Chave Bit para Ferramenta Isolado', spec: 'Porta-Bits Magnético / Jogo', tag: 'Bits Intercambiáveis' },
                { name: 'Detector de Tensão Tipo Caneta', spec: 'Indutivo / Contato 12V-1000V', tag: 'Teste Rápido de Presença' },
                { name: 'Chave de Fenda Isolada', spec: 'Fenda Simples 1000V', tag: 'Parafusos Convencionais' },
                { name: 'Chave Philips / Cruzada', spec: 'PH1, PH2, PH3 1000V', tag: 'Parafusos Cruzados' },
                { name: 'Alicate Universal Isolado', spec: '8 polegadas (200mm)', tag: 'Prensagem e Corte' },
                { name: 'Alicate de Corte Diagonal', spec: '6.1/2 polegadas (165mm)', tag: 'Corte de Condutores' }
              ].map((tool, tIdx) => (
                <div key={tIdx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between text-[10px] text-blue-700 font-bold mb-1">
                    <span>{tool.tag}</span>
                    <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">10 kV / 1 mA</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 leading-snug">{tool.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{tool.spec}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Details & Dual Opinion Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Parecer 1: Ferramentas Aprovadas (Liberação Operacional)
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                As ferramentas que cumprirem integralmente o ensaio dielétrico sob 10.000 V CA por 180s com corrente de fuga controlada (&le; 1,0 mA por ferramenta) e aprovação visual recebem parecer formal de aptidão para trabalho seguro em circuitos energizados até 1.000 V CA / 1.500 V CC (NR-10 Item 10.4).
              </p>
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] text-emerald-900 font-medium">
                ✅ Autorização de emissão de Certificado e Etiqueta de Conformidade Dielétrica com validade de 12 meses.
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Parecer 2: Ferramentas Reprovadas (Segregação e Descarte)
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                As ferramentas que apresentarem perfuração, centelhamento, fuga excessiva ou avarias visuais (trincas na isolação, folgas) recebem parecer técnico específico determinando a segregação imediata e condenação (NR-10 Item 10.4.1).
              </p>
              <div className="p-2.5 bg-red-50 rounded-lg border border-red-200 text-[11px] text-red-900 font-medium">
                ❌ Aplicação de Etiqueta Vermelha de Condenação, proibição de uso e encaminhamento compulsório para descarte.
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CRITÉRIOS CADASTRADOS LIST */
        <>
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por Norma (NBR 16295, IEC 60903, ASTM...), Tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="w-full sm:w-80">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="all">Todos os Equipamentos</option>
                <option value="luva_isolante">🧤 Luvas Isolantes (NBR 16295 Tabela 4)</option>
                <option value="manga_isolante">🛡️ Mangas Isolantes (ABNT NBR 10624 / ASTM D1051)</option>
                <option value="manta_isolante">🟨 Mantas de Cobertura (ASTM D1048)</option>
                <option value="tapete_isolante">🟩 Tapetes Isolantes (ASTM D178-22)</option>
                <option value="bastao_manobra">🦯 Bastões de Manobra (ABNT NBR 16613 / ASTM F711)</option>
                <option value="vara_manobra">🎋 Varas de Manobra (ABNT NBR 16613)</option>
                <option value="capacete_classe_b">⛑️ Capacetes de Segurança Classe B — Classe 2 (ABNT NBR 8221)</option>
                <option value="bota_dielétrica">🥾 Calçados / Botas Dielétricas (ABNT NBR 16603)</option>
                <option value="ferramenta_isolada">🔧 Ferramentas Isoladas (ABNT NBR 9699 / IEC 60900)</option>
                <option value="escada_isolada">🪜 Escadas Isoladas PRFV (ABNT NBR IEC 61478)</option>
                <option value="detector_tensao">⚡ Detectores de Tensão (ABNT NBR IEC 61243-1)</option>
                <option value="ponteira_prova">🔌 Ponteiras de Prova (IEC 61010-031)</option>
                <option value="outro">⚙️ Outros Dispositivos</option>
              </select>
            </div>
          </div>

          {/* Norms Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNorms.map(norm => {
              const isManta = norm.applicableEquipmentTypes?.includes('manta_isolante');
              const isTapete = norm.applicableEquipmentTypes?.includes('tapete_isolante');
              const astmManta = isManta ? getASTMD1048Entry(norm.dielectricClass) : null;
              const astmTapete = isTapete ? getASTMD178Entry(norm.dielectricClass) : null;

              return (
                <div key={norm.id} className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                  isManta 
                    ? 'border-amber-200 hover:border-amber-400 hover:shadow-amber-50/50' 
                    : isTapete 
                    ? 'border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-50/50' 
                    : 'border-slate-200 hover:border-blue-300'
                }`}>
                  <div>
                    <div className="flex items-start justify-between">
                      <span className={`font-extrabold font-mono text-xs px-2 py-1 rounded-md border ${
                        isManta
                          ? 'text-amber-800 bg-amber-50 border-amber-300'
                          : isTapete
                          ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
                          : 'text-blue-700 bg-blue-50 border-blue-200'
                      }`}>
                        {norm.normCode}
                      </span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                        isManta
                          ? 'text-amber-900 bg-amber-100'
                          : isTapete
                          ? 'text-emerald-900 bg-emerald-100'
                          : 'text-slate-800 bg-slate-100'
                      }`}>
                        Classe {norm.dielectricClass}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm mt-3">{norm.normName}</h3>
                    <p className={`text-xs font-bold uppercase mt-0.5 ${
                      isManta ? 'text-amber-700' : isTapete ? 'text-emerald-700' : 'text-slate-500'
                    }`}>
                      {norm.applicableEquipmentTypes?.map(t => String(t).replace('_', ' ')).join(', ')}
                    </p>

                    {/* Technical Parameters Table */}
                    <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tensão de Ensaio:</span>
                        <span className="font-bold font-mono text-slate-900">{norm.testVoltage_kV} kV {norm.voltageType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tempo de Aplicação:</span>
                        <span className="font-bold font-mono text-slate-900">{norm.testDurationSeconds} segundos</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Limite de Fuga Base:</span>
                        <span className="font-bold font-mono text-blue-700">{norm.maxLeakageCurrent} {norm.currentUnit}</span>
                      </div>

                      {/* Manta Specific Info */}
                      {astmManta && (
                        <div className="pt-1.5 border-t border-amber-200 space-y-1 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-amber-900 font-medium">Folga Eletrodo (Clearance):</span>
                            <span className="font-bold font-mono text-blue-700">{astmManta.distanciaBordaEletrodo_mm} mm ({astmManta.distanciaBordaEletrodo_pol})</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-900 font-medium">Espessura (Tab. 2):</span>
                            <span className="font-bold font-mono text-slate-900">{astmManta.espessuraMin_mm} a {astmManta.espessuraMax_mm} mm</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-900 font-medium">Tensão Prova CC:</span>
                            <span className="font-bold font-mono text-orange-800">{astmManta.tensaoProvaDC_kV} kV CC</span>
                          </div>
                        </div>
                      )}

                      {/* Tapete Specific Info */}
                      {astmTapete && (
                        <div className="pt-1.5 border-t border-emerald-200 space-y-1 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-emerald-900 font-medium">Espessura Mínima (Tab. 2):</span>
                            <span className="font-bold font-mono text-emerald-800">{astmTapete.espessuraMinima_mm} mm ({astmTapete.espessuraMinima_pol})</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-900 font-medium">Tensão Prova CC:</span>
                            <span className="font-bold font-mono text-orange-800">{astmTapete.tensaoProvaDC_kV} kV CC</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-900 font-medium">Rigidez Breakdown:</span>
                            <span className="font-bold font-mono text-indigo-900">{astmTapete.tensaoRigidezAC_kV} kV CA</span>
                          </div>
                        </div>
                      )}

                      {norm.gloveLengthLimits && (
                        <div className="pt-1.5 border-t border-slate-200">
                          <span className="text-[10px] text-slate-500 font-semibold block mb-1">
                            Limites Tabela 4 por Comprimento:
                          </span>
                          <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-center">
                            <div className="bg-white p-1 rounded border border-slate-200">
                              <span className="text-slate-400 block">280mm</span>
                              <span className="font-bold">{norm.gloveLengthLimits[280] !== null ? `${norm.gloveLengthLimits[280]}mA` : 'N/a'}</span>
                            </div>
                            <div className="bg-white p-1 rounded border border-slate-200">
                              <span className="text-slate-400 block">360mm</span>
                              <span className="font-bold">{norm.gloveLengthLimits[360] !== null ? `${norm.gloveLengthLimits[360]}mA` : 'N/a'}</span>
                            </div>
                            <div className="bg-white p-1 rounded border border-slate-200">
                              <span className="text-slate-400 block">410mm</span>
                              <span className="font-bold">{norm.gloveLengthLimits[410] !== null ? `${norm.gloveLengthLimits[410]}mA` : 'N/a'}</span>
                            </div>
                            <div className="bg-white p-1 rounded border border-slate-200">
                              <span className="text-slate-400 block">≥460mm</span>
                              <span className="font-bold">{norm.gloveLengthLimits[460] !== null ? `${norm.gloveLengthLimits[460]}mA` : 'N/a'}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between pt-1 border-t border-slate-200">
                        <span className="text-slate-500">Periodicidade Reensaio:</span>
                        <span className="font-bold text-emerald-700">{norm.defaultRetestMonths || 6} meses</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">Edição: {norm.editionOrVersion || '2023'}</span>
                    <button
                      onClick={() => handleOpenEdit(norm)}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Editar Parâmetros
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* MODAL: Configure Norm Criteria */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-[#0A2540] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base">
                  {editingNorm ? 'Editar Parâmetros Normativos' : 'Cadastrar Novo Critério Técnico'}
                </h3>
                <p className="text-xs text-blue-200">ABNT NBR / ASTM / IEC - Ensaio Dielétrico</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNorm} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de EPI / EPC *</label>
                  <select
                    value={equipmentType}
                    onChange={(e) => {
                      const t = e.target.value as EquipmentType;
                      setEquipmentType(t);
                      let targetClass = dielectricClass;
                      if (t === 'capacete_classe_b') {
                        targetClass = '2';
                        setDielectricClass('2');
                      }
                      applyEquipmentPreset(t, targetClass);
                    }}
                    className="w-full p-2 border border-blue-400 bg-blue-50/40 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="luva_isolante">🧤 Luvas Isolantes de Borracha (NBR 16295 Tabela 4)</option>
                    <option value="manga_isolante">🛡️ Mangas Isolantes de Borracha (ABNT NBR 10624 / ASTM D1051)</option>
                    <option value="manta_isolante">🟨 Mantas de Cobertura Isolantes (ASTM D1048)</option>
                    <option value="tapete_isolante">🟩 Tapetes Isolantes de Borracha (ASTM D178-22)</option>
                    <option value="bastao_manobra">🦯 Bastões de Manobra e Salvamento (ABNT NBR 16613 / ASTM F711)</option>
                    <option value="vara_manobra">🎋 Varas de Manobra Telescópicas / Seccionáveis (ABNT NBR 16613)</option>
                    <option value="capacete_classe_b">⛑️ Capacetes de Segurança Classe B — Classe 2 (ABNT NBR 8221 / ANSI Z89.1)</option>
                    <option value="bota_dielétrica">🥾 Calçados / Botas Dielétricas (ABNT NBR 16603 / ASTM F2413)</option>
                    <option value="ferramenta_isolada">🔧 Ferramentas Manuais Isoladas 1000V (ABNT NBR 9699 / IEC 60900)</option>
                    <option value="escada_isolada">🪜 Escadas Isoladas de Fibra de Vidro (ABNT NBR IEC 61478 / NBR 16308)</option>
                    <option value="detector_tensao">⚡ Detectores de Tensão (ABNT NBR IEC 61243-1)</option>
                    <option value="ponteira_prova">🔌 Ponteiras de Prova e Cabos de Ensaio (IEC 61010-031)</option>
                    <option value="outro">⚙️ Outros Dispositivos Dielétricos (NR-10 / Esp. Técnica)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Código da Norma Técnica *</label>
                    <span className="text-[10px] text-blue-700 bg-blue-100 font-semibold px-1.5 py-0.5 rounded">
                      ⚡ Preenchimento Automático
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ex: NBR 16295 Tabela 4"
                    value={normCode}
                    onChange={(e) => setNormCode(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Título / Descrição da Norma *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Luvas de Material Isolante"
                    value={normName}
                    onChange={(e) => setNormName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Classe Dielétrica *</label>
                  <select
                    value={dielectricClass}
                    onChange={(e) => {
                      const cl = e.target.value as DielectricClass;
                      setDielectricClass(cl);
                      applyEquipmentPreset(equipmentType, cl);
                    }}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="00">Classe 00 (500V CA / 750V CC)</option>
                    <option value="0">Classe 0 (1.000V CA / 1.500V CC)</option>
                    <option value="1">Classe 1 (7.500V CA / 11.250V CC)</option>
                    <option value="2">Classe 2 (17.000V CA / 25.500V CC)</option>
                    <option value="3">Classe 3 (26.500V CA / 39.750V CC)</option>
                    <option value="4">Classe 4 (36.000V CA / 54.000V CC)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tensão de Ensaio (kV) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={testVoltage_kV}
                    onChange={(e) => setTestVoltage_kV(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Tensão *</label>
                  <select
                    value={voltageType}
                    onChange={(e) => setVoltageType(e.target.value as 'AC' | 'DC')}
                    className="w-full p-2 border border-slate-300 rounded-xl font-semibold"
                  >
                    <option value="AC">CA (Corrente Alternada 60Hz)</option>
                    <option value="DC">CC (Corrente Contínua)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duração da Aplicação (s) *</label>
                  <input
                    type="number"
                    required
                    value={testDurationSeconds}
                    onChange={(e) => setTestDurationSeconds(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Limite Máximo de Fuga (mA/uA) *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={maxLeakageCurrent}
                      onChange={(e) => setMaxLeakageCurrent(Number(e.target.value))}
                      className="flex-1 p-2 border border-slate-300 rounded-xl font-bold text-blue-700"
                    />
                    <select
                      value={currentUnit}
                      onChange={(e) => setCurrentUnit(e.target.value as any)}
                      className="w-20 p-2 border border-slate-300 rounded-xl"
                    >
                      <option value="mA">mA</option>
                      <option value="uA">uA</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Periodicidade de Reensaio (Meses) *</label>
                  <input
                    type="number"
                    required
                    value={retestIntervalMonths}
                    onChange={(e) => setRetestIntervalMonths(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código do Procedimento Operacional</label>
                  <input
                    type="text"
                    value={standardProcedureCode}
                    onChange={(e) => setStandardProcedureCode(e.target.value)}
                    placeholder="Ex: PR-JVM-LAB-01"
                    className="w-full p-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observações / Notas Normativas</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Ensaio dielétrico em cuba com água conforme NBR 16295 Tabela 4..."
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <div>
                  {editingNorm && (
                    !isDeleting ? (
                      <button
                        type="button"
                        onClick={() => setIsDeleting(true)}
                        className="px-3.5 py-2 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 border border-red-200 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir Critério Normativo
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 p-1.5 bg-red-50 border border-red-200 rounded-xl">
                        <span className="text-[11px] font-bold text-red-800 pl-1">Confirmar exclusão?</span>
                        <button
                          type="button"
                          onClick={handleDeleteNorm}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs shadow-xs"
                        >
                          Sim, Excluir
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDeleting(false)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setIsDeleting(false);
                    }}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-sm transition-colors"
                  >
                    Salvar Critério Normativo
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
