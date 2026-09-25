export type UserRole = 'admin' | 'responsavel_tecnico' | 'tecnico' | 'administrativo' | 'cliente';

export interface Company {
  id: string;
  name: string; // Nome fantasia (ex: JVM Engenharia & Treinamentos)
  legalName: string; // Razão Social
  tradeName?: string;
  cnpj: string;
  inscricaoEstadual?: string;
  creaCompanyRegister?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  active: boolean;
  technicalResponsible?: {
    name: string;
    title: string;
    creaNumber: string;
    rnp: string;
    signatureUrl?: string;
  };
  certificateEmissionSettings?: CertificateEmissionSettings;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  companyId: string; // ID da empresa/laboratório vinculado
  companyName?: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  creaOrCft?: string;
  cargo?: string;
  registrationNumber?: string;
  isMasterAdmin?: boolean;
  phone?: string;
  active?: boolean;
  avatarUrl?: string;
  signatureUrl?: string;
  customSettings?: {
    defaultValidityMonths?: number;
    climateLimits?: {
      tempMin?: number;
      tempMax?: number;
      humidityMax?: number;
    };
  };
}

export type EquipmentStatus = 
  | 'em_uso' 
  | 'disponivel' 
  | 'em_manutencao' 
  | 'reprovado' 
  | 'descartado' 
  | 'fora_de_servico';

export type DielectricClass = '00' | '0' | '1' | '2' | '3' | '4';

export type EquipmentType =
  | 'luva_isolante'
  | 'manga_isolante'
  | 'bota_dielétrica'
  | 'capacete_classe_b'
  | 'manta_isolante'
  | 'tapete_isolante'
  | 'escada_isolada'
  | 'bastao_manobra'
  | 'vara_manobra'
  | 'ponteira_prova'
  | 'detector_tensao'
  | 'ferramenta_isolada'
  | 'outro';

export interface IsolatedToolItem {
  id: string;
  toolType: 
    | 'chave_fenda' 
    | 'chave_philips' 
    | 'alicate_universal' 
    | 'alicate_corte' 
    | 'alicate_bico' 
    | 'chave_inglesa' 
    | 'chave_ajustavel'
    | 'chave_estrela_boca'
    | 'arco_serra_isolado'
    | 'chave_allen'
    | 'chave_boca'
    | 'chave_canhao'
    | 'faca_isolada'
    | 'chave_bit_isolado'
    | 'detector_tensao_caneta'
    | 'outro';
  toolName: string; // Ex: 'Chave de Fenda Isolada 1000V', 'Chave Arco Serra com Cabo Isolado', etc.
  quantity: number;
  manufacturer: string; // Ex: 'Gedore', 'Tramontina Pro', 'Belzer', 'Klein Tools', 'Knipex VDE'
  sizeOrSpec?: string; // Ex: '1/8 x 4"', 'PH2 x 6"', '8 polegadas', '10mm', 'Lâmina 12"'
  serialNumber?: string;
  nominalVoltage?: string; // Ex: '1.000 Vca / 1.500 Vcc (NBR 9699 / IEC 60900)'
  result?: 'APROVADO' | 'REPROVADO' | 'PENDENTE';
  visualInspection?: 'conforme' | 'nao_conforme';
  dielectricResult?: 'conforme' | 'nao_conforme';
  measuredLeakage_mA?: number;
  defectReason?: string; // Ex: 'Trinca na camada isolante', 'Fissura na empunhadura', 'Perfuração dielétrica a 10kV'
}

export interface Equipment {
  id: string;
  companyId?: string;
  uuid: string;
  type: EquipmentType;
  customTypeName?: string;
  tag: string;
  qrCode: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetNumber?: string; // Patrimônio
  dielectricClass: string; // Ex: '00', '0', '1', '2', '3', '4'
  sizeOrLength?: string; // Ex: 'Tamanho 9,5' ou '3,5 metros'
  gloveLength_mm?: number; // Ex: 280, 360, 410, 460 (NBR 16295)
  blanketType?: 'Type I' | 'Type II'; // ASTM D1048
  blanketStyle?: 'Style A' | 'Style B' | 'Style C' | 'Style D'; // ASTM D1048
  blanketDimensions?: string; // Ex: '910x910 mm'
  mattingSurface?: 'Corrugada' | 'Xadrez' | 'Lisa'; // ASTM D178
  mattingThickness_mm?: number; // ASTM D178
  mattingDimensions?: string; // Ex: '1,0m x 2,0m'
  ladderType?: 'extensivel' | 'simples' | 'tesoura' | 'plataforma' | 'linha_viva'; // ABNT IEC 61478 / NBR 16308
  ladderRungsCount?: number; // Ex: 20 degraus (2x10)
  ladderLengthExtended_m?: number; // Ex: 6.00 m
  ladderLengthClosed_m?: number; // Ex: 3.60 m
  ladderLoadCapacity_kg?: number; // Ex: 120 ou 150 kg (NBR 16308)
  caNumber?: string; // Certificado de Aprovação MTE
  clientId: string;
  clientName?: string;
  serviceOrderId?: string; // Ordem de Serviço vinculada
  serviceOrderNumber?: string; // Número da OS vinculada (ex: OS-2026-0001)
  collaboratorName?: string; // Nome / Colaborador atribuído
  collaboratorRegistration?: string; // Matrícula funcional do colaborador
  collaboratorSector?: string; // Setor / Lotação do colaborador
  sector?: string;
  location?: string;
  isolatedTools?: IsolatedToolItem[]; // Ferramentas manuais isoladas vinculadas ao kit/lote
  acquisitionDate?: string;
  firstTestDate?: string;
  lastTestDate?: string;
  nextTestDueDate?: string;
  retestIntervalMonths: number; // Ex: 6 meses (NR-10 / NBR 10622)
  status: EquipmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  syncVersion?: number;
  deviceId?: string;
}

export interface Client {
  id: string;
  companyId?: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual?: string;
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
  whatsapp?: string;
  email: string;
  responsavel: string;
  cargoResponsavel: string;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // Exclusão lógica (propagada ao Supabase)
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export type ServiceOrderStatus = 
  | 'aberta' 
  | 'agendada' 
  | 'em_execucao' 
  | 'aguardando' 
  | 'concluida' 
  | 'cancelada';

export interface ServiceOrder {
  id: string;
  companyId?: string;
  osNumber: string; // Ex: 'OS-2608-0001'
  clientId: string;
  clientName?: string;
  openDate: string;
  scheduledDate?: string;
  expectedDate?: string;
  responsibleId: string;
  responsibleName?: string;
  technicianId: string;
  technicianName?: string;
  collaboratorName?: string; // Nome / Colaborador
  collaboratorRegistration?: string; // Matrícula funcional
  collaboratorSector?: string; // Setor / Lotação
  equipmentIds: string[];
  notes?: string;
  artNumber?: string; // Anotação de Responsabilidade Técnica (Ex: ART-CREA-2026-98124)
  artFileUrl?: string; // Documento da ART anexado (PDF ou Imagem)
  artFileName?: string; // Nome original do arquivo da ART
  status: ServiceOrderStatus;
  deletedAt?: string; // Soft delete timestamp
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface LabInstrument {
  id: string;
  companyId?: string;
  type: string; // Ex: 'Hipot CA/CC', 'Megômetro', 'Termohigrômetro Digital', 'Microohmímetro'
  manufacturer: string;
  model: string;
  serialNumber: string;
  assetNumber?: string;
  measurementRange: string; // Ex: '0 a 50 kV CA / 0 a 70 kV CC'
  calibrationCertNumber: string;
  calibrationDate: string;
  calibrationExpiryDate: string;
  calibratingLab: string; // Ex: 'Laboratório RBC Acreditado'
  certFileUrl?: string;
  certFileName?: string;
  imageUrl?: string;
  maxVoltageCapacity_kV?: number;
  active: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string; // Exclusão lógica (propagada ao Supabase)
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

export interface NormCriterion {
  id: string;
  companyId?: string;
  normCode: string; // Ex: 'ABNT NBR 10622', 'IEC 60903', 'ASTM D120'
  normName: string; // Ex: 'Luvas de Material Isolante para Trabalhos em Tensão'
  editionOrVersion: string; // Ex: '2023'
  effectiveDate: string;
  applicableEquipmentTypes: EquipmentType[];
  dielectricClass: string; // Ex: '00', '0', '1', '2', '3', '4'
  nominalVoltageMaxAC_kV: number; // Ex: 0.5, 1.0, 7.5, 17.0, 26.5, 36.0
  nominalVoltageMaxDC_kV: number; // Ex: 0.75, 1.5, 11.25, 25.5, 39.75, 54.0
  testVoltage_kV: number; // Ex: 2.5, 5.0, 10.0, 20.0, 30.0, 40.0
  voltageType: 'AC' | 'DC';
  testDurationSeconds: number; // Ex: 60 ou 180 s
  maxLeakageCurrent: number; // Ex: 12.0, 14.0, 16.0, 18.0
  currentUnit: 'mA' | 'uA';
  gloveLengthLimits?: Record<number, number | null>; // NBR 16295 Tab. 4: { 280: 10, 360: 12, 410: null, 460: null }
  breakdownVoltage_kV?: number; // Tensão de rigidez dielétrica da Tabela 4
  defaultRetestMonths: number; // Ex: 6 meses
  approvalCriterion: 'visual_and_leakage' | 'withstand_without_perforation' | 'dielectric_breakdown';
  notes?: string;
  status: 'active' | 'archived';
  deletedAt?: string;
  history?: Array<{
    date: string;
    user: string;
    changeDescription: string;
  }>;
}

export interface ChecklistItem {
  id: string;
  item: string; // Ex: 'Furos, rasgos ou cortes', 'Rachaduras e ressecamento', 'Contaminação/graxa'
  status: 'conforme' | 'nao_conforme' | 'nao_aplicavel';
  observation?: string;
  photoUrl?: string;
}

export interface TestPhoto {
  id: string;
  category: 'antes' | 'durante' | 'apos' | 'identificacao' | 'defeito' | 'medicao' | 'equipamento_teste';
  url: string; // Base64 or object URL
  caption: string;
  timestamp: string;
  userName: string;
  gpsCoords?: {
    latitude: number;
    longitude: number;
  };
}

export type TestResult = 'APROVADO' | 'REPROVADO' | 'PENDENTE';

export interface EnvironmentalConditions {
  temperatureC: number;
  relativeHumidityPercent: number;
  pressureHPa?: number;
  observedConditions?: string; // Ex: 'Ambiente controlado de laboratório'
  instrumentUsedId?: string;
  instrumentUsedName?: string;
  measurementDateTime: string;
}

export interface TestRecord {
  id: string;
  companyId?: string;
  companyName?: string;
  uuid: string;
  testNumber: string; // Ex: 'ENS-2608-0001'
  reportNumber: string; // Ex: 'LAU-2608-0001'
  certificateNumber?: string; // Ex: 'CERT-2608-0001'
  clientId: string;
  clientName: string;
  collaboratorName?: string; // Nome / Colaborador
  collaboratorRegistration?: string; // Matrícula funcional
  collaboratorSector?: string; // Setor / Lotação
  equipmentId: string;
  equipmentTag: string;
  equipmentType: EquipmentType;
  equipmentClass: string;
  equipmentSerial: string;
  equipmentCa?: string;
  isolatedTools?: IsolatedToolItem[]; // Composição do conjunto de ferramentas manuais isoladas
  serviceOrderId: string;
  serviceOrderNumber: string;
  artNumber?: string; // Anotação de Responsabilidade Técnica da OS (Ex: ART-CREA-SP-2026-9812401)
  technicianId: string;
  technicianName: string;
  technicianCftOrCrea?: string;
  techResponsibleId: string;
  techResponsibleName: string;
  techResponsibleCrea: string;
  testDate: string;
  testTime: string;
  location: string; // Ex: 'Laboratório Central JVM' ou 'Em campo - Subestação Cliente'
  
  // Norm reference
  normCriterionId?: string;
  normCode: string;
  procedureCode?: string;
  appliedClass: string;
  
  // Measurements
  appliedVoltage_kV: number;
  voltageType: 'AC' | 'DC';
  applicationDurationSeconds: number;
  measuredLeakageCurrent_mA: number;
  leakageCurrentLimit_mA: number;
  currentUnit: string;
  withstandWithoutPuncture: boolean;
  gloveLength_mm?: number; // 280, 360, 410, 460
  gloveTestMethod?: 'ensaio_prova' | 'rigidez_dieletrica';
  moistureConditioning?: boolean; // Nota c da Tab 4 (+2mA)
  blanketType?: 'Type I' | 'Type II'; // ASTM D1048
  blanketStyle?: 'Style A' | 'Style B' | 'Style C' | 'Style D'; // ASTM D1048
  blanketDimensions?: string;
  mattingSurface?: 'Corrugada' | 'Xadrez' | 'Lisa'; // ASTM D178
  mattingThickness_mm?: number;
  mattingDimensions?: string;
  testElectrodeType?: string; // Ex: 'Eletrodos Planos Metálicos (ASTM D1048 / D178)'
  flashoverClearance_mm?: number;
  dielectricBreakdownVoltage_kV?: number;
  ladderType?: 'extensivel' | 'simples' | 'tesoura' | 'plataforma' | 'linha_viva';
  ladderTestMethod?: 'segmento_300mm_100kv' | 'montante_metro_90kv' | 'entre_degraus_30kv' | 'linha_viva_integral';
  ladderSegmentLength_mm?: number;
  ladderTestedSegmentsCount?: number;
  ladderRungsInspectedCount?: number;
  ladderLengthExtended_m?: number;
  ladderLoadCapacity_kg?: number;
  ladderMoistureConditioned?: boolean;
  
  // Environmental
  environmental: EnvironmentalConditions;
  
  // Visual Inspection
  visualInspection: ChecklistItem[];
  visualInspectionPassed: boolean;
  
  // Test Instruments Used
  instrumentsUsed: Array<{
    id: string;
    type: string;
    model: string;
    serialNumber: string;
    calibrationCert: string;
    calibrationExpiry: string;
    isCalibrationValid: boolean;
  }>;
  calibrationOverrideAuthorizedBy?: string; // If calibration was expired but authorized by RT
  
  // Overall result
  result: TestResult;
  resultRationale: string;
  approvedOpinion?: string;
  reprovedOpinion?: string;
  toolsEvaluation?: {
    totalTools: number;
    approvedCount: number;
    reprovedCount: number;
    canEmitPartialCertificate?: boolean;
    reprovedItems: Array<{ name: string; reason: string; quantity: number }>;
    approvedItems?: Array<{ name: string; quantity: number }>;
    approvedOpinion?: string;
    reprovedOpinion?: string;
  };
  technicalNotes?: string;
  retestDueDate: string;
  
  // Photographic evidence
  photos: TestPhoto[];
  oscillogramImage?: string;
  waveformImage?: string;
  
  // Signatures
  technicianSignature?: {
    signatureImage: string;
    userName: string;
    userRole: string;
    documentNumber?: string;
    signedAt: string;
  };
  techResponsibleSignature?: {
    signatureImage: string;
    userName: string;
    userRole: string;
    documentNumber?: string;
    signedAt: string;
  };
  clientSignature?: {
    signatureImage: string;
    userName: string;
    documentNumber?: string;
    signedAt: string;
  };
  
  // Validation
  validationCode: string; // Hash / code for public verification
  documentHash: string; // SHA-256 equivalent
  qrCodeDataUrl?: string;
  
  // Sync
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  syncStatus: 'synced' | 'pending' | 'conflict';
  syncVersion: number;
  deviceId: string;
}

export interface AuditLog {
  id: string;
  companyId?: string;
  action: 
    | 'LOGIN' 
    | 'LOGOUT' 
    | 'CADASTRO' 
    | 'ALTERACAO' 
    | 'EXCLUSAO' 
    | 'ENSAIO_CRIADO' 
    | 'APROVACAO' 
    | 'REPROVACAO' 
    | 'EMISSAO_CERTIFICADO' 
    | 'CANCELAMENTO' 
    | 'SINCRONIZACAO' 
    | 'ALTERACAO_CRITERIOS';
  userName: string;
  userRole: string;
  dateTime: string;
  ipAddress: string;
  device: string;
  entityType: string;
  entityId: string;
  description: string;
  previousValue?: string;
  newValue?: string;
}

export interface SyncConflict {
  id: string;
  entityType: 'client' | 'equipment' | 'service_order' | 'test' | 'norm';
  entityId: string;
  entityName: string;
  createdAt: string;
  deviceA: {
    deviceId: string;
    deviceName: string;
    updatedAt: string;
    userName: string;
    data: any;
  };
  deviceB: {
    deviceId: string;
    deviceName: string;
    updatedAt: string;
    userName: string;
    data: any;
  };
  resolved: boolean;
  resolvedAt?: string;
  resolutionChoice?: 'keep_a' | 'keep_b' | 'merge';
}

export interface CertificateEmissionSettings {
  defaultEmissionMode: 'laudo_e_certificado' | 'apenas_laudo' | 'apenas_certificado';
  reportPrefix: string; // Ex: 'LAUDO-JVM-'
  certificatePrefix: string; // Ex: 'CERT-JVM-'
  defaultValidityMonths: number; // Ex: 6 ou 12 meses
  defaultApprovalText: string; // Texto/Parecer técnico padrão de aprovação
  defaultRejectionText: string; // Parecer técnico padrão de reprovação
  requireDigitalSignature: boolean; // Exigir assinatura do RT
  enableQrCodeValidation: boolean; // Ativar QR Code e validação pública
  standardObservationNote?: string; // Observações e termos normativos padrão
  headerCustomTitle?: string; // Título customizado do documento
}

export interface CompanyLabInfo {
  name: string;
  legalName: string; // Razão Social
  cnpj: string;
  creaCompanyRegister: string;
  address: string; // Logradouro / Rua / Avenida
  number?: string; // Número / Lote / Módulo
  neighborhood?: string; // Bairro
  complement?: string; // Complemento
  city?: string;
  state?: string; // UF
  cep?: string;
  cityState?: string; // Formato concatenado para compatibilidade
  phone: string;
  email: string;
  website: string;
  instagram?: string;
  validationBaseUrl?: string; // URL pública (hospedagem do app) para validação de laudos via QR Code
  supabaseUrl?: string; // Ex: 'https://cdtbzbshylrcprvmjpgc.supabase.co'
  supabaseAnonKey?: string; // Chave pública / anon key do Supabase
  supabaseAutoSync?: boolean; // Sincronização automática em segundo plano com Supabase
  supabaseEnabled?: boolean; // Ativação da integração com Supabase
  lastSupabaseSyncTime?: string; // Data/hora da última sincronização com Supabase
  technicalResponsible: {
    name: string;
    title: string;
    creaNumber: string;
    rnp: string;
    signatureUrl?: string;
  };
  logoUrl?: string;
  certificateEmissionSettings?: CertificateEmissionSettings;
}

export type AppSettings = CompanyLabInfo;

export interface ConsolidatedReport {
  id: string;
  companyId?: string;
  reportCode: string; // Ex: 'REL-TEC-2026-0001'
  title: string;
  clientId: string;
  clientName: string;
  clientCnpj?: string;
  clientAddress?: string;
  clientContact?: string;
  serviceOrderId?: string;
  serviceOrderNumber?: string;
  artNumber?: string;
  emissionDate: string;
  testPeriodStart?: string;
  testPeriodEnd?: string;
  location: string;
  testIds: string[];
  testsSummary: {
    total: number;
    approved: number;
    rejected: number;
    approvalRate: number;
  };
  executiveSummary: string;
  introductionText: string;
  methodologyText: string;
  normsText: string;
  resultsAnalysisText: string;
  conclusionText: string;
  recommendationsText: string;
  technicianName: string;
  technicianCreaOrCft?: string;
  techResponsibleName: string;
  techResponsibleCrea: string;
  techResponsibleRnp?: string;
  reportFormat?: 'completo' | 'simplificado';
  includeIndividualReportsAnnex?: boolean;
  annexTitle?: string;
  validationCode?: string;
  documentHash?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // Exclusão lógica (propagada ao Supabase)
  syncStatus?: 'synced' | 'pending' | 'conflict';
}
