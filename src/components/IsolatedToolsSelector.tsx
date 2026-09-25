import React from 'react';
import { 
  Wrench, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  Layers, 
  Hash, 
  Building2, 
  Info,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Eye,
  Check,
  X
} from 'lucide-react';
import { IsolatedToolItem } from '../types';

interface IsolatedToolsSelectorProps {
  tools: IsolatedToolItem[];
  onChange: (tools: IsolatedToolItem[]) => void;
  defaultManufacturer?: string;
  readOnly?: boolean;
  showEvaluationControls?: boolean;
}

export const TOOL_PRESETS: Array<{
  type: IsolatedToolItem['toolType'];
  name: string;
  defaultSpec: string;
  defaultQty: number;
}> = [
  { type: 'arco_serra_isolado', name: 'Chave Arco Serra com Cabo Isolado', defaultSpec: 'Lâmina 12" (300mm) Cabo Isolado 1000V', defaultQty: 1 },
  { type: 'chave_ajustavel', name: 'Chave Isolada Tipo Ajustável', defaultSpec: 'Abertura 30mm (8" ou 10") 1000V', defaultQty: 1 },
  { type: 'chave_allen', name: 'Chave Isolada Tipo Allen', defaultSpec: 'Hexagonal 3mm a 12mm 1000V', defaultQty: 1 },
  { type: 'chave_boca', name: 'Chave Isolada Tipo Boca', defaultSpec: 'Fixa Simples 6mm a 32mm 1000V', defaultQty: 1 },
  { type: 'chave_canhao', name: 'Chave Isolada Tipo Canhão', defaultSpec: 'Sextavada Tubular 5mm a 14mm 1000V', defaultQty: 1 },
  { type: 'faca_isolada', name: 'Chave Isolada Tipo Faca', defaultSpec: 'Lâmina Reta/Curva Decapadora 1000V', defaultQty: 1 },
  { type: 'chave_bit_isolado', name: 'Chave Bit para Ferramenta Isolado', defaultSpec: 'Porta-Bits Magnético / Bits 1000V', defaultQty: 1 },
  { type: 'detector_tensao_caneta', name: 'Detector de Tensão Tipo Caneta', defaultSpec: 'Detecção por Indução/Contato 12V-1000V CAT IV', defaultQty: 1 },
  { type: 'chave_fenda', name: 'Chave de Fenda Isolada 1000V', defaultSpec: '1/4 x 6" (6x150mm)', defaultQty: 1 },
  { type: 'chave_philips', name: 'Chave Philips / Cruzada Isolada 1000V', defaultSpec: 'PH2 x 6" (6x150mm)', defaultQty: 1 },
  { type: 'alicate_universal', name: 'Alicate Universal Isolado 1000V', defaultSpec: '8 polegadas (200mm)', defaultQty: 1 },
  { type: 'alicate_corte', name: 'Alicate de Corte Diagonal Isolado 1000V', defaultSpec: '6.1/2 polegadas (165mm)', defaultQty: 1 },
  { type: 'alicate_bico', name: 'Alicate de Bico Meia-Cana Isolado 1000V', defaultSpec: '6.1/2 polegadas (165mm)', defaultQty: 1 },
  { type: 'chave_inglesa', name: 'Chave Inglesa Ajustável Isolada 1000V', defaultSpec: '10 polegadas (250mm)', defaultQty: 1 },
  { type: 'chave_estrela_boca', name: 'Chave Estrela / Fixa Combinada Isolada 1000V', defaultSpec: '13mm a 19mm', defaultQty: 1 },
  { type: 'outro', name: 'Outra Ferramenta Manual Isolada 1000V', defaultSpec: 'Isolamento 1000V NBR 9699', defaultQty: 1 }
];

export const COMMON_MANUFACTURERS = [
  'Gedore',
  'Tramontina PRO',
  'Belzer',
  'Klein Tools',
  'Knipex VDE',
  'Sata',
  'Bahco',
  'Robust',
  'Wiha'
];

export const COMMON_DEFECT_REASONS = [
  'Trinca / Fissura na camada isolante',
  'Furo ou corte na capa plástica/borracha',
  'Desgaste severo na empunhadura',
  'Disrupção / Perfuração dielétrica no ensaio 10kV',
  'Quebra ou ausência de batente de proteção',
  'Corrente de fuga excessiva (> limite normativo)',
  'Descascamento da isolação de proteção'
];

export const IsolatedToolsSelector: React.FC<IsolatedToolsSelectorProps> = ({
  tools,
  onChange,
  defaultManufacturer = 'Gedore',
  readOnly = false,
  showEvaluationControls = true
}) => {
  const handleAddTool = (presetIndex: number = 0) => {
    const preset = TOOL_PRESETS[presetIndex];
    const newTool: IsolatedToolItem = {
      id: 'tool-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      toolType: preset.type,
      toolName: preset.name,
      quantity: preset.defaultQty,
      manufacturer: defaultManufacturer || 'Gedore',
      sizeOrSpec: preset.defaultSpec,
      nominalVoltage: '1.000 Vca / 1.500 Vcc (NBR 9699 / IEC 60900)',
      result: 'APROVADO',
      visualInspection: 'conforme',
      dielectricResult: 'conforme'
    };
    onChange([...tools, newTool]);
  };

  const handleAddDefaultKit = () => {
    const kit: IsolatedToolItem[] = [
      {
        id: 'tool-fenda-' + Date.now(),
        toolType: 'chave_fenda',
        toolName: 'Chave de Fenda Isolada 1000V',
        quantity: 1,
        manufacturer: defaultManufacturer || 'Gedore',
        sizeOrSpec: '1/4 x 6" (6x150mm)',
        nominalVoltage: '1.000 Vca / 1.500 Vcc',
        result: 'APROVADO',
        visualInspection: 'conforme',
        dielectricResult: 'conforme'
      },
      {
        id: 'tool-philips-' + Date.now() + 1,
        toolType: 'chave_philips',
        toolName: 'Chave Philips / Cruzada Isolada 1000V',
        quantity: 1,
        manufacturer: defaultManufacturer || 'Gedore',
        sizeOrSpec: 'PH2 x 6" (6x150mm)',
        nominalVoltage: '1.000 Vca / 1.500 Vcc',
        result: 'APROVADO',
        visualInspection: 'conforme',
        dielectricResult: 'conforme'
      },
      {
        id: 'tool-universal-' + Date.now() + 2,
        toolType: 'alicate_universal',
        toolName: 'Alicate Universal Isolado 1000V',
        quantity: 1,
        manufacturer: defaultManufacturer || 'Gedore',
        sizeOrSpec: '8 polegadas (200mm)',
        nominalVoltage: '1.000 Vca / 1.500 Vcc',
        result: 'APROVADO',
        visualInspection: 'conforme',
        dielectricResult: 'conforme'
      },
      {
        id: 'tool-corte-' + Date.now() + 3,
        toolType: 'alicate_corte',
        toolName: 'Alicate de Corte Diagonal Isolado 1000V',
        quantity: 1,
        manufacturer: defaultManufacturer || 'Gedore',
        sizeOrSpec: '6.1/2 polegadas (165mm)',
        nominalVoltage: '1.000 Vca / 1.500 Vcc',
        result: 'APROVADO',
        visualInspection: 'conforme',
        dielectricResult: 'conforme'
      },
      {
        id: 'tool-bico-' + Date.now() + 4,
        toolType: 'alicate_bico',
        toolName: 'Alicate de Bico Meia-Cana Isolado 1000V',
        quantity: 1,
        manufacturer: defaultManufacturer || 'Gedore',
        sizeOrSpec: '6.1/2 polegadas (165mm)',
        nominalVoltage: '1.000 Vca / 1.500 Vcc',
        result: 'APROVADO',
        visualInspection: 'conforme',
        dielectricResult: 'conforme'
      }
    ];
    onChange([...tools, ...kit]);
  };

  const handleUpdateTool = (id: string, updates: Partial<IsolatedToolItem>) => {
    onChange(tools.map(t => {
      if (t.id === id) {
        // If type changed, update default name
        let modified = { ...t, ...updates };
        if (updates.toolType && updates.toolType !== t.toolType) {
          const match = TOOL_PRESETS.find(p => p.type === updates.toolType);
          modified = {
            ...modified,
            toolName: match ? match.name : t.toolName,
            sizeOrSpec: updates.sizeOrSpec !== undefined ? updates.sizeOrSpec : (match ? match.defaultSpec : t.sizeOrSpec)
          };
        }

        // Auto sync result if visual or dielectric failed
        if (updates.visualInspection === 'nao_conforme' || updates.dielectricResult === 'nao_conforme') {
          modified.result = 'REPROVADO';
          if (!modified.defectReason) {
            modified.defectReason = updates.visualInspection === 'nao_conforme'
              ? 'Trinca / Fissura na camada isolante'
              : 'Disrupção / Perfuração dielétrica no ensaio 10kV';
          }
        } else if (updates.result === 'APROVADO') {
          modified.visualInspection = 'conforme';
          modified.dielectricResult = 'conforme';
          modified.defectReason = undefined;
        } else if (updates.result === 'REPROVADO' && !modified.defectReason) {
          modified.defectReason = 'Trinca / Fissura na camada isolante';
        }

        return modified;
      }
      return t;
    }));
  };

  const handleRemoveTool = (id: string) => {
    onChange(tools.filter(t => t.id !== id));
  };

  // Batch evaluation actions
  const handleApproveAll = () => {
    onChange(tools.map(t => ({
      ...t,
      result: 'APROVADO',
      visualInspection: 'conforme',
      dielectricResult: 'conforme',
      defectReason: undefined
    })));
  };

  const handleReproveAll = () => {
    onChange(tools.map(t => ({
      ...t,
      result: 'REPROVADO',
      visualInspection: 'nao_conforme',
      dielectricResult: 'nao_conforme',
      defectReason: t.defectReason || 'Não atendeu aos requisitos normativos NBR 9699'
    })));
  };

  const totalToolsCount = tools.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const approvedCount = tools.filter(t => (t.result || 'APROVADO') === 'APROVADO').length;
  const reprovedCount = tools.filter(t => t.result === 'REPROVADO').length;

  return (
    <div className="bg-orange-50/40 border-2 border-orange-200 rounded-2xl p-4 space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-orange-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
              Composição & Avaliação Individual das Ferramentas Isoladas
              <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full font-extrabold border border-orange-300">
                NBR 9699 / IEC 60900 (1000V)
              </span>
            </h4>
            <p className="text-[11px] text-slate-600">
              Permite inspecionar, aprovar ou reprovar individualmente cada ferramenta manual do lote
            </p>
          </div>
        </div>

        {/* Evaluation Summary Chips */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center text-xs font-bold">
          <span className="bg-white px-2.5 py-1 rounded-lg border border-orange-200 shadow-2xs text-slate-700">
            Total: <strong className="text-orange-600 font-mono">{totalToolsCount}</strong> peça(s)
          </span>

          <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{approvedCount} Aprovada(s)</span>
          </span>

          {reprovedCount > 0 && (
            <span className="bg-red-50 text-red-800 border border-red-300 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs animate-pulse">
              <XCircle className="w-3.5 h-3.5 text-red-600" />
              <span>{reprovedCount} Reprovada(s)</span>
            </span>
          )}
        </div>
      </div>

      {/* Batch Actions & Quick Add Buttons */}
      {!readOnly && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-orange-200">
            <span className="text-[11px] font-bold text-slate-700">Ações Rápidas de Avaliação Individual:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleApproveAll}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-2xs active:scale-98"
              >
                <Check className="w-3.5 h-3.5" /> Aprovar Todas ({tools.length})
              </button>

              <button
                type="button"
                onClick={handleReproveAll}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-2xs active:scale-98"
              >
                <X className="w-3.5 h-3.5" /> Reprovar Todas
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-700 block">Adicionar Ferramentas Manuais ao Lote:</span>
              <div className="flex items-center gap-2">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value !== '') {
                      const idx = parseInt(e.target.value, 10);
                      handleAddTool(idx);
                      e.target.value = '';
                    }
                  }}
                  className="p-1.5 bg-white border border-orange-300 rounded-lg text-xs font-bold text-orange-950 shadow-2xs cursor-pointer hover:bg-orange-50/50"
                >
                  <option value="" disabled>➕ Escolher e Adicionar Ferramenta...</option>
                  {TOOL_PRESETS.map((preset, pIdx) => (
                    <option key={pIdx} value={pIdx}>
                      {preset.name} ({preset.defaultSpec})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleAddDefaultKit}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-2xs shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Kit Padrão (5 peças)
                </button>
              </div>
            </div>

            {/* Quick Add Chips for All Requested & Standard Tools */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {TOOL_PRESETS.map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => handleAddTool(pIdx)}
                  className="px-2.5 py-1 bg-white hover:bg-orange-100 hover:text-orange-950 border border-orange-300 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all shadow-2xs"
                  title={`Adicionar ${preset.name} (${preset.defaultSpec})`}
                >
                  <Plus className="w-3 h-3 text-orange-600" />
                  <span>{preset.name.replace(' 1000V', '').replace('Chave ', '').replace('Isolada ', '')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tools List with Individual Approval Controls */}
      <div className="space-y-3">
        {tools.length === 0 ? (
          <div className="bg-white border border-dashed border-orange-300 rounded-xl p-5 text-center space-y-2">
            <Wrench className="w-6 h-6 text-orange-400 mx-auto" />
            <p className="text-xs font-bold text-slate-700">Nenhuma ferramenta manual isolada adicionada ao lote ainda.</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Utilize o seletor ou os botões de atalho acima para incluir chaves de fenda, philips, allen, boca, canhão, ajustável, arco de serra, faca, chave bit, detector de tensão caneta e alicates.
            </p>
            {!readOnly && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleAddDefaultKit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Adicionar Kit Padrão (5 peças)
                </button>
                <button
                  type="button"
                  onClick={() => handleAddTool(0)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-300"
                >
                  <Plus className="w-3.5 h-3.5 text-orange-600" /> Adicionar Arco de Serra
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tools.map((item, idx) => {
              const isApproved = (item.result || 'APROVADO') === 'APROVADO';
              return (
                <div 
                  key={item.id || idx}
                  className={`bg-white rounded-xl p-3.5 shadow-xs border-2 transition-all space-y-2.5 ${
                    isApproved 
                      ? 'border-emerald-300 hover:border-emerald-400 bg-emerald-50/10' 
                      : 'border-red-400 bg-red-50/20'
                  }`}
                >
                  {/* Row 1: Tool Details + Status Selector */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                    {/* Identification & Specification */}
                    <div className="flex items-center gap-2 flex-1">
                      <span className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 ${
                        isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {idx + 1}
                      </span>

                      {!readOnly ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                          <select
                            value={item.toolType}
                            onChange={(e) => handleUpdateTool(item.id, { toolType: e.target.value as any })}
                            className="p-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-slate-50/60"
                          >
                            <option value="arco_serra_isolado">Arco de Serra com Cabo Isolado</option>
                            <option value="chave_ajustavel">Chave Isolada Tipo Ajustável</option>
                            <option value="chave_allen">Chave Isolada Tipo Allen</option>
                            <option value="chave_boca">Chave Isolada Tipo Boca</option>
                            <option value="chave_canhao">Chave Isolada Tipo Canhão</option>
                            <option value="faca_isolada">Chave Isolada Tipo Faca</option>
                            <option value="chave_bit_isolado">Chave Bit para Ferramenta Isolado</option>
                            <option value="detector_tensao_caneta">Detector de Tensão Tipo Caneta</option>
                            <option value="chave_fenda">Chave de Fenda Isolada</option>
                            <option value="chave_philips">Chave Philips / Cruzada</option>
                            <option value="alicate_universal">Alicate Universal Isolado</option>
                            <option value="alicate_corte">Alicate de Corte Diagonal</option>
                            <option value="alicate_bico">Alicate de Bico Meia-Cana</option>
                            <option value="chave_inglesa">Chave Inglesa Isolada</option>
                            <option value="chave_estrela_boca">Chave Estrela / Boca Combinada</option>
                            <option value="outro">Outra Ferramenta Manual</option>
                          </select>

                          <input
                            type="text"
                            value={item.toolName}
                            onChange={(e) => handleUpdateTool(item.id, { toolName: e.target.value })}
                            placeholder="Descrição da Ferramenta"
                            className="p-1.5 border border-slate-300 rounded-lg text-xs font-medium"
                          />

                          <input
                            type="text"
                            value={item.sizeOrSpec || ''}
                            onChange={(e) => handleUpdateTool(item.id, { sizeOrSpec: e.target.value })}
                            placeholder="Tamanho / Medida (Ex: 8 pol, PH2x6)"
                            className="p-1.5 border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                      ) : (
                        <div>
                          <span className="font-bold text-slate-900 block text-xs">{item.toolName}</span>
                          <span className="text-[11px] text-slate-500">{item.sizeOrSpec || '1000V'} • {item.manufacturer}</span>
                        </div>
                      )}
                    </div>

                    {/* Quantity & Manufacturer */}
                    {!readOnly && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-500">Qtd:</span>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={item.quantity}
                            onChange={(e) => handleUpdateTool(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-12 p-1.5 border border-slate-300 rounded-lg text-xs font-bold font-mono text-center"
                          />
                        </div>

                        <div className="flex items-center gap-1 w-32">
                          <input
                            type="text"
                            value={item.manufacturer}
                            onChange={(e) => handleUpdateTool(item.id, { manufacturer: e.target.value })}
                            placeholder="Fabricante"
                            className="w-full p-1.5 border border-slate-300 rounded-lg text-xs font-medium"
                            list={`manuf-list-${item.id}`}
                          />
                          <datalist id={`manuf-list-${item.id}`}>
                            {COMMON_MANUFACTURERS.map(m => (
                              <option key={m} value={m} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                    )}

                    {/* INDIVIDUAL APPROVAL / REPROVAL TOGGLE BUTTONS */}
                    {showEvaluationControls && !readOnly && (
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => handleUpdateTool(item.id, { 
                            result: 'APROVADO',
                            visualInspection: 'conforme',
                            dielectricResult: 'conforme',
                            defectReason: undefined
                          })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                            isApproved
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>APROVADO</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateTool(item.id, { 
                            result: 'REPROVADO',
                            visualInspection: 'nao_conforme',
                            dielectricResult: 'nao_conforme',
                            defectReason: item.defectReason || 'Trinca / Fissura na camada isolante'
                          })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                            !isApproved
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-red-700 hover:bg-red-50'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>REPROVADO</span>
                        </button>
                      </div>
                    )}

                    {/* ReadOnly Status Badge */}
                    {readOnly && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                        isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {isApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {item.result || 'APROVADO'}
                      </span>
                    )}

                    {/* Delete button */}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTool(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        title="Remover ferramenta do lote"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Row 2: Inspections Details & Defect Reason (Shown if Reproved or Details toggled) */}
                  {(!isApproved || item.defectReason) && (
                    <div className="bg-red-50/80 border border-red-200 rounded-lg p-2.5 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-red-900">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        <span>Motivo da Não Conformidade / Reprovação desta Ferramenta:</span>
                      </div>

                      {!readOnly ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <select
                              value={item.defectReason || ''}
                              onChange={(e) => handleUpdateTool(item.id, { defectReason: e.target.value })}
                              className="w-full p-1.5 border border-red-300 rounded-lg text-xs font-semibold bg-white text-red-900"
                            >
                              <option value="">Selecione o defeito identificado...</option>
                              {COMMON_DEFECT_REASONS.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                              <option value="Outro motivo técnico">Outro defeito específico</option>
                            </select>
                          </div>

                          <div>
                            <input
                              type="text"
                              value={item.defectReason || ''}
                              onChange={(e) => handleUpdateTool(item.id, { defectReason: e.target.value })}
                              placeholder="Ou digite o motivo da reprovação individual..."
                              className="w-full p-1.5 border border-red-300 rounded-lg text-xs bg-white text-red-900 font-medium"
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs font-semibold text-red-800">
                          {item.defectReason || 'Não atendeu aos critérios de isolamento e rigidez dielétrica NBR 9699.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Norm Compliance Note */}
      <div className="flex items-start gap-2 bg-orange-100/50 p-2.5 rounded-xl border border-orange-200 text-[11px] text-orange-900">
        <Info className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
        <p>
          Conforme a norma <strong>NBR 9699 / IEC 60900</strong> (Ferramentas Manuais para Trabalhos em Tensão até 1000V CA e 1500V CC), cada ferramenta deve apresentar camada isolante contínua, sem fissuras ou descontinuidades, submetida ao ensaio dielétrico de rigidez com tensão de prova normativa de 10,0 kV CA. As ferramentas reprovadas devem ser imediatamente segregadas e descartadas.
        </p>
      </div>
    </div>
  );
};
