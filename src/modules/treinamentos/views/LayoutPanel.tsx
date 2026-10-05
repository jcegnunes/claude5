/**
 * Configuração do layout do certificado de treinamento: logo, textos,
 * assinaturas, cores e verso, com pré-visualização do PDF.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Type, PenLine, Palette, FileText, RotateCcw, Save, Loader2, Eye } from 'lucide-react';
import { DielectricStorageService } from '../../../services/syncEngine';
import {
  DEFAULT_LAYOUT, TEMPLATE_FIELDS, getTrainingLayout, normalizeLayout, saveTrainingLayout, type TrainingCertificateLayout
} from '../layout';
import { getCourses, getInstructors } from '../repository';
import { canManageSigningCerts } from '../signingCerts';
import { computeExpiryDate, todayIso } from '../rules';
import type { TrainingCertificate } from '../types';
import { alertError, btnPrimary, btnSecondary, cardCls, Field, inputCls } from './ui';

/** Reduz a imagem do logo (mantém PNG para preservar o fundo transparente). */
async function readLogo(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
    i.src = dataUrl;
  });
  for (const max of [900, 600, 400]) {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/png');
    if (out.length < 450_000 || max === 400) return out;
  }
  return dataUrl;
}

/** Certificado de exemplo para a pré-visualização (dados reais de curso e instrutores, se houver). */
function sampleCertificate(): TrainingCertificate {
  const company = DielectricStorageService.getCompanyInfo();
  const course = getCourses()[0];
  const instructors = getInstructors().slice(0, 2);
  const rt = company.technicalResponsible;
  const today = todayIso();
  const now = new Date().toISOString();
  return {
    id: 'exemplo', companyId: '', createdAt: now, updatedAt: now,
    certificateNumber: 'TRE-0000-0000', validationCode: 'VAL-TRE-0000-EXEMPLO1', classNumber: 'TUR-0000-0000',
    courseId: course?.id || '', courseName: course?.name || 'NR-10 – Segurança em Instalações e Serviços em Eletricidade (Básico)',
    normReference: course?.normReference || 'NR-10 – item 10.8.8 e Anexo II', workloadHours: course?.workloadHours || 40,
    modality: course?.modality || 'presencial', topics: course?.topics || [{ title: 'Introdução à segurança com eletricidade', hours: 4 }],
    prerequisite: course?.prerequisite, courseNotes: course?.notes,
    participantName: 'Nome do Participante', participantCpf: '52998224725', participantCompany: 'Empresa do Participante',
    attendance: 100, startDate: today, endDate: today, location: company.city || 'Local do treinamento', issueDate: today,
    expiryDate: computeExpiryDate(today, course?.validityMonths ?? 24),
    instructorIds: instructors.map(i => i.id), instructorNames: instructors.map(i => i.name),
    instructors: instructors.length
      ? instructors.map(i => ({ name: i.name, qualification: i.qualification, registration: i.registration, signatureUrl: i.signatureUrl }))
      : [{ name: 'Nome do Instrutor', qualification: 'Engenheiro Eletricista', registration: 'CREA 000000', signatureUrl: '' }],
    technicalResponsibleName: rt?.name || 'Responsável Técnico',
    technicalResponsibleTitle: rt?.title || '',
    technicalResponsibleRegistration: [rt?.creaNumber, rt?.rnp ? `RNP ${rt.rnp}` : ''].filter(Boolean).join(' · '),
    technicalResponsibleSignature: rt?.signatureUrl,
    status: 'valido'
  };
}

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ label, checked, onChange, disabled }) => (
  <label className="flex items-center gap-2 text-xs text-slate-700 py-1">
    <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
    {label}
  </label>
);

const Section: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
  <div className={`${cardCls} p-4 space-y-3`}>
    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5"><Icon className="w-4 h-4 text-blue-600" /> {title}</h3>
    {children}
  </div>
);

export const LayoutPanel: React.FC = () => {
  const canEdit = canManageSigningCerts();
  const saved = useMemo(() => getTrainingLayout(), []);
  const [L, setL] = useState<TrainingCertificateLayout>(saved);
  const [savedJson, setSavedJson] = useState(JSON.stringify(saved));
  const [previewUrl, setPreviewUrl] = useState('');
  const [rendering, setRendering] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const urlRef = useRef('');
  const companyLogo = DielectricStorageService.getCompanyInfo().logoUrl || '';
  const dirty = JSON.stringify(L) !== savedJson;

  const set = (patch: Partial<TrainingCertificateLayout>) => setL(prev => ({ ...prev, ...patch }));

  // pré-visualização: gera o PDF de exemplo um instante depois da última alteração
  useEffect(() => {
    let alive = true;
    setRendering(true);
    const timer = window.setTimeout(async () => {
      try {
        const { renderTrainingCertificates } = await import('../certificatePdf');
        const doc = await renderTrainingCertificates([sampleCertificate()], undefined, normalizeLayout(L));
        if (!alive) return;
        const url = URL.createObjectURL(doc.output('blob'));
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPreviewUrl(url);
      } catch (err) {
        console.warn('[layout] pré-visualização', err);
      } finally {
        if (alive) setRendering(false);
      }
    }, 700);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [L]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const insertField = (key: string) => {
    const el = bodyRef.current;
    const token = `{${key}}`;
    if (!el) return set({ bodyTemplate: L.bodyTemplate + token });
    const start = el.selectionStart ?? L.bodyTemplate.length;
    const end = el.selectionEnd ?? start;
    set({ bodyTemplate: L.bodyTemplate.slice(0, start) + token + L.bodyTemplate.slice(end) });
    window.setTimeout(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); }, 0);
  };

  const handleLogo = async (file?: File) => {
    if (!file) return;
    try { set({ customLogo: await readLogo(file), logoSource: 'personalizado' }); } catch (err) { alertError(err, 'Logo não carregado'); }
  };

  const handleSave = () => {
    try {
      const clean = normalizeLayout(L);
      saveTrainingLayout(clean);
      setL(clean);
      setSavedJson(JSON.stringify(clean));
      window.alert('Layout do certificado salvo. Vale para os próximos PDFs gerados (inclusive de certificados já emitidos).');
    } catch (err) {
      alertError(err, 'Não foi possível salvar o layout');
    }
  };

  const handleReset = () => {
    if (window.confirm('Voltar todo o layout ao padrão do sistema? (só é gravado ao clicar em Salvar)')) setL({ ...DEFAULT_LAYOUT });
  };

  const disabled = !canEdit;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 max-w-xl">
          Aparência dos certificados de treinamento. O layout vale para todos os PDFs gerados a partir de agora, inclusive de
          certificados já emitidos (os dados do certificado e o QR Code não mudam).
          {!canEdit && ' Somente o administrador ou o responsável técnico pode alterar.'}
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <button type="button" className={btnSecondary} onClick={handleReset}><RotateCcw className="w-3.5 h-3.5" /> Padrão</button>
            <button type="button" className={btnPrimary} disabled={!dirty} onClick={handleSave}><Save className="w-3.5 h-3.5" /> Salvar layout</button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-3 items-start">
        <div className="space-y-3">
          <Section icon={ImageIcon} title="Logo e cabeçalho">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Logo">
                <select className={inputCls} disabled={disabled} value={L.logoSource} onChange={e => set({ logoSource: e.target.value as TrainingCertificateLayout['logoSource'] })}>
                  <option value="empresa">Logo da empresa (Configuração)</option>
                  <option value="personalizado">Logo próprio do certificado</option>
                  <option value="nenhum">Sem logo</option>
                </select>
              </Field>
              <Field label="Posição">
                <select className={inputCls} disabled={disabled || L.logoSource === 'nenhum'} value={L.logoPosition} onChange={e => set({ logoPosition: e.target.value as TrainingCertificateLayout['logoPosition'] })}>
                  <option value="esquerda">Esquerda</option>
                  <option value="centro">Centro</option>
                  <option value="direita">Direita</option>
                </select>
              </Field>
            </div>
            {L.logoSource !== 'nenhum' && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-28 h-16 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
                  {(L.logoSource === 'personalizado' ? L.customLogo || companyLogo : companyLogo)
                    ? <img src={L.logoSource === 'personalizado' ? L.customLogo || companyLogo : companyLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
                    : <span className="text-[10px] text-slate-400 text-center px-1">sem logo cadastrado</span>}
                </div>
                {L.logoSource === 'personalizado' && canEdit && (
                  <div className="flex flex-col gap-1">
                    <label className={`${btnSecondary} cursor-pointer`}>
                      <ImageIcon className="w-3.5 h-3.5" /> Escolher imagem
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { handleLogo(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    {L.customLogo && <button type="button" className="text-[11px] text-red-600 hover:underline text-left" onClick={() => set({ customLogo: '' })}>Remover imagem</button>}
                  </div>
                )}
                <Field label={`Tamanho: ${Math.round(L.logoWidth)} mm`} className="flex-1 min-w-[160px]">
                  <input type="range" min={15} max={70} step={1} disabled={disabled} value={L.logoWidth} onChange={e => set({ logoWidth: Number(e.target.value) })} className="w-full accent-blue-600" />
                </Field>
              </div>
            )}
            {L.logoSource === 'personalizado' && !L.customLogo && <p className="text-[11px] text-amber-700">Sem imagem própria: usa o logo da empresa.</p>}
            <Toggle label="Mostrar dados da empresa (razão social, CNPJ e contatos)" checked={L.showCompanyData} disabled={disabled} onChange={v => set({ showCompanyData: v })} />
          </Section>

          <Section icon={Type} title="Textos">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Título"><input className={inputCls} disabled={disabled} value={L.title} maxLength={40} onChange={e => set({ title: e.target.value })} /></Field>
              <Field label="Subtítulo"><input className={inputCls} disabled={disabled} value={L.subtitle} maxLength={80} onChange={e => set({ subtitle: e.target.value })} /></Field>
            </div>
            <Field label="Frase antes do nome"><input className={inputCls} disabled={disabled} value={L.intro} maxLength={120} onChange={e => set({ intro: e.target.value })} /></Field>
            <Field label="Texto padrão do certificado" hint="Vem logo abaixo do nome do participante. Clique num campo para inserir no ponto do cursor.">
              <textarea ref={bodyRef} rows={5} className={inputCls} disabled={disabled} value={L.bodyTemplate} maxLength={1200} onChange={e => set({ bodyTemplate: e.target.value })} />
            </Field>
            {canEdit && (
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_FIELDS.map(f => (
                  <button key={f.key} type="button" title={f.label} onClick={() => insertField(f.key)}
                    className="px-2 py-0.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-mono hover:bg-blue-100">{`{${f.key}}`}</button>
                ))}
                <button type="button" className="px-2 py-0.5 text-[10px] text-slate-500 hover:underline" onClick={() => set({ bodyTemplate: DEFAULT_LAYOUT.bodyTemplate })}>restaurar texto padrão</button>
              </div>
            )}
            <Field label="Texto complementar (opcional)" hint="Aparece abaixo do texto padrão, em letra menor. Aceita os mesmos campos.">
              <textarea rows={2} className={inputCls} disabled={disabled} value={L.closingText} maxLength={400} onChange={e => set({ closingText: e.target.value })} />
            </Field>
            <Toggle label="Mostrar CPF, função e empresa abaixo do nome" checked={L.showIdLine} disabled={disabled} onChange={v => set({ showIdLine: v })} />
            <Toggle label='Mostrar "Válido até" (vencimento)' checked={L.showValidity} disabled={disabled} onChange={v => set({ showValidity: v })} />
          </Section>

          <Section icon={PenLine} title="Assinaturas">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Instrutores que assinam">
                <select className={inputCls} disabled={disabled} value={L.maxInstructors} onChange={e => set({ maxInstructors: Number(e.target.value) })}>
                  <option value={2}>Até 2 instrutores</option>
                  <option value={1}>Somente o 1º instrutor</option>
                  <option value={0}>Nenhum</option>
                </select>
              </Field>
              <Field label="Cargo do instrutor"><input className={inputCls} disabled={disabled || L.maxInstructors === 0} value={L.instructorLabel} maxLength={60} onChange={e => set({ instructorLabel: e.target.value })} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 items-end">
              <Toggle label="Assinatura do Responsável Técnico" checked={L.showTechnicalResponsible} disabled={disabled} onChange={v => set({ showTechnicalResponsible: v })} />
              <Field label="Cargo do RT"><input className={inputCls} disabled={disabled || !L.showTechnicalResponsible} value={L.technicalResponsibleLabel} maxLength={60} onChange={e => set({ technicalResponsibleLabel: e.target.value })} /></Field>
              <Toggle label="Linha de assinatura do participante" checked={L.showParticipant} disabled={disabled} onChange={v => set({ showParticipant: v })} />
              <Field label="Rótulo do participante"><input className={inputCls} disabled={disabled || !L.showParticipant} value={L.participantLabel} maxLength={60} onChange={e => set({ participantLabel: e.target.value })} /></Field>
            </div>
            <p className="text-[11px] text-slate-500">
              A assinatura digital (ICP-Brasil) é aplicada só para quem aparece no certificado. A imagem da assinatura de cada pessoa
              e o certificado digital continuam no cadastro do instrutor e em Configuração (RT).
            </p>
          </Section>

          <Section icon={Palette} title="Cores e moldura">
            <div className="flex flex-wrap gap-4">
              <Field label="Cor principal">
                <input type="color" className="w-16 h-9 rounded-lg border border-slate-300" disabled={disabled} value={L.primaryColor} onChange={e => set({ primaryColor: e.target.value })} />
              </Field>
              <Field label="Cor de destaque">
                <input type="color" className="w-16 h-9 rounded-lg border border-slate-300" disabled={disabled} value={L.accentColor} onChange={e => set({ accentColor: e.target.value })} />
              </Field>
            </div>
            <Toggle label="Moldura dupla na borda da página" checked={L.showFrame} disabled={disabled} onChange={v => set({ showFrame: v })} />
          </Section>

          <Section icon={FileText} title="Verso">
            <Toggle label="Imprimir o verso (conteúdo programático)" checked={L.showBackPage} disabled={disabled} onChange={v => set({ showBackPage: v })} />
            {L.showBackPage && (
              <>
                <Field label="Título do verso"><input className={inputCls} disabled={disabled} value={L.backTitle} maxLength={80} onChange={e => set({ backTitle: e.target.value })} /></Field>
                <Toggle label="Mostrar aproveitamento (presença e nota)" checked={L.showPerformance} disabled={disabled} onChange={v => set({ showPerformance: v })} />
              </>
            )}
          </Section>
        </div>

        <div className={`${cardCls} p-3 lg:sticky lg:top-3`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5"><Eye className="w-4 h-4 text-blue-600" /> Pré-visualização</h3>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              {rendering && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {dirty ? 'alterações não salvas' : 'layout salvo'}
            </span>
          </div>
          {previewUrl
            ? <iframe title="Pré-visualização do certificado" src={`${previewUrl}#view=FitH`} className="w-full h-[70vh] min-h-[420px] rounded-lg border border-slate-200 bg-slate-100" />
            : <div className="h-[420px] flex items-center justify-center text-xs text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>}
          <p className="text-[10px] text-slate-400 mt-1">Exemplo com dados fictícios do participante, sem assinatura digital.</p>
        </div>
      </div>
    </div>
  );
};

export default LayoutPanel;
