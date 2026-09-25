import { ConsolidatedReport, TestRecord, Client, CompanyLabInfo, LabInstrument } from '../types';
import { formatDateBR, nc } from '../utils/dateUtils';
import { DielectricStorageService } from './syncEngine';
import { sanitizeForFilename, getEffectiveCollaborator, loadImageAsDataUrl, generateQRCodeDataUrl, formatToolDisplayName, formatEquipmentType } from './pdfGenerator';
import { getEquipmentTypeDescription, getApplicableNormsList } from './spreadsheetService';
import { saveFileLocally } from '../utils/nativeFileSaver';
import { cleanSignatureImage } from '../utils/signatureCleaner';
import { ValidationPortalService } from './validationPortalService';
import { generateGaugeCanvasDataUrl } from '../utils/gaugeUtils';
import { TABELA_4_NBR_16295, getClosestGloveLength } from './nbr16295Service';
import { getASTMD178Entry } from './astmBlanketMattingService';

export interface WordExportOptions {
  reportFormat?: 'simplificado' | 'completo';
  reportCode?: string;
  reportTitle?: string;
  artNumber?: string;
  emissionDate?: string;
  location?: string;
  technicianName?: string;
  technicianCreaOrCft?: string;
  techResponsibleName?: string;
  techResponsibleCrea?: string;
  techResponsibleRnp?: string;
  introductionText?: string;
  resultsAnalysisText?: string;
  conclusionText?: string;
  includeIndividualReportsAnnex?: boolean;
  annexTitle?: string;
  selectedOSId?: string;
}

/**
 * Gera e exporta o relatório técnico no formato Microsoft Word (.doc/.docx),
 * reproduzindo integralmente o layout, tipografia, cores, tabelas, cabeçalhos,
 * agrupamentos por colaborador e dossiê multipáginas exibidos no navegador.
 */
export async function exportReportToWord(options: {
  report?: ConsolidatedReport;
  tests: TestRecord[];
  companyInfo?: CompanyLabInfo;
  clientsList?: Client[];
  exportOptions?: WordExportOptions;
}): Promise<void> {
  const { report, tests, companyInfo, clientsList, exportOptions = {} } = options;

  if (!tests || tests.length === 0) {
    throw new Error('Nenhum ensaio selecionado para emissão do relatório em Word.');
  }

  const company = companyInfo || DielectricStorageService.getCompanyInfo();
  const clients = clientsList || DielectricStorageService.getClients();
  const labInstruments = DielectricStorageService.getInstruments();
  const serviceOrders = DielectricStorageService.getWorkOrders();

  // Dados do Cliente
  const primaryClientId = report?.clientId || tests[0]?.clientId;
  const matchedClient = clients.find(c => c.id === primaryClientId || c.razaoSocial === tests[0]?.clientName);
  
  const clientName = matchedClient?.razaoSocial || report?.clientName || tests[0]?.clientName || 'Cliente Geral';
  const clientFantasy = matchedClient?.nomeFantasia || '';
  const clientCnpj = matchedClient?.cnpj || report?.clientCnpj || 'Não informado';
  const clientIE = matchedClient?.inscricaoEstadual || 'Isento / Não informado';
  const clientAddress = matchedClient 
    ? `${matchedClient.endereco}, ${matchedClient.numero}${matchedClient.complemento ? ' - ' + matchedClient.complemento : ''} - ${matchedClient.bairro}, ${matchedClient.cidade}/${matchedClient.estado} - CEP: ${matchedClient.cep}`
    : (report?.clientAddress || 'Conforme cadastro do cliente');
  const clientContact = matchedClient?.responsavel 
    ? `${matchedClient.responsavel} (${matchedClient.cargoResponsavel || 'Responsável'})`
    : (report?.clientContact || 'Setor de Segurança do Trabalho / SESMT');
  const clientPhone = matchedClient?.telefone || matchedClient?.whatsapp || 'Não informado';
  const clientEmail = matchedClient?.email || 'Não informado';

  // Configurações do Relatório
  const format = exportOptions.reportFormat || (report?.id ? 'completo' : 'simplificado');
  const reportCode = exportOptions.reportCode || report?.reportCode || 'REL-MSW-001';
  const reportTitle = exportOptions.reportTitle || report?.title || (
    format === 'simplificado'
      ? 'RELATÓRIO TÉCNICO SIMPLIFICADO & TABULAÇÃO DE ENSAIOS DIELÉTRICOS'
      : 'RELATÓRIO TÉCNICO CONSOLIDADO DE ENSAIOS DIELÉTRICOS'
  );
  const emissionDate = exportOptions.emissionDate || report?.emissionDate || new Date().toISOString().slice(0, 10);
  const location = exportOptions.location || report?.location || 'Laboratório Móvel JVM';

  const selectedOS = serviceOrders.find(o => o.id === (exportOptions.selectedOSId || report?.serviceOrderId));
  const osNumber = selectedOS?.osNumber || report?.serviceOrderNumber || 'Avulso / Geral';
  const artNumber = exportOptions.artNumber || report?.artNumber || selectedOS?.artNumber || 'Conforme ART Geral do Laboratório';

  const technicianName = exportOptions.technicianName || report?.technicianName || 'Técnico em Eletrotécnica';
  const technicianCreaOrCft = exportOptions.technicianCreaOrCft || report?.technicianCreaOrCft || 'Técnico em Eletrotécnica / Inspetor Dielétrico';
  const techResponsibleName = exportOptions.techResponsibleName || report?.techResponsibleName || company.technicalResponsible.name;
  const techResponsibleCrea = exportOptions.techResponsibleCrea || report?.techResponsibleCrea || company.technicalResponsible.creaNumber;
  const techResponsibleRnp = exportOptions.techResponsibleRnp || report?.techResponsibleRnp || company.technicalResponsible.rnp || '';

  const includeAnnex = exportOptions.includeIndividualReportsAnnex ?? report?.includeIndividualReportsAnnex ?? true;
  const annexTitle = exportOptions.annexTitle || report?.annexTitle || 'ANEXO I – LAUDOS TÉCNICOS INDIVIDUAIS DOS ENSAIOS DIELÉTRICOS';

  // Estatísticas
  const total = tests.length;
  const approved = tests.filter(t => t.result === 'APROVADO').length;
  const rejected = total - approved;
  const approvalRate = total > 0 ? (approved / total) * 100 : 100;

  // Normas aplicadas
  const applicableNorms = getApplicableNormsList(tests);

  // Agrupamento por colaborador para o formato simplificado
  const collaboratorGroupsMap = new Map<string, {
    collaboratorName: string;
    collaboratorRegistration: string;
    collaboratorSector: string;
    items: Array<{
      reportNumber: string;
      equipmentTag: string;
      equipmentTypeName: string;
      caNumber: string;
      dielectricClass: string;
      appliedVoltage_kV: number;
      voltageType: string;
      measuredLeakage_mA: number;
      leakageLimit_mA: number;
      testDate: string;
      retestDueDate: string;
      result: string;
    }>;
    total: number;
    approved: number;
    rejected: number;
  }>();

  tests.forEach(test => {
    const collName = getEffectiveCollaborator(test) || test.collaboratorName || 'Não especificado';
    const collReg = test.collaboratorRegistration || 'N/D';
    const collSector = test.collaboratorSector || 'Geral';
    const key = `${collName}___${collReg}___${collSector}`;

    if (!collaboratorGroupsMap.has(key)) {
      collaboratorGroupsMap.set(key, {
        collaboratorName: collName,
        collaboratorRegistration: collReg,
        collaboratorSector: collSector,
        items: [],
        total: 0,
        approved: 0,
        rejected: 0
      });
    }

    const group = collaboratorGroupsMap.get(key)!;
    const isApp = test.result === 'APROVADO';

    group.items.push({
      reportNumber: test.reportNumber,
      equipmentTag: test.equipmentTag || 'S/TAG',
      equipmentTypeName: getEquipmentTypeDescription(test.equipmentType, (test as any).customEquipmentTypeName),
      caNumber: test.equipmentCa || 'N/A',
      dielectricClass: `Classe ${test.equipmentClass || '0'}`,
      appliedVoltage_kV: test.appliedVoltage_kV,
      voltageType: test.voltageType || 'AC',
      measuredLeakage_mA: test.measuredLeakageCurrent_mA || 0,
      leakageLimit_mA: test.leakageCurrentLimit_mA || 10,
      testDate: formatDateBR(test.testDate),
      retestDueDate: formatDateBR(test.retestDueDate),
      result: test.result
    });

    group.total += 1;
    if (isApp) group.approved += 1;
    else group.rejected += 1;
  });

  const collaboratorGroups = Array.from(collaboratorGroupsMap.values()).sort((a, b) => 
    a.collaboratorName.localeCompare(b.collaboratorName)
  );

  // Textos complementares
  const introText = exportOptions.introductionText || report?.introductionText || `O presente relatório técnico consolida os resultados dos ensaios de rigidez dielétrica e inspeções visuais/mecânicas realizadas em Equipamentos de Proteção Individual (EPI) e Proteção Coletiva (EPC) pertencentes à empresa ${clientName}.\n\nOs procedimentos laboratoriais visam atender rigorosamente ao disposto no item 10.7.8 da Norma Regulamentadora NR-10 do Ministério do Trabalho e Emprego (MTE), que estabelece a obrigatoriedade de ensaios elétricos periódicos em todos os equipamentos, ferramentas e dispositivos isolantes destinados a intervenções em instalações elétricas.`;

  const analysisText = exportOptions.resultsAnalysisText || report?.resultsAnalysisText || `Foram submetidos a ensaios de rigidez dielétrica um total de ${total} equipamentos. Destes, ${approved} itens (${approvalRate.toFixed(1)}%) foram considerados APROVADOS e ${rejected} itens foram REPROVADOS.\n\nOs equipamentos aprovados apresentaram suportabilidade plena às tensões de ensaio aplicadas com correntes de fuga estritamente dentro dos parâmetros normativos.`;

  const conclusionText = exportOptions.conclusionText || report?.conclusionText || `Com base nos ensaios laboratoriais e critérios normativos aplicados, conclui-se que os ${approved} equipamentos APROVADOS encontram-se em condições seguras e operacionais, liberados para uso em trabalhos em instalações elétricas com validade técnica até as datas indicadas em seus respectivos laudos.\n\nRecomenda-se a imediata inutilização e descarte de quaisquer itens reprovados, além da rigorosa inspeção diária pelo usuário antes do início das atividades de campo.`;

  // Construir HTML com estilo Word e Namespaces
  let contentHtml = '';

  if (format === 'simplificado') {
    contentHtml = `
      <div class="report-container">
        <!-- CABEÇALHO OFICIAL -->
        <table class="header-table" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align: top; padding-bottom: 12px;">
              <div class="badge-lab">LABORATÓRIO DE ENSAIOS DIELÉTRICOS & METROLOGIA (NR-10)</div>
              <h1 class="company-title">${escapeXml(company.name)}</h1>
              <p class="company-meta">
                CNPJ: <strong>${escapeXml(company.cnpj)}</strong> &bull; Registro CREA PJ: <strong>${escapeXml(company.creaCompanyRegister)}</strong>
              </p>
              <p class="company-sub">
                ${escapeXml(company.address)} &bull; Fone: ${escapeXml(company.phone)} &bull; E-mail: ${escapeXml(company.email)}
              </p>
            </td>
            <td style="vertical-align: top; text-align: right; width: 220px; padding-bottom: 12px;">
              <table class="code-box" width="100%" cellpadding="6" cellspacing="0">
                <tr>
                  <td style="text-align: right;">
                    <div class="code-box-label">CÓDIGO DO RELATÓRIO</div>
                    <div class="code-box-value">${escapeXml(reportCode)}</div>
                    <div class="code-box-sub">Emissão: <strong>${formatDateBR(emissionDate)}</strong></div>
                    <div class="code-box-sub">Lote: <strong>${total} itens</strong> (${approved} aprovados)</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- TÍTULO PRINCIPAL -->
        <table class="title-banner" width="100%" cellpadding="8" cellspacing="0">
          <tr>
            <td align="center">
              <div class="title-banner-main">${escapeXml(reportTitle)}</div>
              <div class="title-banner-sub">Atendimento à Norma Regulamentadora NR-10 (item 10.7.8) e Normas Técnicas Brasileiras ABNT / Internacionais ASTM</div>
            </td>
          </tr>
        </table>

        <!-- SEÇÃO 1: DADOS DO CLIENTE -->
        <div class="section-title">1. DADOS DA EMPRESA SOLICITANTE / CLIENTE</div>
        
        <table class="grid-table" width="100%" cellpadding="6" cellspacing="4">
          <tr>
            <td width="33%" class="info-card">
              <span class="info-card-label">Razão Social / Nome</span>
              <p class="info-card-value">${escapeXml(clientName)}</p>
              ${clientFantasy && clientFantasy !== clientName ? `<p class="info-card-sub">Fantasia: ${escapeXml(clientFantasy)}</p>` : ''}
            </td>
            <td width="33%" class="info-card">
              <span class="info-card-label">CNPJ / Inscrição Estadual</span>
              <p class="info-card-value">${escapeXml(clientCnpj)}</p>
              <p class="info-card-sub">IE: ${escapeXml(clientIE)}</p>
            </td>
            <td width="34%" class="info-card">
              <span class="info-card-label">Ordem de Serviço & ART</span>
              <p class="info-card-value">OS: ${escapeXml(osNumber)}</p>
              <p class="info-card-sub">ART: <strong>${escapeXml(artNumber)}</strong></p>
            </td>
          </tr>
          <tr>
            <td colspan="2" class="info-card">
              <span class="info-card-label">Endereço Completo</span>
              <p class="info-card-value" style="font-weight: normal;">${escapeXml(clientAddress)}</p>
            </td>
            <td class="info-card">
              <span class="info-card-label">Contato / SST</span>
              <p class="info-card-value">${escapeXml(clientContact)}</p>
              <p class="info-card-sub">${escapeXml(clientPhone)} &bull; ${escapeXml(clientEmail)}</p>
            </td>
          </tr>
        </table>

        <!-- RESUMO DO LOTE -->
        <table class="summary-bar" width="100%" cellpadding="6" cellspacing="0">
          <tr>
            <td style="font-weight: bold; color: #1e3a8a;">
              Resumo Geral do Lote: <span class="badge-total">${total} ensaios</span>
            </td>
            <td align="right">
              <span style="font-weight: bold; color: #065f46;">&check; ${approved} Aprovados (${approvalRate.toFixed(1)}%)</span>
              ${rejected > 0 ? `<span style="font-weight: bold; color: #991b1b; margin-left: 12px;">&#10005; ${rejected} Reprovados</span>` : '<span style="color: #047857; margin-left: 8px; font-weight: bold;">(100% Conformidade)</span>'}
            </td>
          </tr>
        </table>

        <!-- SEÇÃO 2: NORMAS TÉCNICAS -->
        <div class="section-title" style="margin-top: 18px;">2. NORMAS TÉCNICAS E CRITÉRIOS DE CONFORMIDADE APLICADOS</div>
        <p class="intro-p">
          Os ensaios de rigidez dielétrica e as inspeções visuais/mecânicas foram executados em estrita observância aos requisitos das normas técnicas nacionais e internacionais vigentes, conforme detalhado na tabela abaixo:
        </p>

        <table class="data-table" width="100%" cellpadding="5" cellspacing="0">
          <thead>
            <tr class="table-header">
              <th width="8%" align="center">Item</th>
              <th width="22%">Código da Norma</th>
              <th width="30%">Título / Denominação Técnica</th>
              <th width="20%">Equipamentos Abrangidos</th>
              <th width="20%">Critério / Parâmetro Avaliado</th>
            </tr>
          </thead>
          <tbody>
            ${applicableNorms.map((norm, idx) => `
              <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
                <td align="center" style="font-weight: bold; color: #64748b;">2.${idx + 1}</td>
                <td style="font-family: monospace; font-weight: bold; color: #1e3a8a;">${escapeXml(norm.code)}</td>
                <td style="font-weight: 500;">${escapeXml(norm.name || '')}</td>
                <td style="color: #475569;">${escapeXml(norm.equipmentTypes || '')}</td>
                <td style="color: #475569; font-size: 8.5pt;">${escapeXml(norm.scope || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- SEÇÃO 3: TABULAÇÃO POR COLABORADOR -->
        <div class="section-title" style="margin-top: 22px;">
          3. TABULAÇÃO RESUMO DOS EQUIPAMENTOS ENSAIADOS (ORDENADA POR COLABORADOR)
        </div>
        <p class="intro-p" style="margin-bottom: 8px;">
          Relação nominal de colaboradores com a respectiva carga de equipamentos ensaiados, parâmetros elétricos medidos e pareceres técnicos de aprovação:
        </p>

        ${collaboratorGroups.map((group, gIdx) => `
          <div class="collaborator-block" style="margin-top: 14px; margin-bottom: 14px;">
            <!-- FAIXA DO COLABORADOR -->
            <table class="collaborator-header" width="100%" cellpadding="6" cellspacing="0">
              <tr>
                <td style="color: #ffffff; font-weight: bold; font-size: 10pt;">
                  <span class="collaborator-number">${gIdx + 1}</span>
                  <span style="text-transform: uppercase;">${escapeXml(group.collaboratorName)}</span>
                  ${group.collaboratorRegistration && group.collaboratorRegistration !== '-' ? `<span style="font-size: 8.5pt; color: #cbd5e1; margin-left: 8px;">&bull; Matrícula: ${escapeXml(group.collaboratorRegistration)}</span>` : ''}
                  ${group.collaboratorSector && group.collaboratorSector !== 'Geral' ? `<span style="font-size: 8.5pt; color: #cbd5e1; margin-left: 8px;">&bull; Setor: ${escapeXml(group.collaboratorSector)}</span>` : ''}
                </td>
                <td align="right" style="color: #ffffff; font-size: 9pt;">
                  <span class="badge-count">${group.total} equipamento(s)</span>
                  <span class="badge-app">&check; ${group.approved} Aprovado(s)</span>
                  ${group.rejected > 0 ? `<span class="badge-rej">&#10005; ${group.rejected} Reprovado(s)</span>` : ''}
                </td>
              </tr>
            </table>

            <!-- TABELA DE EQUIPAMENTOS -->
            <table class="data-table" width="100%" cellpadding="4" cellspacing="0">
              <thead>
                <tr class="table-sub-header">
                  <th width="12%">Nº Laudo</th>
                  <th width="12%">TAG / ID</th>
                  <th width="24%">Tipo de Equipamento</th>
                  <th width="8%">CA</th>
                  <th width="8%">Classe</th>
                  <th width="10%" align="center">Tensão</th>
                  <th width="9%" align="center">Fuga</th>
                  <th width="9%" align="center">Limite</th>
                  <th width="8%">Data</th>
                  <th width="8%">Validade</th>
                  <th width="10%" align="center">Parecer</th>
                </tr>
              </thead>
              <tbody>
                ${group.items.map((item, iIdx) => {
                  const isApp = item.result === 'APROVADO';
                  return `
                    <tr class="${iIdx % 2 === 0 ? 'row-even' : 'row-odd'}">
                      <td style="font-family: monospace; font-weight: bold; color: #0a2540; font-size: 8.5pt;">${escapeXml(item.reportNumber)}</td>
                      <td style="font-weight: bold; color: #0f172a;">${escapeXml(item.equipmentTag)}</td>
                      <td>${escapeXml(item.equipmentTypeName)}</td>
                      <td style="font-family: monospace; font-size: 8.5pt;">${escapeXml(item.caNumber)}</td>
                      <td>${escapeXml(item.dielectricClass)}</td>
                      <td align="center" style="font-weight: bold;">${item.appliedVoltage_kV} kV ${escapeXml(item.voltageType)}</td>
                      <td align="center" style="font-family: monospace; font-weight: bold; color: ${isApp ? '#0f172a' : '#b91c1c'};">${item.measuredLeakage_mA.toFixed(2)} mA</td>
                      <td align="center" style="font-family: monospace; font-size: 8pt; color: #64748b;">&le; ${item.leakageLimit_mA.toFixed(2)} mA</td>
                      <td style="font-size: 8.5pt;">${item.testDate}</td>
                      <td style="font-size: 8.5pt; font-weight: bold; color: #065f46;">${item.retestDueDate}</td>
                      <td align="center">
                        ${isApp 
                          ? '<span class="status-approved">APROVADO</span>' 
                          : '<span class="status-rejected">REPROVADO</span>'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}

        <!-- SEÇÃO 4: TERMO DE CONFORMIDADE -->
        <div class="section-title" style="margin-top: 24px;">
          4. TERMO DE CONFORMIDADE TÉCNICA & RASTREABILIDADE METROLÓGICA (RBC)
        </div>
        
        <table class="conformity-box" width="100%" cellpadding="10" cellspacing="0">
          <tr>
            <td>
              <p style="margin-top: 0; margin-bottom: 8px;">
                Atestamos que os equipamentos de proteção individual (EPI) e proteção coletiva (EPC) relacionados neste relatório técnico simplificado foram ensaiados em laboratório especializado sob condições ambientais controladas (Temperatura: 23°C &plusmn; 2°C, Umidade Relativa do Ar: 55% &plusmn; 10%). Todos os instrumentos geradores e medidores de alta tensão possuem certificados de calibração vigentes emitidos por laboratórios acreditados pela Cgcre/INMETRO pertencentes à Rede Brasileira de Calibração (RBC).
              </p>
              <p style="margin-bottom: 0;">
                Os itens identificados como <strong>APROVADOS</strong> apresentaram suportabilidade à tensão de prova aplicada, ausência de perfuração dielétrica e correntes de fuga estritamente inferiores aos limites máximos normativos, encontrando-se aptos e liberados para intervenções elétricas em conformidade com o item 10.7.8 da Norma Regulamentadora NR-10. Os itens porventura identificados como <strong>REPROVADOS</strong> devem ser imediatamente retirados de operação e descartados.
              </p>
            </td>
          </tr>
        </table>

        <!-- SEÇÃO 5: ASSINATURAS -->
        <div class="section-title" style="margin-top: 28px;">5. ASSINATURAS E RESPONSABILIDADE TÉCNICA</div>

        <table width="100%" cellpadding="8" cellspacing="12" style="margin-top: 10px;">
          <tr>
            <td width="50%" class="sig-box" align="center">
              <div class="sig-line">
                <span class="sig-cursive">[Assinatura Digital / Técnico]</span>
              </div>
              <p class="sig-name">${escapeXml(technicianName)}</p>
              <p class="sig-role">${escapeXml(technicianCreaOrCft)}</p>
              <p class="sig-sub">Executor do Ensaio Dielétrico</p>
            </td>
            <td width="50%" class="sig-box-rt" align="center">
              <div class="sig-line-rt">
                <span class="sig-cursive-rt">[Assinado Digitalmente via ICP-Brasil]</span>
              </div>
              <p class="sig-name-rt">${escapeXml(techResponsibleName)}</p>
              <p class="sig-role-rt">Engenheiro Eletricista / Seg. Trabalho</p>
              <p class="sig-sub-rt">
                CREA: <strong>${escapeXml(techResponsibleCrea)}</strong> ${techResponsibleRnp ? `&bull; RNP: ${escapeXml(techResponsibleRnp)}` : ''}
              </p>
              <p class="sig-sub-rt" style="font-size: 8pt; color: #64748b;">Responsável Técnico pelo Laboratório</p>
            </td>
          </tr>
        </table>

        <div class="footer-note">
          Documento técnico emitido digitalmente em ${formatDateBR(emissionDate)} &bull; Laboratório ${escapeXml(company.name)} &bull; Código: ${escapeXml(reportCode)}
        </div>
      </div>
    `;
  } else {
    // FORMATO COMPLETO (DOSSIÊ MULTIPÁGINAS)
    contentHtml = `
      <div class="report-container">
        <!-- ====================================================== -->
        <!-- FOLHA 1: CAPA OFICIAL (COVER PAGE)                    -->
        <!-- ====================================================== -->
        <table class="header-table" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align: middle;">
              <h1 class="company-title" style="font-size: 16pt;">${escapeXml(company.name)}</h1>
              <p style="color: #1d4ed8; font-weight: bold; font-size: 9.5pt; text-transform: uppercase; margin: 2px 0;">
                Laboratório Especializado de Ensaios Dielétricos & Inspeção de EPIs/EPCs
              </p>
              <p class="company-meta">
                CNPJ: <strong>${escapeXml(company.cnpj)}</strong> &bull; Registro CREA PJ: <strong>${escapeXml(company.creaCompanyRegister)}</strong>
              </p>
              <p class="company-sub">
                ${escapeXml(company.address)} &bull; Tel: ${escapeXml(company.phone)} &bull; ${escapeXml(company.email)}
              </p>
            </td>
            <td style="vertical-align: middle; text-align: right; width: 120px;">
              <div class="logo-box">JVM</div>
            </td>
          </tr>
        </table>

        <div style="height: 40px;"></div>

        <!-- CENTRO DA CAPA -->
        <table width="100%" cellpadding="0" cellspacing="0" style="text-align: center;">
          <tr>
            <td align="center">
              <div class="cover-badge">DOSSIÊ TÉCNICO CONCLUSIVO &bull; CONFORME NR-10</div>
              <h1 class="cover-title">${escapeXml(reportTitle)}</h1>
              <p class="cover-desc">
                Avaliação da integridade física, medição de corrente de fuga e ensaios de rigidez dielétrica em Equipamentos de Proteção Individual e Coletiva conforme item 10.7.8 da NR-10 e Normas ABNT / ASTM.
              </p>

              <div style="margin: 20px 0;">
                <span class="tag-pill-dark">Código: ${escapeXml(reportCode)}</span>
                <span class="tag-pill-orange">OS: ${escapeXml(osNumber)}</span>
                ${artNumber ? `<span class="tag-pill-amber">ART: ${escapeXml(artNumber)}</span>` : ''}
              </div>
            </td>
          </tr>
        </table>

        <div style="height: 30px;"></div>

        <!-- GRID DE DADOS CLIENTE E LOTE -->
        <table width="100%" cellpadding="6" cellspacing="8">
          <tr>
            <td width="50%" class="info-card-full" style="vertical-align: top;">
              <div class="info-card-header">DADOS DO CLIENTE / SOLICITANTE</div>
              <p><strong>Razão Social:</strong> ${escapeXml(clientName)}</p>
              <p><strong>CNPJ:</strong> ${escapeXml(clientCnpj)}</p>
              <p><strong>Endereço:</strong> ${escapeXml(clientAddress)}</p>
              <p><strong>Contato:</strong> ${escapeXml(clientContact)}</p>
            </td>
            <td width="50%" class="info-card-full" style="vertical-align: top;">
              <div class="info-card-header">INFORMAÇÕES DA EMISSÃO & LOTE</div>
              <p><strong>Data de Emissão:</strong> ${formatDateBR(emissionDate)}</p>
              <p><strong>Local de Ensaio:</strong> ${escapeXml(location)}</p>
              <p><strong>Quantidade Inspecionada:</strong> ${total} equipamentos</p>
              <p><strong>Índice de Aprovação:</strong> <span style="color: #047857; font-weight: bold;">${approvalRate.toFixed(1)}%</span> (${approved} aprovados / ${rejected} reprovados)</p>
            </td>
          </tr>
        </table>

        <div style="height: 40px;"></div>

        <!-- RODAPÉ DA CAPA -->
        <table class="cover-footer" width="100%" cellpadding="4" cellspacing="0">
          <tr>
            <td>
              <p style="font-weight: bold; margin: 0; color: #1e293b;">Responsável Técnico: ${escapeXml(techResponsibleName)} (CREA: ${escapeXml(techResponsibleCrea)})</p>
              <p style="margin: 0; color: #64748b; font-size: 8.5pt;">Laboratorista / Técnico Executor: ${escapeXml(technicianName)}</p>
            </td>
            <td align="right" style="font-size: 8.5pt; color: #475569;">
              Autenticidade rastreável online via Código: <strong>${escapeXml(reportCode)}</strong>
            </td>
          </tr>
        </table>

        <div class="page-break"></div>

        <!-- ====================================================== -->
        <!-- FOLHA 2: SUMÁRIO & INTRODUÇÃO                          -->
        <!-- ====================================================== -->
        <table class="sheet-header" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-weight: bold; text-transform: uppercase; color: #1e293b;">1. Sumário & Introdução Normativa</td>
            <td align="right" style="color: #94a3b8; font-family: monospace;">${escapeXml(reportCode)}</td>
          </tr>
        </table>

        <div class="toc-card">
          <div class="toc-title">Sumário Geral do Relatório</div>
          <table width="100%" cellpadding="3" cellspacing="0" class="toc-table">
            <tr><td>1. Capa & Identificação Geral do Cliente</td><td align="right" class="toc-page">Pág. 01</td></tr>
            <tr><td>2. Sumário Executivo & Introdução Normativa (NR-10)</td><td align="right" class="toc-page">Pág. 02</td></tr>
            <tr><td>3. Metodologia de Ensaios & Rastreabilidade dos Instrumentos</td><td align="right" class="toc-page">Pág. 03</td></tr>
            <tr><td>4. Normas Técnicas Aplicadas & Critérios de Rigidez</td><td align="right" class="toc-page">Pág. 04</td></tr>
            <tr><td>5. Dossiê de Laudos dos Ensaios Realizados</td><td align="right" class="toc-page">Pág. 05</td></tr>
            <tr><td>6. Análise Estatística & Diagnóstico Técnico</td><td align="right" class="toc-page">Pág. 06</td></tr>
            <tr><td>7. Conclusão Técnica, Recomendações e Assinaturas</td><td align="right" class="toc-page">Pág. 06</td></tr>
            ${includeAnnex ? `<tr><td style="font-weight: bold; color: #1e3a8a;">8. ANEXO I – Laudos Técnicos Individuais dos Ensaios (${total} laudos anexados)</td><td align="right" class="toc-page" style="color: #1e3a8a; font-weight: bold;">Pág. 07+</td></tr>` : ''}
          </table>
        </div>

        <div class="section-title" style="margin-top: 18px;">2. Introdução e Contexto Normativo</div>
        <p class="body-p">${escapeXml(introText).replace(/\n/g, '<br/>')}</p>

        <div class="scope-box" style="margin-top: 18px;">
          <div class="scope-title">Escopo e Relação do Lote Inspecionado</div>
          <ul style="margin: 6px 0; padding-left: 20px; font-size: 9pt; color: #1e3a8a; line-height: 1.5;">
            <li><strong>Total de Itens Inspecionados:</strong> ${total} unidades de EPIs/EPCs.</li>
            <li><strong>Ordem de Serviço de Referência:</strong> ${escapeXml(osNumber)} (ART: ${escapeXml(artNumber)}).</li>
            <li><strong>Tipologias Avaliadas:</strong> Luvas isolantes, mangas, mantas, tapetes, ferramentas isoladas 1000V, escadas e bastões de manobra.</li>
            <li><strong>Finalidade:</strong> Garantir que os trabalhadores eletricistas atuem protegidos contra riscos de choque elétrico e arco elétrico conforme as exigências da NR-10.</li>
          </ul>
        </div>

        <div class="page-break"></div>

        <!-- ====================================================== -->
        <!-- FOLHA 3: METODOLOGIA & INSTRUMENTOS                    -->
        <!-- ====================================================== -->
        <table class="sheet-header" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-weight: bold; text-transform: uppercase; color: #1e293b;">2. Metodologia de Ensaios & Instrumentos Rastreáveis</td>
            <td align="right" style="color: #94a3b8; font-family: monospace;">${escapeXml(reportCode)}</td>
          </tr>
        </table>

        <div class="section-title">3. Metodologia e Procedimentos de Ensaio</div>

        <table width="100%" cellpadding="6" cellspacing="8">
          <tr>
            <td width="50%" class="method-card">
              <strong style="color: #0f172a; display: block; margin-bottom: 4px;">3.1 Inspeção Visual & Pneumática</strong>
              <span style="color: #475569; font-size: 8.5pt;">Avaliação rigorosa de furos, trincas, ressecamento, fissuras por ozônio e incrustações. Insuflação pneumática em luvas de borracha.</span>
            </td>
            <td width="50%" class="method-card">
              <strong style="color: #0f172a; display: block; margin-bottom: 4px;">3.2 Condicionamento & Higienização</strong>
              <span style="color: #475569; font-size: 8.5pt;">Higienização com solução neutra, secagem climatizada e estabilização de umidade e temperatura controladas.</span>
            </td>
          </tr>
          <tr>
            <td width="50%" class="method-card">
              <strong style="color: #0f172a; display: block; margin-bottom: 4px;">3.3 Aplicação de Alta Tensão (Hipot)</strong>
              <span style="color: #475569; font-size: 8.5pt;">Submissão do item à tensão de ensaio de prova (kV CA 60Hz) com rampa de subida gradual e tempo de ensaio normatizado (60s a 180s).</span>
            </td>
            <td width="50%" class="method-card">
              <strong style="color: #0f172a; display: block; margin-bottom: 4px;">3.4 Medição da Corrente de Fuga</strong>
              <span style="color: #475569; font-size: 8.5pt;">Registro contínuo da corrente de fuga em miliampères (mA). Comparação com os tetos normativos da ABNT/ASTM.</span>
            </td>
          </tr>
        </table>

        <div class="section-title" style="margin-top: 24px;">3.5 Rastreabilidade Metrológica dos Instrumentos do Laboratório</div>

        <table class="data-table" width="100%" cellpadding="5" cellspacing="0" style="margin-top: 8px;">
          <thead>
            <tr class="table-header">
              <th>Instrumento</th>
              <th>Fabricante / Modelo</th>
              <th>Nº de Série</th>
              <th>Certificado RBC</th>
              <th align="right">Validade</th>
            </tr>
          </thead>
          <tbody>
            ${labInstruments.slice(0, 5).map((inst, idx) => `
              <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
                <td style="font-weight: bold; color: #0f172a;">${escapeXml(inst.type)}</td>
                <td>${escapeXml(inst.manufacturer)} ${escapeXml(inst.model)}</td>
                <td style="font-family: monospace;">${escapeXml(inst.serialNumber)}</td>
                <td style="font-family: monospace;">${escapeXml(inst.calibrationCertNumber)}</td>
                <td align="right" style="font-weight: bold; color: #047857;">${formatDateBR(inst.calibrationExpiryDate)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="page-break"></div>

        <!-- ====================================================== -->
        <!-- FOLHA 4: NORMAS TÉCNICAS APLICADAS                     -->
        <!-- ====================================================== -->
        <table class="sheet-header" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-weight: bold; text-transform: uppercase; color: #1e293b;">3. Normas Técnicas & Critérios de Aceitação</td>
            <td align="right" style="color: #94a3b8; font-family: monospace;">${escapeXml(reportCode)}</td>
          </tr>
        </table>

        <div class="section-title">4. Normas Técnicas Aplicadas</div>

        <table width="100%" cellpadding="6" cellspacing="6">
          <tr>
            <td width="50%" class="norm-card">
              <strong style="color: #1e3a8a; display: block;">ABNT NBR 16295 / IEC 60903</strong>
              <span style="color: #475569; font-size: 8.5pt;">Luvas de material isolante para trabalhos em tensão.</span>
            </td>
            <td width="50%" class="norm-card">
              <strong style="color: #1e3a8a; display: block;">ABNT NBR 10624 / ASTM D1051</strong>
              <span style="color: #475569; font-size: 8.5pt;">Mangas de borracha isolante para proteção de braços.</span>
            </td>
          </tr>
          <tr>
            <td width="50%" class="norm-card">
              <strong style="color: #1e3a8a; display: block;">ASTM D1048</strong>
              <span style="color: #475569; font-size: 8.5pt;">Mantas isolantes de borracha elastomérica.</span>
            </td>
            <td width="50%" class="norm-card">
              <strong style="color: #1e3a8a; display: block;">ASTM D178</strong>
              <span style="color: #475569; font-size: 8.5pt;">Tapetes e estrados de borracha isolante para piso.</span>
            </td>
          </tr>
          <tr>
            <td width="50%" class="norm-card">
              <strong style="color: #1e3a8a; display: block;">ABNT NBR 14540 / ASTM F711</strong>
              <span style="color: #475569; font-size: 8.5pt;">Tubos e bastões de manobra em fibra de vidro.</span>
            </td>
            <td width="50%" class="norm-card">
              <strong style="color: #1e3a8a; display: block;">ABNT NBR IEC 60900</strong>
              <span style="color: #475569; font-size: 8.5pt;">Ferramentas manuais isoladas para trabalhos até 1000V.</span>
            </td>
          </tr>
        </table>

        <div class="section-title" style="margin-top: 24px;">4.1 Classes de Isolação, Tensões de Uso e Tensões de Ensaio</div>

        <table class="data-table" width="100%" cellpadding="5" cellspacing="0" style="margin-top: 8px;">
          <thead>
            <tr class="table-header">
              <th>Classe</th>
              <th>Máx. Uso (CA)</th>
              <th>Máx. Uso (CC)</th>
              <th>Tensão Ensaio</th>
              <th>Tempo</th>
              <th align="right">Limite Fuga (mA)</th>
            </tr>
          </thead>
          <tbody>
            <tr class="row-even">
              <td style="font-weight: bold;">Classe 00</td>
              <td>500 V</td>
              <td>750 V</td>
              <td style="color: #1d4ed8; font-weight: bold;">2.500 V (2,5 kV)</td>
              <td>60 s</td>
              <td align="right" style="font-weight: bold;">10 a 14 mA</td>
            </tr>
            <tr class="row-odd">
              <td style="font-weight: bold;">Classe 0</td>
              <td>1.000 V (1 kV)</td>
              <td>1.500 V</td>
              <td style="color: #1d4ed8; font-weight: bold;">5.000 V (5 kV)</td>
              <td>60 s</td>
              <td align="right" style="font-weight: bold;">12 a 16 mA</td>
            </tr>
            <tr class="row-even">
              <td style="font-weight: bold;">Classe 1</td>
              <td>7.500 V (7,5 kV)</td>
              <td>11.250 V</td>
              <td style="color: #1d4ed8; font-weight: bold;">10.000 V (10 kV)</td>
              <td>60 s</td>
              <td align="right" style="font-weight: bold;">14 a 18 mA</td>
            </tr>
            <tr class="row-odd">
              <td style="font-weight: bold;">Classe 2</td>
              <td>17.000 V (17 kV)</td>
              <td>25.500 V</td>
              <td style="color: #1d4ed8; font-weight: bold;">20.000 V (20 kV)</td>
              <td>60 s</td>
              <td align="right" style="font-weight: bold;">16 a 20 mA</td>
            </tr>
            <tr class="row-even">
              <td style="font-weight: bold;">Classe 3</td>
              <td>26.500 V (26,5 kV)</td>
              <td>39.750 V</td>
              <td style="color: #1d4ed8; font-weight: bold;">30.000 V (30 kV)</td>
              <td>60 s</td>
              <td align="right" style="font-weight: bold;">18 a 22 mA</td>
            </tr>
            <tr class="row-odd">
              <td style="font-weight: bold;">Classe 4</td>
              <td>36.000 V (36 kV)</td>
              <td>54.000 V</td>
              <td style="color: #1d4ed8; font-weight: bold;">40.000 V (40 kV)</td>
              <td>60 s</td>
              <td align="right" style="font-weight: bold;">20 a 24 mA</td>
            </tr>
          </tbody>
        </table>

        <div class="page-break"></div>

        <!-- ====================================================== -->
        <!-- FOLHA 5: RELAÇÃO CONSOLIDADA DOS ENSAIOS               -->
        <!-- ====================================================== -->
        <table class="sheet-header" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-weight: bold; text-transform: uppercase; color: #1e293b;">4. Dossiê de Laudos dos Ensaios Realizados</td>
            <td align="right" style="color: #94a3b8; font-family: monospace;">${escapeXml(reportCode)}</td>
          </tr>
        </table>

        <div class="section-title">5. Relação Consolidada dos Ensaios (${total} itens)</div>

        <table class="data-table" width="100%" cellpadding="5" cellspacing="0" style="margin-top: 8px;">
          <thead>
            <tr class="table-header">
              <th width="5%">#</th>
              <th width="15%">TAG / ID</th>
              <th width="22%">Equipamento</th>
              <th width="10%">Classe</th>
              <th width="10%">Tensão</th>
              <th width="10%">Fuga (mA)</th>
              <th width="10%">Limite</th>
              <th width="8%" align="center">Status</th>
              <th width="10%" align="right">Laudo Nº</th>
            </tr>
          </thead>
          <tbody>
            ${tests.map((t, idx) => {
              const isApp = t.result === 'APROVADO';
              return `
                <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
                  <td align="center" style="color: #94a3b8;">${idx + 1}</td>
                  <td style="font-weight: bold; color: #0f172a;">${escapeXml(t.equipmentTag)}</td>
                  <td>${escapeXml(t.equipmentType.replace(/_/g, ' ').toUpperCase())}</td>
                  <td>Cl. ${escapeXml(t.equipmentClass || '0')}</td>
                  <td style="color: #1d4ed8; font-weight: bold;">${t.appliedVoltage_kV} kV</td>
                  <td style="font-weight: bold; font-family: monospace;">${(t.measuredLeakageCurrent_mA || 0).toFixed(1)} mA</td>
                  <td style="color: #64748b; font-size: 8pt;">&le; ${t.leakageCurrentLimit_mA || 12} mA</td>
                  <td align="center">
                    ${isApp ? '<span class="status-approved">APROVADO</span>' : '<span class="status-rejected">REPROVADO</span>'}
                  </td>
                  <td align="right" style="font-family: monospace; font-weight: bold; color: #475569;">${escapeXml(t.reportNumber)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="page-break"></div>

        <!-- ====================================================== -->
        <!-- FOLHA 6: ANÁLISE TÉCNICA, CONCLUSÃO & ASSINATURAS      -->
        <!-- ====================================================== -->
        <table class="sheet-header" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-weight: bold; text-transform: uppercase; color: #1e293b;">5. Análise dos Resultados, Conclusão & Assinaturas</td>
            <td align="right" style="color: #94a3b8; font-family: monospace;">${escapeXml(reportCode)}</td>
          </tr>
        </table>

        <div class="section-title">6. Análise Técnica dos Resultados Obtidos</div>

        <!-- STATS CARDS -->
        <table width="100%" cellpadding="6" cellspacing="8" style="margin-top: 8px;">
          <tr>
            <td width="33%" class="stat-card" align="center">
              <span class="stat-label">Total Ensaiado</span>
              <div class="stat-value">${total}</div>
              <span class="stat-sub">EPIs e EPCs</span>
            </td>
            <td width="33%" class="stat-card-app" align="center">
              <span class="stat-label-app">Aprovados</span>
              <div class="stat-value-app">${approved}</div>
              <span class="stat-sub-app">${approvalRate.toFixed(1)}% do lote</span>
            </td>
            <td width="34%" class="stat-card-rej" align="center">
              <span class="stat-label-rej">Reprovados</span>
              <div class="stat-value-rej">${rejected}</div>
              <span class="stat-sub-rej">${((rejected / (total || 1)) * 100).toFixed(1)}% do lote</span>
            </td>
          </tr>
        </table>

        <p class="body-p" style="margin-top: 12px;">${escapeXml(analysisText).replace(/\n/g, '<br/>')}</p>

        <div class="section-title" style="margin-top: 20px;">7. Conclusão Técnica e Recomendações</div>
        <p class="body-p">${escapeXml(conclusionText).replace(/\n/g, '<br/>')}</p>

        <!-- ASSINATURAS -->
        <table width="100%" cellpadding="8" cellspacing="12" style="margin-top: 30px;">
          <tr>
            <td width="50%" class="sig-box" align="center">
              <div class="sig-line">
                <span class="sig-cursive">${escapeXml(technicianName)}</span>
              </div>
              <p class="sig-name">${escapeXml(technicianName)}</p>
              <p class="sig-role">${escapeXml(technicianCreaOrCft)}</p>
              <p class="sig-sub">Executor do Ensaio Dielétrico</p>
            </td>
            <td width="50%" class="sig-box-rt" align="center">
              <div class="sig-line-rt">
                <span class="sig-cursive-rt">${escapeXml(techResponsibleName)}</span>
              </div>
              <p class="sig-name-rt">${escapeXml(techResponsibleName)}</p>
              <p class="sig-role-rt">Engenheiro Eletricista &bull; Responsável Técnico</p>
              <p class="sig-sub-rt">
                CREA: <strong>${escapeXml(techResponsibleCrea)}</strong> ${techResponsibleRnp ? `&bull; RNP: ${escapeXml(techResponsibleRnp)}` : ''}
              </p>
            </td>
          </tr>
        </table>

        <div class="footer-note">
          Emitido por ${escapeXml(company.name)} em ${formatDateBR(emissionDate)} &bull; Autenticidade garantida por chave criptográfica.
        </div>

        <!-- ====================================================== -->
        <!-- FOLHA 7+: ANEXO I - LAUDOS INDIVIDUAIS                 -->
        <!-- ====================================================== -->
        ${includeAnnex ? `
          <div class="page-break"></div>

          <table class="sheet-header" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-weight: bold; text-transform: uppercase; color: #1e293b;">Anexo I: Laudos Técnicos Individuais dos Ensaios Dielétricos</td>
              <td align="right" style="color: #94a3b8; font-family: monospace;">${escapeXml(reportCode)}</td>
            </tr>
          </table>

          <table class="title-banner" width="100%" cellpadding="10" cellspacing="0">
            <tr>
              <td>
                <div style="font-size: 8.5pt; font-weight: bold; color: #93c5fd; text-transform: uppercase; margin-bottom: 4px;">Anexo Oficial Integrado &bull; ${total} Laudos Técnicos Anexados</div>
                <div class="title-banner-main" style="font-size: 13pt;">${escapeXml(annexTitle)}</div>
                <div class="title-banner-sub">Dossiê completo contendo a íntegra de cada Certificado Individual de Ensaio Elétrico de Prova, com medições de corrente de fuga, inspeções visuais/pneumáticas, rastreabilidade metrológica e validação eletrônica.</div>
              </td>
            </tr>
          </table>

          <div class="section-title" style="margin-top: 18px;">Laudos Técnicos Individuais Integrados (${total})</div>

          ${tests.map((test, index) => {
            const isApp = test.result === 'APROVADO';
            return `
              <div class="annex-card" style="margin-bottom: 12px;">
                <table width="100%" cellpadding="4" cellspacing="0" style="border-bottom: 1px solid #cbd5e1; margin-bottom: 6px;">
                  <tr>
                    <td>
                      <span class="collaborator-number" style="background-color: #0f172a; width: 20px; height: 20px; font-size: 8pt;">${index + 1}</span>
                      <strong style="font-family: monospace; color: #1e3a8a; font-size: 9.5pt;">${escapeXml(test.reportNumber)}</strong>
                      <span style="color: #64748b; font-size: 8.5pt; margin-left: 8px;">TAG: <strong style="color: #0f172a;">${escapeXml(test.equipmentTag)}</strong></span>
                      <span style="font-size: 8pt; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Cl. ${escapeXml(test.equipmentClass || '0')}</span>
                    </td>
                    <td align="right">
                      ${isApp ? '<span class="status-approved">APROVADO</span>' : '<span class="status-rejected">REPROVADO</span>'}
                    </td>
                  </tr>
                </table>

                <table width="100%" cellpadding="4" cellspacing="4">
                  <tr>
                    <td width="25%" class="annex-info-cell">
                      <span class="annex-cell-label">Equipamento</span>
                      <p class="annex-cell-val">${escapeXml(test.equipmentType.replace(/_/g, ' ').toUpperCase())}</p>
                      <p class="annex-cell-sub">S/N: ${escapeXml(test.equipmentSerial || 'S/N')}</p>
                    </td>
                    <td width="25%" class="annex-info-cell">
                      <span class="annex-cell-label">Tensão de Prova</span>
                      <p class="annex-cell-val" style="color: #1e3a8a;">${test.appliedVoltage_kV} kV CA</p>
                      <p class="annex-cell-sub">Duração: ${test.applicationDurationSeconds || 60}s</p>
                    </td>
                    <td width="25%" class="annex-info-cell">
                      <span class="annex-cell-label">Corrente de Fuga</span>
                      <p class="annex-cell-val" style="color: ${isApp ? '#0f172a' : '#b91c1c'}; font-family: monospace;">${(test.measuredLeakageCurrent_mA || 0).toFixed(1)} mA</p>
                      <p class="annex-cell-sub">Limite: &le; ${test.leakageCurrentLimit_mA || 12} mA</p>
                    </td>
                    <td width="25%" class="annex-info-cell">
                      <span class="annex-cell-label">Validação & QR</span>
                      <p class="annex-cell-val" style="font-family: monospace; font-size: 8pt;">${escapeXml(test.validationCode || 'VAL-CERT')}</p>
                      <p class="annex-cell-sub" style="color: #047857; font-weight: bold;">Validade: ${formatDateBR(test.retestDueDate || emissionDate)}</p>
                    </td>
                  </tr>
                </table>

                ${test.resultRationale ? `
                  <div style="font-size: 8pt; color: #475569; background: #ffffff; padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 4px; margin-top: 4px;">
                    <strong>Parecer Técnico:</strong> ${escapeXml(test.resultRationale)}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}

          <div class="footer-note" style="margin-top: 14px;">
            Fim do Anexo I &bull; Todos os laudos individuais encontram-se vinculados ao Relatório Consolidado ${escapeXml(reportCode)}.
          </div>
        ` : ''}
      </div>
    `;
  }

  // Estilos CSS incorporados ao documento Word para renderização exata
  const wordDocumentHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${escapeXml(reportTitle)}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: 210mm 297mm;
          margin: 15mm 15mm 15mm 15mm;
          mso-header-margin: 36pt;
          mso-footer-margin: 36pt;
          mso-paper-source: 0;
        }
        div.Section1 {
          page: Section1;
        }
        body {
          font-family: 'Segoe UI', Calibri, Arial, sans-serif;
          font-size: 9.5pt;
          color: #0f172a;
          line-height: 1.4;
          background-color: #ffffff;
        }
        .report-container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }
        .header-table {
          border-bottom: 2pt solid #0f172a;
          margin-bottom: 12px;
        }
        .badge-lab {
          display: inline-block;
          background-color: #0f172a;
          color: #ffffff;
          font-size: 7.5pt;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.5pt;
          margin-bottom: 4px;
        }
        .company-title {
          font-size: 14pt;
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
          margin: 2px 0 4px 0;
          letter-spacing: -0.2pt;
        }
        .company-meta {
          font-size: 8.5pt;
          color: #475569;
          margin: 0 0 2px 0;
        }
        .company-sub {
          font-size: 8pt;
          color: #64748b;
          margin: 0;
        }
        .code-box {
          background-color: #f8fafc;
          border: 1pt solid #cbd5e1;
          border-radius: 6px;
        }
        .code-box-label {
          font-size: 7.5pt;
          font-weight: bold;
          color: #64748b;
          text-transform: uppercase;
        }
        .code-box-value {
          font-family: monospace;
          font-size: 12pt;
          font-weight: 900;
          color: #1e3a8a;
        }
        .code-box-sub {
          font-size: 8pt;
          color: #475569;
        }
        .title-banner {
          background-color: #0f172a;
          color: #ffffff;
          border-radius: 6px;
          margin: 10px 0 14px 0;
        }
        .title-banner-main {
          font-size: 11pt;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5pt;
          color: #ffffff;
        }
        .title-banner-sub {
          font-size: 8pt;
          color: #cbd5e1;
          margin-top: 2px;
        }
        .section-title {
          font-size: 9.5pt;
          font-weight: 900;
          color: #172554;
          text-transform: uppercase;
          border-bottom: 1.5pt solid #1e3a8a;
          padding-bottom: 3px;
          margin-top: 14px;
          margin-bottom: 8px;
          letter-spacing: 0.3pt;
        }
        .info-card {
          background-color: #f8fafc;
          border: 1pt solid #e2e8f0;
          border-radius: 6px;
          padding: 6px 8px;
        }
        .info-card-label {
          font-size: 7.5pt;
          font-weight: bold;
          color: #64748b;
          text-transform: uppercase;
          display: block;
        }
        .info-card-value {
          font-size: 9pt;
          font-weight: bold;
          color: #0f172a;
          margin: 2px 0 0 0;
        }
        .info-card-sub {
          font-size: 8pt;
          color: #475569;
          margin: 2px 0 0 0;
        }
        .summary-bar {
          background-color: #eff6ff;
          border: 1pt solid #bfdbfe;
          border-radius: 6px;
          margin-top: 8px;
          font-size: 8.5pt;
        }
        .badge-total {
          background-color: #1e3a8a;
          color: #ffffff;
          padding: 1px 6px;
          border-radius: 3px;
          font-weight: bold;
          font-size: 8pt;
        }
        .intro-p {
          font-size: 8.5pt;
          color: #334155;
          text-align: justify;
          margin: 4px 0 8px 0;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.5pt;
          margin-top: 6px;
        }
        .data-table th, .data-table td {
          border: 0.5pt solid #cbd5e1;
          padding: 4px 6px;
        }
        .table-header th {
          background-color: #0f172a;
          color: #ffffff;
          font-size: 8pt;
          font-weight: bold;
          text-transform: uppercase;
        }
        .table-sub-header th {
          background-color: #f1f5f9;
          color: #334155;
          font-size: 7.5pt;
          font-weight: bold;
          text-transform: uppercase;
        }
        .row-even {
          background-color: #ffffff;
        }
        .row-odd {
          background-color: #f8fafc;
        }
        .status-approved {
          background-color: #d1fae5;
          color: #065f46;
          font-size: 7.5pt;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 10px;
          display: inline-block;
          text-transform: uppercase;
        }
        .status-rejected {
          background-color: #fee2e2;
          color: #991b1b;
          font-size: 7.5pt;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 10px;
          display: inline-block;
          text-transform: uppercase;
        }
        .collaborator-header {
          background-color: #1e293b;
          color: #ffffff;
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
        }
        .collaborator-number {
          display: inline-block;
          width: 18px;
          height: 18px;
          background-color: #2563eb;
          color: #ffffff;
          text-align: center;
          line-height: 18px;
          font-size: 8.5pt;
          font-weight: bold;
          border-radius: 50%;
          margin-right: 6px;
        }
        .badge-count {
          background-color: #334155;
          color: #f1f5f9;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 8pt;
        }
        .badge-app {
          background-color: rgba(16, 185, 129, 0.2);
          color: #6ee7b7;
          border: 0.5pt solid #10b981;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
          font-size: 8pt;
          margin-left: 4px;
        }
        .badge-rej {
          background-color: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          border: 0.5pt solid #ef4444;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: bold;
          font-size: 8pt;
          margin-left: 4px;
        }
        .conformity-box {
          background-color: #f8fafc;
          border: 1pt solid #cbd5e1;
          border-radius: 6px;
          font-size: 8.5pt;
          color: #334155;
          text-align: justify;
        }
        .sig-box {
          background-color: transparent;
          border: none;
          padding: 8px;
        }
        .sig-box-rt {
          background-color: transparent;
          border: none;
          padding: 8px;
        }
        .sig-line {
          width: 180px;
          border-bottom: 1pt solid #94a3b8;
          margin: 8px auto 6px auto;
          padding-bottom: 2px;
        }
        .sig-line-rt {
          width: 180px;
          border-bottom: 1pt solid #1e3a8a;
          margin: 8px auto 6px auto;
          padding-bottom: 2px;
        }
        .sig-cursive {
          font-family: 'Times New Roman', serif;
          font-style: italic;
          color: #64748b;
          font-size: 9pt;
        }
        .sig-cursive-rt {
          font-family: 'Times New Roman', serif;
          font-style: italic;
          color: #1e3a8a;
          font-weight: bold;
          font-size: 9pt;
        }
        .sig-name {
          font-weight: 900;
          font-size: 9.5pt;
          color: #0f172a;
          margin: 0;
        }
        .sig-name-rt {
          font-weight: 900;
          font-size: 9.5pt;
          color: #172554;
          margin: 0;
        }
        .sig-role {
          font-size: 8.5pt;
          color: #475569;
          margin: 2px 0 0 0;
        }
        .sig-role-rt {
          font-size: 8.5pt;
          font-weight: bold;
          color: #334155;
          margin: 2px 0 0 0;
        }
        .sig-sub {
          font-size: 7.5pt;
          color: #94a3b8;
          margin: 2px 0 0 0;
        }
        .sig-sub-rt {
          font-size: 8pt;
          color: #475569;
          margin: 2px 0 0 0;
        }
        .footer-note {
          text-align: center;
          font-size: 7.5pt;
          color: #94a3b8;
          margin-top: 16px;
        }
        .page-break {
          page-break-before: always;
          mso-break-type: page-break;
        }
        .logo-box {
          width: 60px;
          height: 60px;
          background-color: #0a2540;
          color: #ffffff;
          font-size: 16pt;
          font-weight: 900;
          text-align: center;
          line-height: 60px;
          border-radius: 8px;
        }
        .cover-badge {
          display: inline-block;
          background-color: #eff6ff;
          border: 1pt solid #bfdbfe;
          color: #1d4ed8;
          font-size: 8.5pt;
          font-weight: 900;
          padding: 3px 12px;
          border-radius: 12px;
          text-transform: uppercase;
        }
        .cover-title {
          font-size: 18pt;
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
          margin: 12px 0 6px 0;
        }
        .cover-desc {
          font-size: 9pt;
          color: #475569;
          max-width: 500px;
          margin: 0 auto;
        }
        .tag-pill-dark {
          background-color: #0f172a;
          color: #ffffff;
          font-size: 8.5pt;
          font-weight: bold;
          padding: 3px 8px;
          border-radius: 4px;
          margin: 0 3px;
        }
        .tag-pill-orange {
          background-color: #ffedd5;
          color: #9a3412;
          border: 1pt solid #fed7aa;
          font-size: 8.5pt;
          font-weight: bold;
          padding: 3px 8px;
          border-radius: 4px;
          margin: 0 3px;
        }
        .tag-pill-amber {
          background-color: #fef3c7;
          color: #92400e;
          border: 1pt solid #fde68a;
          font-size: 8.5pt;
          font-weight: bold;
          padding: 3px 8px;
          border-radius: 4px;
          margin: 0 3px;
        }
        .info-card-full {
          background-color: #f8fafc;
          border: 1pt solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 8.5pt;
        }
        .info-card-header {
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
          border-bottom: 1pt solid #cbd5e1;
          padding-bottom: 4px;
          margin-bottom: 6px;
          font-size: 8.5pt;
        }
        .cover-footer {
          border-top: 1pt solid #cbd5e1;
          padding-top: 8px;
        }
        .sheet-header {
          border-bottom: 1pt solid #cbd5e1;
          padding-bottom: 4px;
          margin-bottom: 12px;
          font-size: 8.5pt;
        }
        .toc-card {
          background-color: #f8fafc;
          border: 1pt solid #cbd5e1;
          border-radius: 8px;
          padding: 10px;
        }
        .toc-title {
          font-weight: 900;
          color: #0f172a;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-size: 8.5pt;
        }
        .toc-table td {
          font-size: 8.5pt;
          border-bottom: 0.5pt dotted #cbd5e1;
          padding: 3px 0;
        }
        .toc-page {
          font-family: monospace;
          color: #64748b;
        }
        .body-p {
          font-size: 8.5pt;
          color: #334155;
          text-align: justify;
          line-height: 1.5;
        }
        .scope-box {
          background-color: #eff6ff;
          border: 1pt solid #bfdbfe;
          border-radius: 8px;
          padding: 8px 10px;
        }
        .scope-title {
          font-weight: 900;
          color: #172554;
          text-transform: uppercase;
          font-size: 8.5pt;
        }
        .method-card, .norm-card {
          background-color: #f8fafc;
          border: 1pt solid #e2e8f0;
          border-radius: 6px;
          padding: 6px 8px;
        }
        .stat-card {
          background-color: #f8fafc;
          border: 1pt solid #e2e8f0;
          border-radius: 6px;
          padding: 6px;
        }
        .stat-card-app {
          background-color: #ecfdf5;
          border: 1pt solid #a7f3d0;
          border-radius: 6px;
          padding: 6px;
        }
        .stat-card-rej {
          background-color: #fef2f2;
          border: 1pt solid #fecaca;
          border-radius: 6px;
          padding: 6px;
        }
        .stat-label { font-size: 7.5pt; text-transform: uppercase; font-weight: bold; color: #64748b; }
        .stat-label-app { font-size: 7.5pt; text-transform: uppercase; font-weight: bold; color: #047857; }
        .stat-label-rej { font-size: 7.5pt; text-transform: uppercase; font-weight: bold; color: #b91c1c; }
        .stat-value { font-size: 16pt; font-weight: 900; color: #0f172a; margin: 2px 0; }
        .stat-value-app { font-size: 16pt; font-weight: 900; color: #065f46; margin: 2px 0; }
        .stat-value-rej { font-size: 16pt; font-weight: 900; color: #991b1b; margin: 2px 0; }
        .stat-sub { font-size: 7.5pt; color: #94a3b8; }
        .stat-sub-app { font-size: 7.5pt; color: #059669; }
        .stat-sub-rej { font-size: 7.5pt; color: #dc2626; }
        .annex-card {
          background-color: #f8fafc;
          border: 1pt solid #cbd5e1;
          border-radius: 6px;
          padding: 8px;
        }
        .annex-info-cell {
          background-color: #ffffff;
          border: 0.5pt solid #e2e8f0;
          border-radius: 4px;
          padding: 4px 6px;
        }
        .annex-cell-label {
          font-size: 7pt;
          font-weight: bold;
          color: #94a3b8;
          text-transform: uppercase;
          display: block;
        }
        .annex-cell-val {
          font-size: 8.5pt;
          font-weight: bold;
          color: #0f172a;
          margin: 1px 0;
        }
        .annex-cell-sub {
          font-size: 7.5pt;
          color: #64748b;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        ${contentHtml}
      </div>
    </body>
    </html>
  `;

  // Nome do arquivo seguro
  const safeClient = sanitizeForFilename(clientName);
  const dateFormatted = new Date().toISOString().slice(0, 10);
  const filePrefix = format === 'simplificado' ? 'Relatorio_Simplificado_Ensaios' : 'Dossie_Consolidado_Ensaios';
  const filename = `${filePrefix}_${safeClient}_${dateFormatted}.doc`;

  // Salvar arquivo localmente no navegador / dispositivo
  await saveFileLocally({
    filename,
    data: wordDocumentHtml,
    mimeType: 'application/msword;charset=utf-8',
    title: `${reportTitle} - ${clientName}`,
    category: 'relatorio_os',
    openAfterSave: false,
    cacheOffline: true
  });
}

/**
 * Gera e exporta um Laudo Técnico Individual no formato Microsoft Word (.doc/.docx),
 * reproduzindo com fidelidade absoluta o layout, tipografia, cores (#0A2540),
 * cabeçalho institucional, identificador oficial, badges de ART, grid de 3 colunas,
 * sub-tabelas de ferramentas e Tabela 4 da NBR 16295, velocímetros/gauges metrológicos,
 * checklist de inspeção visual, parecer conclusivo com prazos, bloco de 3 colunas de assinaturas
 * com QR Code digital e anexo de evidências fotográficas em alta resolução.
 */
export async function exportSingleLaudoToWord(test: TestRecord, companyInfo?: CompanyLabInfo): Promise<void> {
  if (!test) throw new Error('Dados do ensaio não fornecidos para exportação.');

  const company = companyInfo || DielectricStorageService.getCompanyInfo();
  const clients = DielectricStorageService.getClients();
  const workOrders = DielectricStorageService.getWorkOrders();
  const allUsers = DielectricStorageService.getUsers();
  const equipments = DielectricStorageService.getEquipment();

  const matchingClient = clients.find(c => c.id === test.clientId || c.razaoSocial === test.clientName);
  const matchingOS = workOrders.find(os => os.id === test.serviceOrderId || os.osNumber === test.serviceOrderNumber);
  const matchedEquip = equipments.find(e => e.id === test.equipmentId || e.tag === test.equipmentTag);

  const clientName = matchingClient?.razaoSocial || test.clientName || 'Cliente Geral';
  const effectiveArtNumber = test.artNumber || matchingOS?.artNumber || '';
  const isApproved = test.result === 'APROVADO';

  // 1. Logo da Empresa ou Badge JVM
  const companyLogoUrl = company.logoUrl ? await loadImageAsDataUrl(company.logoUrl) : '';

  // 2. QR Code de Validação Pública
  const validationUrl = ValidationPortalService.buildPublicValidationUrl(test.validationCode);
  const qrDataUrl = await generateQRCodeDataUrl(validationUrl);

  // 3. Assinaturas Transparentes e Tratadas
  const techUser = allUsers.find(u => u.id === test.technicianId || u.name === test.technicianName);
  const rtUser = allUsers.find(u => u.id === test.techResponsibleId || u.name === test.techResponsibleName || u.role === 'responsavel_tecnico');

  const rawTechSig = test.technicianSignature?.signatureImage || techUser?.signatureUrl || '';
  const rawRTSig = test.techResponsibleSignature?.signatureImage || rtUser?.signatureUrl || company.technicalResponsible?.signatureUrl || '';

  const cleanedTechSig = rawTechSig ? await cleanSignatureImage(rawTechSig) : '';
  const cleanedRTSig = rawRTSig ? await cleanSignatureImage(rawRTSig) : '';

  const techSigUrl = cleanedTechSig ? await loadImageAsDataUrl(cleanedTechSig) : '';
  const rtSigUrl = cleanedRTSig ? await loadImageAsDataUrl(cleanedRTSig) : '';

  // 4. Detalhes do Equipamento e Normas
  const isGlove = Boolean(test.equipmentType === 'luva_isolante' || test.gloveLength_mm);
  const selectedGloveClass = (test.equipmentClass || '0').trim();
  const selectedGloveLength = getClosestGloveLength(test.gloveLength_mm || 360);
  const gloveTableEntry = TABELA_4_NBR_16295.find(r => r.classe === selectedGloveClass);
  const normLeakageLimit = (isGlove && gloveTableEntry && gloveTableEntry.limitesFugaAC_mA[selectedGloveLength] !== null)
    ? gloveTableEntry.limitesFugaAC_mA[selectedGloveLength]! * 2
    : test.equipmentType === 'tapete_isolante'
    ? (test.leakageCurrentLimit_mA || 100)
    : (test.leakageCurrentLimit_mA || 10);
  const normApplicableDisplay = isGlove
    ? (test.normCode && (test.normCode.includes('16295') || test.normCode.includes('16259') || test.normCode.includes('IEC 60903')) ? 'NBR 16295 Tabela 4' : (test.normCode || 'NBR 16295 Tabela 4'))
    : (test.normCode || 'Norma Geral NR-10');

  // 5. Gauges / Velocímetros Gráficos
  const appliedV = test.appliedVoltage_kV || 0;
  const voltageScale = Math.max(15, Math.ceil(appliedV * 1.35 / 5) * 5);
  const leakVal = test.measuredLeakageCurrent_mA || 0;
  const effectiveLimit = normLeakageLimit || test.leakageCurrentLimit_mA || 10;
  const leakScale = Math.max(10, Math.ceil(Math.max(effectiveLimit * 1.35, leakVal * 1.25) / 5) * 5);
  const leakPercent = ((leakVal / effectiveLimit) * 100).toFixed(1);
  const isLeakOk = leakVal <= effectiveLimit;

  const gaugeVoltageDataUrl = generateGaugeCanvasDataUrl({
    title: 'Tensão de Ensaio Aplicada',
    value: appliedV,
    unit: `kV ${test.voltageType || 'CA'}`,
    maxScale: voltageScale,
    type: 'voltage',
    statusLabel: 'TENSÃO DE PROVA NOMINAL',
    subtext: `Duração: ${test.applicationDurationSeconds}s contínuos (${test.voltageType})`
  });

  const gaugeLeakageDataUrl = generateGaugeCanvasDataUrl({
    title: 'Corrente de Fuga Medida',
    value: leakVal,
    unit: test.currentUnit || 'mA',
    maxScale: leakScale,
    limit: effectiveLimit,
    isConforming: isLeakOk,
    type: 'current',
    statusLabel: isLeakOk ? 'CONFORME (ABAIXO DO LIMITE)' : 'NÃO CONFORME (ULTRAPASSOU)',
    subtext: `Limite Máximo Normativo: ${effectiveLimit} mA (${leakPercent}% atingido)`
  });

  // 6. Evidências Fotográficas
  const loadedPhotos = (test.photos && test.photos.length > 0)
    ? await Promise.all(
        test.photos.map(async (ph) => ({
          ...ph,
          dataUrl: await loadImageAsDataUrl(ph.url)
        }))
      )
    : [];

  const technicianName = test.technicianName || techUser?.name || 'Técnico Executor';
  const technicianCreaOrCft = test.technicianCftOrCrea || techUser?.creaOrCft || 'Inspetor Dielétrico • Executor';
  const techResponsibleName = test.techResponsibleName || rtUser?.name || company.technicalResponsible.name;
  const techResponsibleCrea = test.techResponsibleCrea || rtUser?.creaOrCft || company.technicalResponsible.creaNumber;
  const techResponsibleRnp = company.technicalResponsible.rnp || '';

  const emissionDate = test.testDate || new Date().toISOString().slice(0, 10);
  const testTime = test.testTime || '09:00';
  const tempC = test.environmental?.temperatureC ?? 23.5;
  const humPct = test.environmental?.relativeHumidityPercent ?? 58;

  // 7. Grid de Dados de Identificação (3 colunas, idêntico ao PDF)
  const clientFields: Array<{ label: string; value: string; isHighlight?: boolean; isMono?: boolean }> = [
    { label: 'Cliente:', value: nc(test.clientName), isHighlight: true },
    { label: 'Ordem de Serviço (OS):', value: nc(test.serviceOrderNumber), isHighlight: true, isMono: true },
    { label: 'Local do Ensaio:', value: nc(test.location, 'Laboratório Móvel JVM') },
    { label: 'Tipo de Equipamento:', value: test.equipmentType.replace(/_/g, ' ').toUpperCase(), isHighlight: true },
    { label: 'Tag / Patrimônio:', value: nc(test.equipmentTag), isHighlight: true, isMono: true },
    { label: 'Classe Dielétrica:', value: `Classe ${test.equipmentClass}`, isHighlight: true },
    { label: 'Nº de Série:', value: nc(test.equipmentSerial), isMono: true },
    { label: 'Certificado de Aprovação (CA):', value: nc(test.equipmentCa) },
    ...(test.equipmentType === 'luva_isolante' || test.gloveLength_mm
      ? [{ label: 'Comprimento da Luva (NBR 16295):', value: `${test.gloveLength_mm || 360} mm`, isMono: true, isHighlight: true }]
      : test.blanketDimensions
      ? [{ label: 'Dimensões da Manta:', value: nc(test.blanketDimensions) }]
      : test.mattingDimensions
      ? [{ label: 'Dimensões do Tapete:', value: nc(test.mattingDimensions) }]
      : [{ label: 'Comprimento / Dimensão:', value: test.gloveLength_mm ? `${test.gloveLength_mm} mm` : 'N/C' }]
    )
  ];

  if (test.blanketStyle) {
    clientFields.push({
      label: 'Estilo da Manta (ASTM D1048):',
      value: `${test.blanketStyle} ${test.blanketType ? `• ${test.blanketType}` : ''}`
    });
  }
  if (test.blanketDimensions && test.equipmentType !== 'manta_isolante') {
    clientFields.push({ label: 'Dimensões da Manta:', value: nc(test.blanketDimensions) });
  }
  if (test.flashoverClearance_mm) {
    clientFields.push({ label: 'Folga Anti-Flashover:', value: `${test.flashoverClearance_mm} mm`, isMono: true });
  }
  if (test.mattingSurface) {
    clientFields.push({ label: 'Superfície do Tapete (ASTM D178):', value: nc(test.mattingSurface) });
  }
  if (test.mattingThickness_mm !== undefined) {
    const astm = getASTMD178Entry(test.equipmentClass);
    const minStr = astm ? ` (Mín. Tab 2: ${astm.espessuraMinima_mm} mm)` : '';
    clientFields.push({
      label: 'Espessura Medida do Tapete:',
      value: `${test.mattingThickness_mm} mm${minStr}`,
      isMono: true
    });
  }
  if (test.mattingDimensions && test.equipmentType !== 'tapete_isolante') {
    clientFields.push({ label: 'Dimensões do Tapete:', value: nc(test.mattingDimensions) });
  }
  if (effectiveArtNumber) {
    clientFields.push({ label: 'Nº da ART (CREA/CFT):', value: nc(effectiveArtNumber), isHighlight: true, isMono: true });
  }

  // Preencher células para fechar múltiplo de 3
  while (clientFields.length % 3 !== 0) {
    clientFields.push({ label: '', value: '' });
  }

  // Colaborador / Usuário
  clientFields.push(
    { label: 'Colaborador / Usuário:', value: nc(test.collaboratorName || matchingOS?.collaboratorName), isHighlight: true },
    { label: 'Matrícula Funcional:', value: nc(test.collaboratorRegistration || matchingOS?.collaboratorRegistration), isMono: true },
    { label: 'Setor / Lotação:', value: nc(test.collaboratorSector || matchingOS?.collaboratorSector) }
  );

  // 8. Checklist de Inspeção Visual
  const checkList = test.visualInspection && test.visualInspection.length > 0
    ? test.visualInspection
    : [
        { id: '1', item: 'Furos, cortes, rasgos ou perfurações na superfície', status: 'conforme' as const },
        { id: '2', item: 'Deformações, bolhas, trincas ou rachaduras por ozônio', status: 'conforme' as const },
        { id: '3', item: 'Ressecamento, endurecimento ou perda de elasticidade', status: 'conforme' as const },
        { id: '4', item: 'Isenção de contaminação condutiva, óleo, graxa ou partículas', status: 'conforme' as const },
        { id: '5', item: 'Legibilidade das inscrições obrigatórias, Classe, Tag e CA', status: 'conforme' as const }
      ];

  // 9. Ferramentas Isoladas
  const hasIsolatedTools = Boolean(test.isolatedTools && test.isolatedTools.length > 0);
  const totalTools = hasIsolatedTools ? test.isolatedTools!.reduce((s, i) => s + (Number(i.quantity) || 1), 0) : 0;
  const approvedTools = hasIsolatedTools ? test.isolatedTools!.filter(t => (t.result || 'APROVADO') === 'APROVADO').length : 0;
  const rejectedTools = hasIsolatedTools ? test.isolatedTools!.filter(t => t.result === 'REPROVADO').length : 0;

  const hasDualOpinions = test.equipmentType === 'ferramenta_isolada' && test.isolatedTools && 
    test.isolatedTools.some(t => (t.result || 'APROVADO') === 'APROVADO' && t.visualInspection !== 'nao_conforme' && t.dielectricResult !== 'nao_conforme') &&
    test.isolatedTools.some(t => t.result === 'REPROVADO' || t.visualInspection === 'nao_conforme' || t.dielectricResult === 'nao_conforme');

  const approvedToolsList = test.isolatedTools?.filter(t => (t.result || 'APROVADO') === 'APROVADO' && t.visualInspection !== 'nao_conforme' && t.dielectricResult !== 'nao_conforme') || [];
  const reprovedToolsList = test.isolatedTools?.filter(t => t.result === 'REPROVADO' || t.visualInspection === 'nao_conforme' || t.dielectricResult === 'nao_conforme') || [];

  // Endereço formatado da empresa
  const addressLine = [
    company.address,
    company.number && !company.address?.includes(company.number) ? company.number : '',
    company.neighborhood && !company.address?.includes(company.neighborhood) ? company.neighborhood : '',
    company.city ? `${company.city} - ${company.state || 'SP'}` : company.cityState,
    company.cep ? `CEP: ${company.cep}` : ''
  ].filter(Boolean).join(' • ');

  // Medições Elétricas
  const measurementRows: Array<{
    param: string;
    norm: string;
    measured: string;
    isConforming: boolean;
  }> = [
    {
      param: 'Tensão de Ensaio Aplicada',
      norm: isGlove 
        ? `${gloveTableEntry ? gloveTableEntry.tensaoProvaAC_kV.toFixed(1) : test.appliedVoltage_kV.toFixed(1)} kV CA (Tab. 4 - Cl. ${selectedGloveClass})` 
        : `${test.appliedVoltage_kV} kV (${test.voltageType}) – ${normApplicableDisplay}`,
      measured: `${test.appliedVoltage_kV} kV ${test.voltageType}`,
      isConforming: true
    },
    {
      param: 'Tempo de Aplicação da Tensão',
      norm: isGlove 
        ? '60 segundos contínuos (ABNT NBR 16295 / IEC 60903)' 
        : `${test.applicationDurationSeconds} segundos contínuos (${normApplicableDisplay})`,
      measured: `${test.applicationDurationSeconds} s`,
      isConforming: true
    },
    {
      param: 'Corrente de Fuga',
      norm: isGlove 
        ? `Máximo ${normLeakageLimit} mA (Tab. 4 - Cl. ${selectedGloveClass} / ${selectedGloveLength} mm)` 
        : test.equipmentType === 'tapete_isolante'
        ? `Máximo ${normLeakageLimit} mA (Limite adotado – ASTM D178-22)`
        : test.equipmentType === 'ferramenta_isolada'
        ? `Máximo ${test.leakageCurrentLimit_mA} mA (${(test.isolatedTools?.reduce((acc, t) => acc + (Number(t.quantity) || 1), 0) || 1)} un x 1,0 mA - NBR 9699)`
        : `Máximo ${test.leakageCurrentLimit_mA} ${test.currentUnit} (${normApplicableDisplay})`,
      measured: `${test.measuredLeakageCurrent_mA} ${test.currentUnit}`,
      isConforming: test.measuredLeakageCurrent_mA <= normLeakageLimit
    },
    {
      param: 'Rigidez / Suportabilidade à Perfuração',
      norm: isGlove 
        ? `Sem disrupção (Tab. 4 - Rigidez: ${gloveTableEntry ? gloveTableEntry.tensaoRigidezAC_kV.toFixed(1) + ' kV CA' : 'NBR 16295'})` 
        : `Sem disrupção, perfuração ou centelhamento (${normApplicableDisplay})`,
      measured: test.withstandWithoutPuncture ? 'Sem perfuração dielétrica' : 'Ocorreu disrupção',
      isConforming: test.withstandWithoutPuncture
    }
  ];

  if (test.equipmentType === 'tapete_isolante' && test.mattingThickness_mm !== undefined) {
    const astm = getASTMD178Entry(test.equipmentClass);
    const minReq = astm ? astm.espessuraMinima_mm : 3.2;
    measurementRows.push({
      param: 'Espessura Físico-Mecânica (ASTM D178-22)',
      norm: `Mínimo de ${minReq} mm (Tabela 2 - Classe ${test.equipmentClass})`,
      measured: `${test.mattingThickness_mm} mm`,
      isConforming: test.mattingThickness_mm >= minReq
    });
  }

  // Montagem do HTML Word MSO Compliant
  const wordDocumentHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Laudo Técnico - ${escapeXml(test.reportNumber)}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: 21.0cm 29.7cm;
          margin: 1.0cm 1.2cm 1.2cm 1.2cm;
          mso-header-margin: 0.8cm;
          mso-footer-margin: 0.8cm;
          mso-paper-source: 0;
        }
        div.Section1 {
          page: Section1;
          font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          font-size: 8pt;
          color: #0F172A;
          line-height: 1.3;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
        }
        td {
          padding: 0;
          vertical-align: middle;
        }
        .header-table {
          width: 100%;
          margin-bottom: 6px;
        }
        .company-name {
          font-size: 11pt;
          font-weight: bold;
          color: #0A2540;
          letter-spacing: 0.3px;
          margin-bottom: 1px;
        }
        .company-legal {
          font-size: 7.5pt;
          color: #475569;
          margin-bottom: 1px;
        }
        .company-meta {
          font-size: 7pt;
          color: #64748B;
        }
        .official-id-card {
          background-color: #F8FAFC;
          border: 1px solid #CBD5E1;
          border-radius: 4px;
          padding: 6px 10px;
          text-align: right;
        }
        .section-header {
          background-color: #0A2540;
          color: #FFFFFF;
          font-size: 7.5pt;
          font-weight: bold;
          text-transform: uppercase;
          padding: 3.5px 8px;
          margin-top: 7px;
          margin-bottom: 4px;
          border-radius: 2px;
        }
        .grid-table {
          width: 100%;
          border: 1px solid #CBD5E1;
          background-color: #F8FAFC;
          border-radius: 3px;
          margin-bottom: 5px;
        }
        .grid-cell {
          padding: 3px 6px;
          border-bottom: 1px solid #E2E8F0;
          border-right: 1px solid #E2E8F0;
          vertical-align: top;
        }
        .grid-label {
          font-size: 6pt;
          color: #64748B;
          text-transform: uppercase;
          font-weight: normal;
          margin-bottom: 1px;
        }
        .grid-value {
          font-size: 7.5pt;
          font-weight: bold;
          color: #0F172A;
        }
        .grid-value-highlight {
          color: #1D4ED8;
        }
        .data-table {
          width: 100%;
          border: 1px solid #CBD5E1;
          margin-bottom: 5px;
        }
        .data-table th {
          background-color: #E2E8F0;
          color: #0A2540;
          font-size: 7pt;
          font-weight: bold;
          padding: 3.5px 6px;
          border: 1px solid #CBD5E1;
          text-align: left;
        }
        .data-table td {
          font-size: 7pt;
          padding: 3px 6px;
          border: 1px solid #E2E8F0;
        }
        .badge-conforme {
          background-color: #D1FAE5;
          color: #065F46;
          font-weight: bold;
          font-size: 6pt;
          padding: 1.5px 5px;
          border-radius: 3px;
          display: inline-block;
          text-align: center;
        }
        .badge-nao-conforme {
          background-color: #FEE2E2;
          color: #991B1B;
          font-weight: bold;
          font-size: 6pt;
          padding: 1.5px 5px;
          border-radius: 3px;
          display: inline-block;
          text-align: center;
        }
        .badge-appr {
          background-color: #10B981;
          color: #FFFFFF;
          font-weight: bold;
          font-size: 6.5pt;
          padding: 1.5px 6px;
          border-radius: 2px;
          display: inline-block;
        }
        .badge-repr {
          background-color: #EF4444;
          color: #FFFFFF;
          font-weight: bold;
          font-size: 6.5pt;
          padding: 1.5px 6px;
          border-radius: 2px;
          display: inline-block;
        }
        .conclusion-box-approved {
          background-color: #ECFDF5;
          border: 1.5px solid #10B981;
          border-radius: 4px;
          padding: 6px 10px;
          margin-bottom: 6px;
        }
        .conclusion-box-reproved {
          background-color: #FEF2F2;
          border: 1.5px solid #EF4444;
          border-radius: 4px;
          padding: 6px 10px;
          margin-bottom: 6px;
        }
        .sig-block {
          text-align: center;
          padding: 4px 6px;
        }
        .sig-line {
          border-top: 1px solid #CBD5E1;
          margin-top: 4px;
          padding-top: 3px;
        }
        .photo-card {
          border: 1px solid #CBD5E1;
          background-color: #FFFFFF;
          border-radius: 4px;
          margin-bottom: 8px;
        }
        .photo-header {
          background-color: #0A2540;
          color: #FFFFFF;
          font-size: 6.5pt;
          font-weight: bold;
          padding: 3px 6px;
        }
        .footer-bar {
          border-top: 1px solid #CBD5E1;
          padding-top: 4px;
          margin-top: 8px;
          font-size: 6.5pt;
          color: #64748B;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="Section1">

        <!-- ================= CABEÇALHO PRINCIPAL DA EMPRESA ================= -->
        <table class="header-table" cellpadding="0" cellspacing="0">
          <tr>
            <!-- Lado Esquerdo: Logotipo / Badge JVM e Dados Cadastrais -->
            <td width="65%" valign="middle">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td width="55" valign="middle" style="padding-right: 8px;">
                    ${companyLogoUrl ? `
                      <img src="${companyLogoUrl}" style="max-height: 48px; max-width: 55px; border-radius: 3px;" alt="Logo" />
                    ` : `
                      <div style="background-color: #0A2540; color: #FFFFFF; font-weight: bold; font-size: 13pt; width: 48px; height: 44px; line-height: 44px; text-align: center; border-radius: 4px;">
                        JVM
                      </div>
                    `}
                  </td>
                  <td valign="middle">
                    <div class="company-name">${escapeXml(company.name.toUpperCase())}</div>
                    <div class="company-legal">${escapeXml(company.legalName || 'JVM ENGENHARIA E TREINAMENTOS LTDA')}</div>
                    <div class="company-meta">
                      ${escapeXml(company.creaCompanyRegister || 'CREA-SP nº 2026/SP-LAB')} &bull; CNPJ: ${escapeXml(company.cnpj)}<br/>
                      ${escapeXml(addressLine)} &bull; Tel: ${escapeXml(company.phone)} &bull; ${escapeXml(company.email)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>

            <!-- Lado Direito: Identificador Oficial e Metadados do Laudo -->
            <td width="35%" valign="middle" align="right">
              <div class="official-id-card">
                <div style="font-size: 5.5pt; font-weight: bold; color: #64748B; text-transform: uppercase;">IDENTIFICADOR OFICIAL</div>
                <div style="font-size: 11pt; font-weight: bold; color: #1D4ED8; font-family: monospace;">${escapeXml(test.reportNumber)}</div>
                <div style="font-size: 7.5pt; font-weight: bold; color: #0F172A; margin: 1px 0;">OS: ${escapeXml(test.serviceOrderNumber)}</div>
                ${effectiveArtNumber ? `
                  <div style="background-color: #FEF3C7; border: 0.5pt solid #F59E0B; color: #92400E; font-size: 6.5pt; font-weight: bold; padding: 1.5px 5px; border-radius: 3px; display: inline-block; margin: 1.5px 0;">
                    ART: ${escapeXml(effectiveArtNumber)}
                  </div>
                ` : ''}
                <div style="font-size: 6pt; color: #64748B; margin-top: 1px;">
                  Emissão: ${formatDateBR(test.testDate)} às ${testTime}
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Linha divisória naval -->
        <div style="height: 2px; background-color: #0A2540; margin-bottom: 5px;"></div>

        <!-- ================= SEÇÃO 1: IDENTIFICAÇÃO DO CLIENTE E DO EQUIPAMENTO ================= -->
        <table width="100%" class="section-header" cellpadding="0" cellspacing="0">
          <tr>
            <td align="left" style="color: #FFFFFF; font-weight: bold;">1. Identificação do Cliente e do Equipamento Dielétrico</td>
            <td align="right" style="color: #FFFFFF; font-size: 6.5pt;">Data do Ensaio: ${formatDateBR(test.testDate)}</td>
          </tr>
        </table>

        <!-- Grid de 3 Colunas Estruturado -->
        <table class="grid-table" cellpadding="0" cellspacing="0">
          ${(() => {
            let htmlRows = '';
            for (let i = 0; i < clientFields.length; i += 3) {
              const chunk = clientFields.slice(i, i + 3);
              htmlRows += '<tr>';
              chunk.forEach((field, cIdx) => {
                const borderRight = cIdx < 2 ? 'border-right: 1px solid #CBD5E1;' : '';
                htmlRows += `
                  <td width="33.33%" class="grid-cell" style="${borderRight}">
                    <div class="grid-label">${escapeXml(field.label)}</div>
                    <div class="grid-value ${field.isHighlight && field.label.includes('Tag') ? 'grid-value-highlight' : ''}">${escapeXml(field.value || '—')}</div>
                  </td>
                `;
              });
              htmlRows += '</tr>';
            }
            return htmlRows;
          })()}
        </table>

        <!-- Sub-tabela de Ferramentas Manuais Isoladas (se houver) -->
        ${hasIsolatedTools ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FFF7ED; border: 1px solid #FED7AA; border-radius: 3px; margin: 4px 0 2px 0; padding: 4px 6px;">
            <tr>
              <td align="left">
                <strong style="color: #7C2D12; font-size: 7.5pt;">&bull; Discriminação e Avaliação Individual das Ferramentas Manuais Isoladas (NBR 9699 / IEC 60900)</strong><br/>
                <span style="font-size: 6pt; color: #9A3412;">Ensaio de rigidez dielétrica individual aplicado a 10,0 kV CA e inspeção visual de integridade</span>
              </td>
              <td align="right" style="font-size: 6.5pt; font-weight: bold; color: #9A3412;">
                Total: ${totalTools} un | ${approvedTools} Aprovada(s) ${rejectedTools > 0 ? `| ${rejectedTools} Reprovada(s)` : ''}
              </td>
            </tr>
          </table>

          <table class="data-table" cellpadding="0" cellspacing="0">
            <tr style="background-color: #FED7AA;">
              <th width="4%" style="text-align: center;">#</th>
              <th width="28%">Ferramenta & Especificação</th>
              <th width="16%">Fabricante</th>
              <th width="7%" style="text-align: center;">Qtd</th>
              <th width="12%" style="text-align: center;">Insp. Visual</th>
              <th width="12%" style="text-align: center;">Ensaio 10kV</th>
              <th width="10%" style="text-align: center;">Parecer</th>
              <th width="11%">Observações</th>
            </tr>
            ${test.isolatedTools!.map((tool, idx) => {
              const isToolAppr = (tool.result || 'APROVADO') === 'APROVADO';
              const rowBg = isToolAppr ? (idx % 2 === 1 ? '#FFFFFF' : '#FFFDFB') : '#FEF2F2';
              const isVisualOk = tool.visualInspection !== 'nao_conforme';
              const isDielectricOk = tool.dielectricResult !== 'nao_conforme';
              const formattedName = formatToolDisplayName(tool.toolName, tool.toolType);
              const cleanSpec = (tool.sizeOrSpec || '').trim().replace(/_/g, ' ');
              const toolSpec = cleanSpec ? `${formattedName} (${cleanSpec})` : formattedName;
              return `
                <tr style="background-color: ${rowBg};">
                  <td align="center">${idx + 1}</td>
                  <td><strong>${escapeXml(toolSpec)}</strong></td>
                  <td>${escapeXml(tool.manufacturer || '—')}</td>
                  <td align="center">${tool.quantity} un</td>
                  <td align="center">
                    <span class="${isVisualOk ? 'badge-conforme' : 'badge-nao-conforme'}">${isVisualOk ? 'Conforme' : 'Não Conf.'}</span>
                  </td>
                  <td align="center">
                    <span class="${isDielectricOk ? 'badge-conforme' : 'badge-nao-conforme'}">${isDielectricOk ? 'Conforme' : 'Disrupção'}</span>
                  </td>
                  <td align="center">
                    <span class="${isToolAppr ? 'badge-appr' : 'badge-repr'}">${isToolAppr ? 'APROVADO' : 'REPROVADO'}</span>
                  </td>
                  <td style="font-size: 6pt; color: #64748B;">${escapeXml(tool.defectReason || (isToolAppr ? 'Aprovado sem restrições' : 'Não atendeu NBR 9699'))}</td>
                </tr>
              `;
            }).join('')}
          </table>
        ` : ''}

        <!-- ================= SEÇÃO 2: REFERÊNCIA NORMATIVA E CONDIÇÕES AMBIENTAIS ================= -->
        <table width="100%" class="section-header" cellpadding="0" cellspacing="0">
          <tr>
            <td align="left" style="color: #FFFFFF; font-weight: bold;">2. Referência Normativa e Condições Ambientais</td>
          </tr>
        </table>

        <table class="grid-table" cellpadding="0" cellspacing="0">
          <tr>
            <td width="35%" class="grid-cell" style="border-right: 1px solid #CBD5E1;">
              <div class="grid-label">Norma Regulamentadora / Técnica:</div>
              <div class="grid-value">${escapeXml(normApplicableDisplay)}</div>
            </td>
            <td width="25%" class="grid-cell" style="border-right: 1px solid #CBD5E1;">
              <div class="grid-label">Procedimento de Ensaio:</div>
              <div class="grid-value">${escapeXml(test.procedureCode || 'PR-JVM-LAB-01')}</div>
            </td>
            <td width="20%" class="grid-cell" style="border-right: 1px solid #CBD5E1;">
              <div class="grid-label">Temperatura Ambiente:</div>
              <div class="grid-value">${tempC} °C</div>
            </td>
            <td width="20%" class="grid-cell">
              <div class="grid-label">Umidade Relativa:</div>
              <div class="grid-value">${humPct} % UR</div>
            </td>
          </tr>
        </table>

        <!-- TABELA 4 DA ABNT NBR 16295 (PARA LUVAS ISOLANTES) -->
        ${isGlove ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 3px; margin: 4px 0 2px 0; padding: 3px 6px;">
            <tr>
              <td align="left" style="color: #1E3A8A; font-size: 6.5pt; font-weight: bold;">
                &bull; TABELA 4 DA ABNT NBR 16295 / IEC 60903 – ENSAIOS DE PROVA E RIGIDEZ DIELÉTRICA
              </td>
              <td align="right" style="color: #1D4ED8; font-size: 6pt; font-weight: bold; background-color: #DBEAFE; padding: 1.5px 5px; border-radius: 2px;">
                Luva Ensaiada: Classe ${selectedGloveClass} - ${selectedGloveLength} mm
              </td>
            </tr>
          </table>

          <table class="data-table" cellpadding="0" cellspacing="0">
            <tr style="background-color: #E0E7FF;">
              <th width="12%" style="text-align: center;">Classe</th>
              <th width="14%" style="text-align: center;">Tensão Máx. Uso</th>
              <th width="14%" style="text-align: center;">Tensão Prova CA</th>
              <th width="12%" style="text-align: center;">280 mm</th>
              <th width="12%" style="text-align: center;">360 mm</th>
              <th width="12%" style="text-align: center;">410 mm</th>
              <th width="12%" style="text-align: center;">&ge; 460 mm</th>
              <th width="14%" style="text-align: center;">Tensão Rigidez</th>
            </tr>
            ${TABELA_4_NBR_16295.filter(r => r.classe === selectedGloveClass).map(row => {
              const lengths = [280, 360, 410, 460] as const;
              return `
                <tr style="background-color: #DBEAFE; font-weight: bold; color: #1E3A8A;">
                  <td align="center">Classe ${row.classe}</td>
                  <td align="center">${row.tensaoMaximaUsoAC_kV.toFixed(1)} kV</td>
                  <td align="center">${row.tensaoProvaAC_kV.toFixed(1)} kV</td>
                  ${lengths.map(len => {
                    const val = row.limitesFugaAC_mA[len];
                    const isTarget = selectedGloveLength === len && val !== null;
                    return `
                      <td align="center" style="${isTarget ? 'background-color: #1D4ED8; color: #FFFFFF; border-radius: 2px;' : ''}">
                        ${val !== null ? `${isTarget ? `${val * 2} mA [2 Luvas]` : `${val} mA`}` : 'N/a'}
                      </td>
                    `;
                  }).join('')}
                  <td align="center">${row.tensaoRigidezAC_kV.toFixed(1)} kV</td>
                </tr>
              `;
            }).join('')}
          </table>
          <div style="font-size: 5.5pt; color: #64748B; margin-bottom: 5px;">
            Critério Operativo: Luva Classe ${selectedGloveClass} (${selectedGloveLength} mm) &rarr; Tensão de Prova: ${test.appliedVoltage_kV} kV CA | Limite Máximo de Fuga: ${test.leakageCurrentLimit_mA || normLeakageLimit} mA (Dobro da Tabela 4 por ensaio simultâneo de 2 luvas na cuba).
          </div>
        ` : ''}

        <!-- ================= SEÇÃO 3: PARÂMETROS E RESULTADOS DAS MEDIÇÕES ELÉTRICAS ================= -->
        <table width="100%" class="section-header" cellpadding="0" cellspacing="0">
          <tr>
            <td align="left" style="color: #FFFFFF; font-weight: bold;">3. Parâmetros e Resultados das Medições Elétricas</td>
          </tr>
        </table>

        <!-- Gauges / Velocímetros Metrológicos -->
        ${(gaugeVoltageDataUrl && gaugeLeakageDataUrl) ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 4px 0 6px 0;">
            <tr>
              <td width="50%" align="center" style="padding-right: 4px;">
                <img src="${gaugeVoltageDataUrl}" style="width: 100%; max-width: 320px; border-radius: 4px; border: 1px solid #CBD5E1;" alt="Velocímetro Tensão" />
              </td>
              <td width="50%" align="center" style="padding-left: 4px;">
                <img src="${gaugeLeakageDataUrl}" style="width: 100%; max-width: 320px; border-radius: 4px; border: 1px solid #CBD5E1;" alt="Velocímetro Corrente" />
              </td>
            </tr>
          </table>
        ` : ''}

        <!-- Tabela de Medições Elétricas -->
        <table class="data-table" cellpadding="0" cellspacing="0">
          <tr style="background-color: #E2E8F0;">
            <th width="30%">Parâmetro de Ensaio</th>
            <th width="35%">Exigência Normativa</th>
            <th width="20%">Valor Medido</th>
            <th width="15%" style="text-align: center;">Avaliação</th>
          </tr>
          ${measurementRows.map((r, idx) => `
            <tr style="background-color: ${idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
              <td>${escapeXml(r.param)}</td>
              <td><strong>${escapeXml(r.norm)}</strong></td>
              <td style="color: #1D4ED8; font-weight: bold;">${escapeXml(r.measured)}</td>
              <td align="center">
                <span class="${r.isConforming ? 'badge-conforme' : 'badge-nao-conforme'}">
                  ${r.isConforming ? 'CONFORME' : 'NÃO CONFORME'}
                </span>
              </td>
            </tr>
          `).join('')}
        </table>

        <!-- ================= SEÇÃO 4: INSPEÇÃO VISUAL E FÍSICO-MECÂNICA ================= -->
        <table width="100%" class="section-header" cellpadding="0" cellspacing="0">
          <tr>
            <td align="left" style="color: #FFFFFF; font-weight: bold;">4. Inspeção Visual e Físico-Mecânica</td>
          </tr>
        </table>

        <table class="grid-table" cellpadding="0" cellspacing="0">
          ${(() => {
            let chkHtml = '';
            for (let i = 0; i < checkList.length; i += 2) {
              const chunk = checkList.slice(i, i + 2);
              chkHtml += '<tr>';
              chunk.forEach((chk, cIdx) => {
                const borderRight = cIdx === 0 ? 'border-right: 1px solid #CBD5E1;' : '';
                const isConforme = chk.status === 'conforme';
                chkHtml += `
                  <td width="50%" class="grid-cell" style="${borderRight}">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="left" style="font-size: 6.8pt; color: #0F172A;">${escapeXml(chk.item)}</td>
                        <td align="right" width="70">
                          <span class="${isConforme ? 'badge-conforme' : 'badge-nao-conforme'}">
                            ${isConforme ? 'CONFORME' : 'NÃO CONF.'}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                `;
              });
              if (chunk.length === 1) {
                chkHtml += '<td width="50%" class="grid-cell"></td>';
              }
              chkHtml += '</tr>';
            }
            return chkHtml;
          })()}
        </table>

        <!-- ================= SEÇÃO 5: PARECER TÉCNICO CONCLUSIVO ================= -->
        ${hasDualOpinions ? `
          <table width="100%" class="section-header" cellpadding="0" cellspacing="0">
            <tr>
              <td align="left" style="color: #FFFFFF; font-weight: bold;">5. Pareceres Técnicos Conclusivos (Emissão Dupla - Aprovadas & Reprovadas)</td>
              <td align="right" style="color: #FFFFFF; font-size: 6.5pt;">Lote Misto: ${approvedToolsList.length} Aprovada(s) / ${reprovedToolsList.length} Reprovada(s)</td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">
            <tr>
              <td width="49%" valign="top" class="conclusion-box-approved">
                <div style="color: #065F46; font-weight: bold; font-size: 8pt; margin-bottom: 3px;">
                  PARECER 1: APROVADAS (${approvedToolsList.length} un)
                </div>
                <div style="font-size: 6.8pt; color: #0F172A; line-height: 1.35;">
                  ${escapeXml(test.approvedOpinion || `As ${approvedToolsList.length} ferramenta(s) aprovadas foram ensaiadas individualmente a 10.000 V CA por 180s (NBR 9699 / IEC 60900), apresentando plena integridade da isolação e suportabilidade dielétrica sem perfuração.`)}
                </div>
                ${approvedToolsList.length > 0 ? `
                  <div style="margin-top: 4px; font-weight: bold; font-size: 6.5pt; color: #065F46;">Itens Homologados e Aptos:</div>
                  <div style="font-size: 6pt; color: #334155;">
                    ${approvedToolsList.map(t => `&bull; ${t.quantity}x ${escapeXml(t.toolName)}${t.sizeOrSpec ? ` (${escapeXml(t.sizeOrSpec)})` : ''} - ${escapeXml(nc(t.manufacturer))}`).join('<br/>')}
                  </div>
                ` : ''}
                <div style="border-top: 1px solid #A7F3D0; margin-top: 5px; padding-top: 3px; font-weight: bold; font-size: 6.8pt; color: #065F46;">
                  Validade: ${formatDateBR(test.retestDueDate)} (12 meses)
                </div>
              </td>

              <td width="2%"></td>

              <td width="49%" valign="top" class="conclusion-box-reproved">
                <div style="color: #991B1B; font-weight: bold; font-size: 8pt; margin-bottom: 3px;">
                  PARECER 2: REPROVADAS (${reprovedToolsList.length} un)
                </div>
                <div style="font-size: 6.8pt; color: #0F172A; line-height: 1.35;">
                  ${escapeXml(test.reprovedOpinion || `As ${reprovedToolsList.length} ferramenta(s) reprovadas NÃO atenderam aos critérios da NBR 9699 / IEC 60900. Determinada segregação imediata, etiqueta vermelha e descarte/destruição compulsória conforme NR-10.`)}
                </div>
                ${reprovedToolsList.length > 0 ? `
                  <div style="margin-top: 4px; font-weight: bold; font-size: 6.5pt; color: #991B1B;">Itens Condenados / Motivo de Avaria:</div>
                  <div style="font-size: 6pt; color: #334155;">
                    ${reprovedToolsList.map(t => `&bull; ${t.quantity}x ${escapeXml(t.toolName)}: ${escapeXml(t.defectReason || 'Reprovado no ensaio 10kV / visual')}`).join('<br/>')}
                  </div>
                ` : ''}
                <div style="border-top: 1px solid #FECACA; margin-top: 5px; padding-top: 3px; font-weight: bold; font-size: 6.8pt; color: #991B1B;">
                  Ação: Segregação & Descarte NR-10
                </div>
              </td>
            </tr>
          </table>
        ` : `
          <div class="${isApproved ? 'conclusion-box-approved' : 'conclusion-box-reproved'}">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="left">
                  <div style="font-size: 8.5pt; font-weight: bold; color: ${isApproved ? '#065F46' : '#991B1B'}; margin-bottom: 3px;">
                    5. PARECER TÉCNICO CONCLUSIVO: ${isApproved ? 'APROVADO' : 'REPROVADO'}${
                      test.equipmentType === 'ferramenta_isolada' && test.isolatedTools && test.isolatedTools.length > 0
                        ? ` (${test.isolatedTools.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} FERRAMENTAS ISOLADAS)`
                        : ''
                    }
                  </div>
                  <div style="font-size: 7.2pt; color: #0F172A; line-height: 1.4;">
                    ${escapeXml(test.resultRationale || (
                      isApproved
                        ? 'O equipamento inspecionado atende rigorosamente aos requisitos das normas técnicas aplicáveis e da NR-10 do Ministério do Trabalho, estando plenamente APROVADO e liberado para uso em intervenções em instalações elétricas energizadas.'
                        : 'O equipamento NÃO atingiu os parâmetros de rigidez dielétrica exigidos pelas normas técnicas, apresentando não conformidade que compromete a segurança do operador. Fica REPROVADO e interditado para uso.'
                    ))}
                  </div>
                  ${(test.equipmentType === 'ferramenta_isolada' && test.isolatedTools && test.isolatedTools.length > 0) ? `
                    <div style="margin-top: 4px; font-size: 6.5pt; font-weight: bold; color: ${isApproved ? '#065F46' : '#991B1B'};">
                      Itens ensaiados (${test.isolatedTools.reduce((s, i) => s + (Number(i.quantity) || 1), 0)} un):
                      ${escapeXml(test.isolatedTools.map(t => `${t.quantity}x ${t.toolName}${t.sizeOrSpec ? ` (${t.sizeOrSpec})` : ''} [${nc(t.manufacturer)}]`).join(', '))}
                    </div>
                  ` : ''}
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid ${isApproved ? '#A7F3D0' : '#FECACA'}; margin-top: 6px; padding-top: 4px;">
              <tr>
                <td align="left" style="font-size: 7.2pt; font-weight: bold; color: #0F172A;">
                  Validade do Ensaio / Próximo Reensaio Obrigatório:
                </td>
                <td align="right">
                  <span style="background-color: #FFFFFF; border: 1px solid #CBD5E1; color: #1D4ED8; font-weight: bold; font-size: 7.8pt; padding: 2px 8px; border-radius: 3px;">
                    ${formatDateBR(test.retestDueDate)}
                  </span>
                </td>
              </tr>
            </table>
          </div>
        `}

        <!-- ================= SEÇÃO 6: ASSINATURAS E VALIDAÇÃO DIGITAL (3 COLUNAS) ================= -->
        <table width="100%" cellpadding="4" cellspacing="8" style="margin-top: 8px;">
          <tr>
            <!-- Coluna 1: Analista Executor -->
            <td width="33%" class="sig-block" valign="bottom">
              ${techSigUrl ? `
                <img src="${techSigUrl}" style="max-height: 40px; max-width: 140px; margin-bottom: 2px;" alt="Assinatura Executor" /><br/>
              ` : `
                <div style="height: 35px; line-height: 35px; font-style: italic; font-size: 6.5pt; color: #64748B;">
                  Assinatura Eletrônica Registrada
                </div>
              `}
              <div class="sig-line">
                <strong style="font-size: 7.5pt; color: #0F172A;">${escapeXml(technicianName)}</strong><br/>
                <span style="font-size: 6.5pt; color: #64748B;">${escapeXml(technicianCreaOrCft)}</span>
              </div>
            </td>

            <!-- Coluna 2: Responsável Técnico -->
            <td width="33%" class="sig-block" valign="bottom">
              ${rtSigUrl ? `
                <img src="${rtSigUrl}" style="max-height: 40px; max-width: 140px; margin-bottom: 2px;" alt="Assinatura RT" /><br/>
              ` : `
                <div style="height: 35px; line-height: 35px; font-style: italic; font-size: 6.5pt; color: #64748B;">
                  Assinatura Eletrônica Registrada
                </div>
              `}
              <div class="sig-line">
                <strong style="font-size: 7.5pt; color: #0F172A;">${escapeXml(techResponsibleName)}</strong><br/>
                <span style="font-size: 6.5pt; color: #64748B;">
                  ${escapeXml(techResponsibleCrea)} ${techResponsibleRnp ? `&bull; RNP: ${escapeXml(techResponsibleRnp)}` : ''} &bull; Responsável Técnico
                </span>
              </div>
            </td>

            <!-- Coluna 3: Validação Digital QR Code -->
            <td width="33%" class="sig-block" valign="bottom" align="center">
              ${qrDataUrl ? `
                <img src="${qrDataUrl}" style="width: 48px; height: 48px; margin-bottom: 2px;" alt="QR Code Validação" /><br/>
              ` : ''}
              <div style="font-size: 5.5pt; font-weight: bold; color: #64748B; text-transform: uppercase;">VALIDAÇÃO DIGITAL</div>
              <div style="font-size: 6.5pt; font-weight: bold; color: #1D4ED8; font-family: monospace;">${escapeXml(test.validationCode || 'VAL-CERT')}</div>
            </td>
          </tr>
        </table>

        <!-- ================= SEÇÃO 7: REGISTRO FOTOGRÁFICO NA PÁGINA 02 EM DIANTE (4 FOTOS POR PÁGINA) ================= -->
        ${loadedPhotos.length > 0 ? (() => {
          let allPhotoPagesHtml = '';
          const catMap: Record<string, string> = {
            antes: '1. INSPEÇÃO VISUAL PRELIMINAR',
            durante: '2. ENSAIO HIPOT / ALTA TENSÃO',
            depois: '3. INSPEÇÃO PÓS-ENSAIO',
            disrupcao: '4. DISRUPÇÃO / AVARIA / DEFEITO',
            outro: 'EVIDÊNCIA FOTOGRÁFICA'
          };

          for (let pageBatch = 0; pageBatch < loadedPhotos.length; pageBatch += 4) {
            const pagePhotos = loadedPhotos.slice(pageBatch, pageBatch + 4);
            const pageNum = Math.floor(pageBatch / 4) + 1;
            const totalPages = Math.ceil(loadedPhotos.length / 4);

            allPhotoPagesHtml += `
              <br clear="all" style="page-break-before: always; mso-break-type: section-break;" />
              
              <table width="100%" class="section-header" cellpadding="0" cellspacing="0" style="margin-top: 10px;">
                <tr>
                  <td align="left" style="color: #FFFFFF; font-weight: bold;">7. Registro Fotográfico do Ensaio Dielétrico (Anexo)</td>
                  <td align="right" style="color: #FFFFFF; font-size: 6.5pt;">
                    ${totalPages > 1 ? `Fotos ${pageBatch + 1} a ${Math.min(pageBatch + 4, loadedPhotos.length)} de ${loadedPhotos.length} (Página ${pageNum}/${totalPages})` : `${loadedPhotos.length} registro(s) anexado(s)`}
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="4" cellspacing="6">
            `;

            for (let r = 0; r < pagePhotos.length; r += 2) {
              const rowChunk = pagePhotos.slice(r, r + 2);
              allPhotoPagesHtml += '<tr>';
              rowChunk.forEach((ph) => {
                const catTitle = catMap[ph.category] || ph.category.toUpperCase();
                const photoTime = ph.timestamp ? new Date(ph.timestamp).toLocaleString('pt-BR') : formatDateBR(test.testDate);
                allPhotoPagesHtml += `
                  <td width="50%" valign="top">
                    <table width="100%" class="photo-card" cellpadding="0" cellspacing="0">
                      <tr>
                        <td class="photo-header">${escapeXml(catTitle)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px; text-align: center; background-color: #F8FAFC;">
                          ${ph.dataUrl ? `
                            <img src="${ph.dataUrl}" style="max-width: 100%; max-height: 220px; border-radius: 2px;" alt="Foto" />
                          ` : '<div style="height: 120px; line-height: 120px; color: #94A3B8;">Imagem indisponível</div>'}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 6px; border-top: 1px solid #E2E8F0; font-size: 6.8pt; color: #0F172A;">
                          ${escapeXml(ph.caption || 'Registro fotográfico da inspeção / ensaio dielétrico.')}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 2px 6px 4px 6px; font-size: 5.5pt; color: #64748B;">
                          ${photoTime} &bull; ${escapeXml(ph.userName || test.technicianName)}
                        </td>
                      </tr>
                    </table>
                  </td>
                `;
              });
              if (rowChunk.length === 1) {
                allPhotoPagesHtml += '<td width="50%" valign="top"></td>';
              }
              allPhotoPagesHtml += '</tr>';
            }

            allPhotoPagesHtml += '</table>';
          }
          return allPhotoPagesHtml;
        })() : ''}

        <!-- ================= RODAPÉ OFICIAL ================= -->
        <div class="footer-bar">
          Documento emitido eletronicamente pela plataforma JVM Dielectric Lab &bull; Chave: <strong>${escapeXml(test.validationCode || 'VAL-CERT')}</strong> &bull; 
          Hash: ${escapeXml(test.documentHash ? test.documentHash.substring(0, 24) : 'SEC-JVM-2026')}... &bull; Emitido em ${formatDateBR(emissionDate)} &bull; Documento protegido contra alterações.
        </div>

      </div>
    </body>
    </html>
  `;

  const safeReportNum = sanitizeForFilename(test.reportNumber || 'Laudo');
  const safeClient = sanitizeForFilename(clientName);
  const filename = `Laudo_Tecnico_${safeReportNum}_${safeClient}.doc`;

  await saveFileLocally({
    filename,
    data: wordDocumentHtml,
    mimeType: 'application/msword;charset=utf-8',
    title: `Laudo Técnico ${test.reportNumber} - ${clientName}`,
    category: 'laudo',
    openAfterSave: false,
    cacheOffline: true
  });
}

function escapeXml(unsafe: string = ''): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
