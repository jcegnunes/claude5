import React, { useState, useEffect, useRef } from 'react';
import { 
  FlaskConical, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Camera, 
  Upload, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  FileText, 
  Award, 
  QrCode, 
  Thermometer, 
  Droplets, 
  Gauge, 
  Check, 
  Zap, 
  AlertTriangle,
  Info,
  Calendar,
  Lock,
  User as UserIcon,
  UserCheck,
  Briefcase,
  IdCard,
  Shield,
  Image as ImageIcon,
  FolderOpen,
  Maximize2,
  Trash2,
  Sparkles,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Layers,
  Clock,
  CheckCircle,
  Tag,
  SlidersHorizontal,
  ClipboardList,
  Building2,
  Edit3,
  Smartphone
} from 'lucide-react';
import { 
  Equipment, 
  EquipmentType,
  DielectricClass,
  ServiceOrder, 
  LabInstrument, 
  NormCriterion, 
  ChecklistItem, 
  TestPhoto, 
  TestRecord, 
  User,
  IsolatedToolItem,
  CompanyLabInfo,
  Client
} from '../types';
import { DielectricStorageService, getDeviceId } from '../services/syncEngine';
import { 
  evaluateDielectricTest, 
  getDefaultChecklistForEquipment, 
  findMatchingCriterion,
  isTestEligibleForCertificate
} from '../services/normsEngine';
import { 
  getNBR16295MaxLeakageCurrent, 
  getNBR16295Voltages, 
  NBR_16295_LENGTH_OPTIONS, 
  TABELA_4_NBR_16295,
  GloveLength_mm, 
  GloveTestMethod 
} from '../services/nbr16295Service';
import {
  TABELA_ASTM_D1048,
  TABELA_ASTM_D178,
  getASTMD1048Entry,
  getASTMD178Entry,
  BLANKET_STYLES_INFO,
  BLANKET_TYPES_INFO,
  BLANKET_SIZES_INFO,
  MATTING_SURFACES_INFO,
  MATTING_TYPES_INFO,
  BlanketType,
  BlanketStyle,
  MattingSurface
} from '../services/astmBlanketMattingService';
import {
  getLadderNormEntry,
  getLadderChecklistItems,
  evaluateLadderDielectricTest,
  LadderType,
  LadderTestMethod,
  LADDER_TYPES_INFO,
  LADDER_TEST_METHODS_INFO,
  TABELA_NORMAS_ESCADAS_FIBRA
} from '../services/ladderNormsService';
import { SignatureCanvas } from '../components/SignatureCanvas';
import { StatusBadge } from '../components/StatusBadge';
import { IsolatedToolsSelector } from '../components/IsolatedToolsSelector';
import { PhotoDetailModal } from '../components/PhotoDetailModal';
import { LiveCameraModal } from '../components/LiveCameraModal';
import { MobileCameraBridgeModal } from '../components/MobileCameraBridgeModal';
import { compressImage, fileToDataUrl } from '../utils/imageCompressor';

interface TestWizardViewProps {
  currentUser: User;
  onFinishTest: (test: TestRecord) => void;
  preSelectedEquipmentId?: string;
  preSelectedOSId?: string;
  editingTest?: TestRecord | null;
  onCancelEdit?: () => void;
}

export interface EquipmentNormSpec {
  label: string;
  norm: string;
  fullLabel: string;
}

export const EQUIPMENT_NORM_SPECIFICATIONS: Record<EquipmentType, EquipmentNormSpec> = {
  luva_isolante: {
    label: 'Luvas Isolantes de Borracha',
    norm: 'NBR 16295 Tabela 4',
    fullLabel: 'Luvas Isolantes de Borracha (NBR 16295 Tabela 4)'
  },
  manga_isolante: {
    label: 'Mangas Isolantes de Borracha',
    norm: 'NBR 10624 / ASTM D1051',
    fullLabel: 'Mangas Isolantes de Borracha (NBR 10624 / ASTM D1051)'
  },
  manta_isolante: {
    label: 'Mantas de Cobertura Isolantes',
    norm: 'ASTM D1048',
    fullLabel: 'Mantas de Cobertura Isolantes (ASTM D1048)'
  },
  tapete_isolante: {
    label: 'Tapetes Isolantes de Borracha',
    norm: 'ASTM D178-22',
    fullLabel: 'Tapetes Isolantes de Borracha (ASTM D178-22)'
  },
  bastao_manobra: {
    label: 'Bastões de Manobra e Salvamento',
    norm: 'NBR 14540 / ASTM F711',
    fullLabel: 'Bastões de Manobra e Salvamento (NBR 14540 / ASTM F711)'
  },
  vara_manobra: {
    label: 'Varas de Manobra Telescópicas / Seccionáveis',
    norm: 'NBR 14540 / ASTM F711',
    fullLabel: 'Varas de Manobra Telescópicas / Seccionáveis (NBR 14540 / ASTM F711)'
  },
  capacete_classe_b: {
    label: 'Capacetes de Segurança Classe B (Classe 2)',
    norm: 'ABNT NBR 8221 / ANSI Z89.1',
    fullLabel: 'Capacetes de Segurança Classe B — Classe 2 (ABNT NBR 8221 / ANSI Z89.1)'
  },
  bota_dielétrica: {
    label: 'Calçados / Botas Dielétricas de Segurança',
    norm: 'NBR 16603 / ASTM F2413',
    fullLabel: 'Calçados / Botas Dielétricas de Segurança (NBR 16603 / ASTM F2413)'
  },
  ferramenta_isolada: {
    label: 'Ferramentas Manuais Isoladas 1000V',
    norm: 'NBR 9686 / IEC 60900',
    fullLabel: 'Ferramentas Manuais Isoladas 1000V (NBR 9686 / IEC 60900)'
  },
  escada_isolada: {
    label: 'Escadas Isoladas de Fibra de Vidro (PRFV)',
    norm: 'EN 50528:2024 / ABNT NBR IEC 61478',
    fullLabel: 'Escadas Isoladas em Fibra de Vidro (EN 50528:2024 BT / ABNT NBR IEC 61478 AT)'
  },
  detector_tensao: {
    label: 'Detectores de Tensão / Prova de Ausência de Tensão',
    norm: 'ABNT NBR IEC 61243-1',
    fullLabel: 'Detectores de Tensão / Prova de Ausência de Tensão (ABNT NBR IEC 61243-1)'
  },
  ponteira_prova: {
    label: 'Ponteiras de Prova e Cabos de Ensaio',
    norm: 'IEC 61010-031',
    fullLabel: 'Ponteiras de Prova e Cabos de Ensaio (IEC 61010-031)'
  },
  outro: {
    label: 'Outros Dispositivos Dielétricos',
    norm: 'Norma Geral NR-10',
    fullLabel: 'Outros Dispositivos Dielétricos (Norma Geral NR-10)'
  }
};

export const TestWizardView: React.FC<TestWizardViewProps> = ({
  currentUser,
  onFinishTest,
  preSelectedEquipmentId,
  preSelectedOSId,
  editingTest,
  onCancelEdit
}) => {
  // Step tracker: 1: OS/Equipment, 2: Ambient, 3: Visual Inspection, 4: Measurements, 5: Instruments, 6: Photos, 7: Signatures & Result
  const [currentStep, setCurrentStep] = useState(1);

  // Storage Data
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [normsList, setNormsList] = useState<NormCriterion[]>([]);
  const [instrumentsList, setInstrumentsList] = useState<LabInstrument[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [existingTests, setExistingTests] = useState<TestRecord[]>([]);

  // Registered Equipment Filter & Search in Wizard
  const [equipmentSearchTerm, setEquipmentSearchTerm] = useState<string>('');
  const [equipmentScopeFilter, setEquipmentScopeFilter] = useState<'os' | 'client' | 'all'>('all');
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState<string>('all');
  const [isManualOverrideMode, setIsManualOverrideMode] = useState<boolean>(false);
  const [saveEquipmentSuccessMsg, setSaveEquipmentSuccessMsg] = useState<string | null>(null);

  // Wizard Form State
  const [selectedClientId, setSelectedClientId] = useState<string>(editingTest?.clientId || '');
  const [selectedOSId, setSelectedOSId] = useState<string>(editingTest?.serviceOrderId || preSelectedOSId || '');
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<EquipmentType>(
    editingTest?.equipmentType || 'luva_isolante'
  );
  const [selectedDielectricClass, setSelectedDielectricClass] = useState<DielectricClass>(
    (editingTest?.appliedClass || editingTest?.equipmentClass || '2') as DielectricClass
  );
  const [equipmentTag, setEquipmentTag] = useState<string>(editingTest?.equipmentTag || 'TAG-LUV-01');
  const [equipmentSerial, setEquipmentSerial] = useState<string>(editingTest?.equipmentSerial || '');
  const [equipmentCa, setEquipmentCa] = useState<string>(editingTest?.equipmentCa || '');
  const [equipmentManufacturer, setEquipmentManufacturer] = useState<string>(editingTest?.manufacturer || 'Orion');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>(editingTest?.equipmentId || preSelectedEquipmentId || '');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [collaboratorName, setCollaboratorName] = useState<string>(editingTest?.collaboratorName || '');
  const [collaboratorRegistration, setCollaboratorRegistration] = useState<string>(editingTest?.collaboratorRegistration || '');
  const [collaboratorSector, setCollaboratorSector] = useState<string>(editingTest?.collaboratorSector || '');
  const [isolatedTools, setIsolatedTools] = useState<IsolatedToolItem[]>(editingTest?.isolatedTools || []);

  // NBR 16295 Glove Parameters
  const [gloveLength_mm, setGloveLength_mm] = useState<GloveLength_mm>(editingTest?.gloveLength_mm || 360);
  const [gloveTestMethod, setGloveTestMethod] = useState<GloveTestMethod>(editingTest?.gloveTestMethod || 'ensaio_prova');
  const [moistureConditioning, setMoistureConditioning] = useState<boolean>(editingTest?.moistureConditioning || false);

  // ASTM D1048 (Mantas) & ASTM D178 (Tapetes) Parameters
  const [blanketType, setBlanketType] = useState<BlanketType>(editingTest?.blanketType || 'Type I');
  const [blanketStyle, setBlanketStyle] = useState<BlanketStyle>(editingTest?.blanketStyle || 'Style A');
  const [blanketDimensions, setBlanketDimensions] = useState<string>(editingTest?.blanketDimensions || '910x910 mm');
  const [mattingSurface, setMattingSurface] = useState<MattingSurface>(editingTest?.mattingSurface || 'Corrugada');
  const [mattingThickness_mm, setMattingThickness_mm] = useState<number>(editingTest?.mattingThickness_mm || 6.4);
  const [mattingDimensions, setMattingDimensions] = useState<string>(editingTest?.mattingDimensions || '1,0m x 2,0m');
  const [testElectrodeType, setTestElectrodeType] = useState<string>(editingTest?.testElectrodeType || 'Eletrodos Planos Metálicos (ASTM D1048 / D178)');
  const [blanketMattingTestMethod, setBlanketMattingTestMethod] = useState<'ensaio_prova_ac' | 'ensaio_prova_dc' | 'rigidez_dieletrica_ac'>('ensaio_prova_ac');

  // ABNT NBR IEC 61478 & NBR 16308 Ladder Parameters
  const [ladderType, setLadderType] = useState<LadderType>('extensivel');
  const [ladderTestMethod, setLadderTestMethod] = useState<LadderTestMethod>('segmento_300mm_100kv');
  const [ladderSegmentLength_mm, setLadderSegmentLength_mm] = useState<number>(300);
  const [ladderTestedSegmentsCount, setLadderTestedSegmentsCount] = useState<number>(12);
  const [ladderRungsInspectedCount, setLadderRungsInspectedCount] = useState<number>(28);
  const [ladderLengthExtended_m, setLadderLengthExtended_m] = useState<number>(7.8);
  const [ladderLoadCapacity_kg, setLadderLoadCapacity_kg] = useState<number>(150);
  const [ladderMoistureConditioned, setLadderMoistureConditioned] = useState<boolean>(false);

  // Environmental
  const [temperature, setTemperature] = useState<number>(editingTest?.environmental?.temperatureC ?? 23.5);
  const [relativeHumidity, setRelativeHumidity] = useState<number>(editingTest?.environmental?.relativeHumidityPercent ?? 55.0);
  const [ambientInstrumentId, setAmbientInstrumentId] = useState<string>(editingTest?.environmental?.instrumentUsedId || 'inst-3');
  const [testLocation, setTestLocation] = useState<string>(editingTest?.location || 'Laboratório Móvel JVM');

  // Visual Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>(editingTest?.visualInspection || []);

  // Electrical Measurements
  const [appliedVoltage, setAppliedVoltage] = useState<number>(editingTest?.appliedVoltage_kV ?? 20.0);
  const [voltageType, setVoltageType] = useState<'AC' | 'DC'>(editingTest?.voltageType || 'AC');
  const [durationSeconds, setDurationSeconds] = useState<number>(editingTest?.applicationDurationSeconds ?? 60);
  const [leakageCurrent, setLeakageCurrent] = useState<number>(editingTest?.measuredLeakageCurrent_mA ?? 11.2);
  const [withstandPuncture, setWithstandPuncture] = useState<boolean>(editingTest?.withstandWithoutPuncture ?? true);
  const [selectedNormId, setSelectedNormId] = useState<string>(editingTest?.normCriterionId || '');

  // Instruments used
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState<string[]>(
    editingTest?.instrumentsUsed?.map(i => i.id) || ['inst-1', 'inst-3']
  );
  const [overrideCalibrationAuth, setOverrideCalibrationAuth] = useState<string>(
    editingTest?.calibrationOverrideAuthorizedBy || ''
  );

  // Photographic Evidence
  const [photos, setPhotos] = useState<TestPhoto[]>(editingTest?.photos || []);
  const [photoCategory, setPhotoCategory] = useState<TestPhoto['category']>('durante');
  const [photoCaption, setPhotoCaption] = useState<string>('');
  const [isProcessingPhotos, setIsProcessingPhotos] = useState<boolean>(false);
  const [selectedPhotoForDetail, setSelectedPhotoForDetail] = useState<TestPhoto | null>(null);
  const [isDraggingPhotos, setIsDraggingPhotos] = useState<boolean>(false);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState<boolean>(false);
  const [isMobileBridgeOpen, setIsMobileBridgeOpen] = useState<boolean>(false);

  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Signatures
  const [companyInfo, setCompanyInfo] = useState<CompanyLabInfo>(DielectricStorageService.getCompanyInfo());
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>(editingTest?.technicianId || '');
  const [technicianSig, setTechnicianSig] = useState<string>(editingTest?.technicianSignature?.signatureImage || '');
  const [techResponsibleSig, setTechResponsibleSig] = useState<string>(editingTest?.techResponsibleSignature?.signatureImage || '');
  const [selectedRTId, setSelectedRTId] = useState<string>('configured-company-rt');

  // Emission Settings and Technical Notes
  const [technicalNotes, setTechnicalNotes] = useState<string>(editingTest?.technicalNotes || '');
  const [emitLaudo, setEmitLaudo] = useState<boolean>(true);
  const [emitCertificado, setEmitCertificado] = useState<boolean>(Boolean(editingTest?.certificateNumber || !editingTest));
  const [customOpinionText, setCustomOpinionText] = useState<string>('');

  // Helper to apply selection of a registered equipment
  const handleSelectEquipment = (eq: Equipment | null) => {
    if (!eq) {
      setSelectedEquipment(null);
      setSelectedEquipmentId('');
      setIsManualOverrideMode(true);
      return;
    }

    setSelectedEquipment(eq);
    setSelectedEquipmentId(eq.id);
    setSelectedClientId(eq.clientId);
    if (eq.serviceOrderId && serviceOrders.some(o => o.id === eq.serviceOrderId)) {
      setSelectedOSId(eq.serviceOrderId);
    }
    setIsManualOverrideMode(false);
    setSelectedEquipmentType(eq.type);
    const dClass = (eq.dielectricClass as DielectricClass) || '2';
    setSelectedDielectricClass(dClass);
    setEquipmentTag(eq.tag);
    setEquipmentSerial(eq.serialNumber || '');
    setEquipmentCa(eq.caNumber || '');
    setEquipmentManufacturer(eq.manufacturer || '');
    setCollaboratorName(eq.collaboratorName || '');
    setCollaboratorRegistration(eq.collaboratorRegistration || '');
    setCollaboratorSector(eq.collaboratorSector || eq.sector || '');
    setChecklist(getDefaultChecklistForEquipment(eq.type));

    // Handle glove length
    if (eq.type === 'luva_isolante' && eq.gloveLength_mm) {
      setGloveLength_mm(eq.gloveLength_mm as GloveLength_mm);
    }

    // Handle blanket
    if (eq.type === 'manta_isolante') {
      if (eq.blanketType) setBlanketType(eq.blanketType);
      if (eq.blanketStyle) setBlanketStyle(eq.blanketStyle);
      if (eq.blanketDimensions) setBlanketDimensions(eq.blanketDimensions);
    }

    // Handle matting (tapete)
    if (eq.type === 'tapete_isolante') {
      if (eq.mattingSurface) setMattingSurface(eq.mattingSurface);
      if (eq.mattingThickness_mm !== undefined && eq.mattingThickness_mm > 0) {
        setMattingThickness_mm(eq.mattingThickness_mm);
      } else {
        const astm = getASTMD178Entry(dClass);
        if (astm) setMattingThickness_mm(astm.espessuraMinima_mm);
      }
      if (eq.mattingDimensions) setMattingDimensions(eq.mattingDimensions);
    }

    // Handle isolated tools
    if (eq.type === 'ferramenta_isolada' && eq.isolatedTools && eq.isolatedTools.length > 0) {
      setIsolatedTools(eq.isolatedTools);
    }

    // Handle ladder (escada isolada)
    if (eq.type === 'escada_isolada') {
      if (eq.ladderType) setLadderType(eq.ladderType);
      if (eq.ladderRungsCount) setLadderRungsInspectedCount(eq.ladderRungsCount);
      if (eq.ladderLengthExtended_m) setLadderLengthExtended_m(eq.ladderLengthExtended_m);
      if (eq.ladderLoadCapacity_kg) setLadderLoadCapacity_kg(eq.ladderLoadCapacity_kg);
    }

    // Norm Criteria matching
    const currentNorms = normsList.length > 0 ? normsList : DielectricStorageService.getNorms();
    const match = findMatchingCriterion(eq.type, eq.type === 'ferramenta_isolada' ? '0' : dClass, currentNorms);
    if (match) {
      setSelectedNormId(match.id);
      setAppliedVoltage(match.testVoltage_kV);
      setVoltageType(match.voltageType);
      setDurationSeconds(match.testDurationSeconds);
    } else if (eq.type === 'manta_isolante') {
      const astm = getASTMD1048Entry(dClass);
      if (astm) {
        setAppliedVoltage(astm.tensaoProvaAC_kV);
        setVoltageType('AC');
        setDurationSeconds(60);
      }
    } else if (eq.type === 'tapete_isolante') {
      const astm = getASTMD178Entry(dClass);
      if (astm) {
        setAppliedVoltage(astm.tensaoProvaAC_kV);
        setVoltageType('AC');
        setDurationSeconds(60);
      }
    } else if (eq.type === 'escada_isolada') {
      const ladderEntry = getLadderNormEntry('segmento_300mm_100kv');
      setAppliedVoltage(ladderEntry.testVoltageAC_kV);
      setVoltageType('AC');
      setDurationSeconds(ladderEntry.testDurationSeconds);
    }
  };

  // Load Initial Data
  useEffect(() => {
    const clients = DielectricStorageService.getClients();
    const orders = DielectricStorageService.getServiceOrders();
    const eqs = DielectricStorageService.getEquipment();
    const norms = DielectricStorageService.getNorms();
    const insts = DielectricStorageService.getInstruments();
    const users = DielectricStorageService.getUsers();
    const comp = DielectricStorageService.getCompanyInfo();
    const tests = DielectricStorageService.getTests();

    setClientsList(clients);
    setServiceOrders(orders);
    setEquipmentList(eqs);
    setNormsList(norms);
    setInstrumentsList(insts);
    setUsersList(users);
    setCompanyInfo(comp);
    setExistingTests(tests);

    if (editingTest) {
      if (editingTest.clientId) setSelectedClientId(editingTest.clientId);
      if (editingTest.serviceOrderId) setSelectedOSId(editingTest.serviceOrderId);
      if (editingTest.technicianId) setSelectedTechnicianId(editingTest.technicianId);
      
      const matchEq = eqs.find(e => e.id === editingTest.equipmentId || e.tag === editingTest.equipmentTag);
      if (matchEq) {
        setSelectedEquipment(matchEq);
        setSelectedEquipmentId(matchEq.id);
      }
      return;
    }

    if (preSelectedOSId) {
      setSelectedOSId(preSelectedOSId);
      const os = orders.find(o => o.id === preSelectedOSId);
      if (os?.clientId) {
        setSelectedClientId(os.clientId);
      }
      if (os?.technicianId) {
        setSelectedTechnicianId(os.technicianId);
      }
      if (os?.equipmentIds && os.equipmentIds.length > 0) {
        setEquipmentScopeFilter('os');
      }
    }

    if (preSelectedEquipmentId) {
      const eq = eqs.find(e => e.id === preSelectedEquipmentId);
      if (eq) {
        handleSelectEquipment(eq);
        if (eq.clientId) setSelectedClientId(eq.clientId);
        if (eq.serviceOrderId) setSelectedOSId(eq.serviceOrderId);
      }
    } else if (preSelectedOSId) {
      const os = orders.find(o => o.id === preSelectedOSId);
      if (os && os.equipmentIds && os.equipmentIds.length > 0) {
        const firstEq = eqs.find(e => e.id === os.equipmentIds[0]);
        if (firstEq) {
          handleSelectEquipment(firstEq);
        }
      }
    } else if (eqs.length > 0) {
      // Default select first registered equipment from database
      handleSelectEquipment(eqs[0]);
      if (eqs[0].clientId) setSelectedClientId(eqs[0].clientId);
      if (eqs[0].serviceOrderId) setSelectedOSId(eqs[0].serviceOrderId);
    } else {
      if (clients.length > 0) setSelectedClientId(clients[0].id);
      // Default checklist and norm for initial type
      setChecklist(getDefaultChecklistForEquipment('luva_isolante'));
      const match = findMatchingCriterion('luva_isolante', '2', norms);
      if (match) {
        setSelectedNormId(match.id);
        setAppliedVoltage(match.testVoltage_kV);
        setVoltageType(match.voltageType);
        setDurationSeconds(match.testDurationSeconds);
      }
    }
  }, [preSelectedEquipmentId, preSelectedOSId]);

  // When EPI Type changes, auto-load default checklist and matching norm criteria
  const handleSelectEquipmentType = (type: EquipmentType) => {
    setSelectedEquipmentType(type);
    setChecklist(getDefaultChecklistForEquipment(type));

    if (type === 'ferramenta_isolada') {
      setSelectedDielectricClass('0');
      if (equipmentManufacturer === 'Orion') {
        setEquipmentManufacturer('Gedore');
      }
      if (isolatedTools.length === 0) {
        setIsolatedTools([
          {
            id: 'tool-fenda-1',
            toolType: 'chave_fenda',
            toolName: 'Chave de Fenda Isolada 1000V',
            quantity: 1,
            manufacturer: 'Gedore',
            sizeOrSpec: '1/4 x 6" (6x150mm)',
            nominalVoltage: '1.000 Vca / 1.500 Vcc',
            result: 'APROVADO',
            visualInspection: 'conforme',
            dielectricResult: 'conforme'
          },
          {
            id: 'tool-philips-1',
            toolType: 'chave_philips',
            toolName: 'Chave Philips / Cruzada Isolada 1000V',
            quantity: 1,
            manufacturer: 'Gedore',
            sizeOrSpec: 'PH2 x 6" (6x150mm)',
            nominalVoltage: '1.000 Vca / 1.500 Vcc',
            result: 'APROVADO',
            visualInspection: 'conforme',
            dielectricResult: 'conforme'
          },
          {
            id: 'tool-univ-1',
            toolType: 'alicate_universal',
            toolName: 'Alicate Universal Isolado 1000V',
            quantity: 1,
            manufacturer: 'Gedore',
            sizeOrSpec: '8 polegadas (200mm)',
            nominalVoltage: '1.000 Vca / 1.500 Vcc',
            result: 'APROVADO',
            visualInspection: 'conforme',
            dielectricResult: 'conforme'
          }
        ]);
      }
    }

    // Generate suggestive Tag if current tag matches pattern
    const prefixMap: Record<string, string> = {
      luva_isolante: 'LUV',
      manga_isolante: 'MNG',
      manta_isolante: 'MNT',
      bastao_manobra: 'BST',
      vara_manobra: 'VAR',
      tapete_isolante: 'TAP',
      cobertura_rigida: 'COB',
      capacete_classe_b: 'CAP',
      bota_dielétrica: 'BOT',
      ferramenta_isolada: 'FRM',
      escada_isolada: 'ESC',
      detector_tensao: 'DET',
      outro: 'EPI'
    };
    const prefix = prefixMap[type] || 'EPI';
    setEquipmentTag(`TAG-${prefix}-${Math.floor(10 + Math.random() * 90)}`);

    // For tapetes, if current class was '00', adjust to '0' because ASTM D178 specifies classes 0, 1, 2, 3, 4
    // For capacetes de segurança Classe B, define classe dielétrica 2 (20 kV CA / NBR 8221)
    let effectiveClass = selectedDielectricClass;
    if (type === 'tapete_isolante' && selectedDielectricClass === '00') {
      effectiveClass = '0';
      setSelectedDielectricClass('0');
    } else if (type === 'capacete_classe_b') {
      effectiveClass = '2';
      setSelectedDielectricClass('2');
    }

    // Find default matching norm
    const currentNorms = normsList.length > 0 ? normsList : DielectricStorageService.getNorms();
    const match = findMatchingCriterion(type, type === 'ferramenta_isolada' ? '0' : effectiveClass, currentNorms);
    if (match) {
      setSelectedNormId(match.id);
      setAppliedVoltage(match.testVoltage_kV);
      setVoltageType(match.voltageType);
      setDurationSeconds(match.testDurationSeconds);
    } else if (type === 'manta_isolante') {
      const astm = getASTMD1048Entry(effectiveClass);
      if (astm) {
        setAppliedVoltage(astm.tensaoProvaAC_kV);
        setVoltageType('AC');
        setDurationSeconds(60);
      }
    } else if (type === 'tapete_isolante') {
      const astm = getASTMD178Entry(effectiveClass);
      if (astm) {
        setAppliedVoltage(astm.tensaoProvaAC_kV);
        setVoltageType('AC');
        setDurationSeconds(60);
        setMattingThickness_mm(astm.espessuraMinima_mm);
      }
    }
  };

  // When Dielectric Class changes, re-evaluate norm parameters
  const handleSelectClass = (cls: DielectricClass) => {
    setSelectedDielectricClass(cls);
    const currentNorms = normsList.length > 0 ? normsList : DielectricStorageService.getNorms();
    const match = findMatchingCriterion(selectedEquipmentType, cls, currentNorms);
    if (match) {
      setSelectedNormId(match.id);
      setAppliedVoltage(match.testVoltage_kV);
      setVoltageType(match.voltageType);
      setDurationSeconds(match.testDurationSeconds);
    } else if (selectedEquipmentType === 'manta_isolante') {
      const astm = getASTMD1048Entry(cls);
      if (astm) {
        setAppliedVoltage(astm.tensaoProvaAC_kV);
        setVoltageType('AC');
        setDurationSeconds(60);
      }
    } else if (selectedEquipmentType === 'tapete_isolante') {
      const astm = getASTMD178Entry(cls);
      if (astm) {
        setAppliedVoltage(astm.tensaoProvaAC_kV);
        setVoltageType('AC');
        setDurationSeconds(60);
        setMattingThickness_mm(astm.espessuraMinima_mm);
      }
    }
  };

  // Keep selectedNormId synchronized with equipment type and class
  useEffect(() => {
    if (normsList.length === 0) return;
    const currentNorm = normsList.find(n => n.id === selectedNormId);
    if (!currentNorm || !currentNorm.applicableEquipmentTypes?.includes(selectedEquipmentType)) {
      const effClass = selectedEquipmentType === 'ferramenta_isolada' 
        ? '0' 
        : (selectedEquipmentType === 'tapete_isolante' && selectedDielectricClass === '00' ? '0' : selectedDielectricClass);
      const match = findMatchingCriterion(selectedEquipmentType, effClass, normsList);
      if (match) {
        setSelectedNormId(match.id);
        setAppliedVoltage(match.testVoltage_kV);
        setVoltageType(match.voltageType);
        setDurationSeconds(match.testDurationSeconds);
      }
    }
  }, [selectedEquipmentType, selectedDielectricClass, normsList, selectedNormId]);

  // Evaluation computation based on Norms Engine
  const currentEvaluation = evaluateDielectricTest({
    equipmentType: selectedEquipmentType,
    dielectricClass: selectedDielectricClass,
    appliedVoltage_kV: appliedVoltage,
    voltageType,
    durationSeconds,
    measuredLeakageCurrent_mA: leakageCurrent,
    withstandWithoutPuncture: withstandPuncture,
    visualChecklist: checklist,
    customNormCriterionId: selectedNormId,
    allCriteria: normsList,
    isolatedTools: selectedEquipmentType === 'ferramenta_isolada' ? isolatedTools : undefined,
    gloveLength_mm: selectedEquipmentType === 'luva_isolante' ? gloveLength_mm : undefined,
    gloveTestMethod: selectedEquipmentType === 'luva_isolante' ? gloveTestMethod : undefined,
    moistureConditioning: selectedEquipmentType === 'luva_isolante' ? moistureConditioning : undefined,
    blanketType: selectedEquipmentType === 'manta_isolante' ? blanketType : undefined,
    blanketStyle: selectedEquipmentType === 'manta_isolante' ? blanketStyle : undefined,
    blanketDimensions: selectedEquipmentType === 'manta_isolante' ? blanketDimensions : undefined,
    mattingSurface: selectedEquipmentType === 'tapete_isolante' ? mattingSurface : undefined,
    mattingThickness_mm: selectedEquipmentType === 'tapete_isolante' ? mattingThickness_mm : undefined,
    mattingDimensions: selectedEquipmentType === 'tapete_isolante' ? mattingDimensions : undefined,
    testElectrodeType,
    flashoverClearance_mm: selectedEquipmentType === 'manta_isolante' ? getASTMD1048Entry(selectedDielectricClass)?.distanciaBordaEletrodo_mm : undefined,
    ladderType: selectedEquipmentType === 'escada_isolada' ? ladderType : undefined,
    ladderTestMethod: selectedEquipmentType === 'escada_isolada' ? ladderTestMethod : undefined,
    ladderSegmentLength_mm: selectedEquipmentType === 'escada_isolada' ? ladderSegmentLength_mm : undefined,
    ladderTestedSegmentsCount: selectedEquipmentType === 'escada_isolada' ? ladderTestedSegmentsCount : undefined,
    ladderRungsInspectedCount: selectedEquipmentType === 'escada_isolada' ? ladderRungsInspectedCount : undefined,
    ladderMoistureConditioned: selectedEquipmentType === 'escada_isolada' ? ladderMoistureConditioned : undefined
  });

  // Checklist updates
  const handleChecklistChange = (id: string, status: ChecklistItem['status'], obs?: string) => {
    setChecklist(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, status, observation: obs !== undefined ? obs : item.observation };
      }
      return item;
    }));
  };

  // Photo handlers
  const handleCaptureFromLiveCamera = (photoData: Omit<TestPhoto, 'id' | 'timestamp'>) => {
    const newPhoto: TestPhoto = {
      id: 'ph-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      category: photoData.category || photoCategory,
      url: photoData.url,
      caption: photoData.caption?.trim() || photoCaption.trim() || `Registro fotográfico - ${photoData.category || photoCategory}`,
      timestamp: new Date().toISOString(),
      userName: photoData.userName || currentUser.name,
      gpsCoords: photoData.gpsCoords
    };
    setPhotos(prev => [...prev, newPhoto]);
    setPhotoCaption('');
  };

  const handleAddPhotoFromFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;
    setIsProcessingPhotos(true);
    try {
      const newPhotosList: TestPhoto[] = [];
      for (const file of fileList) {
        try {
          let url = await compressImage(file, 1280, 960, 0.75);
          if (!url) {
            url = await fileToDataUrl(file);
          }
          if (url) {
            newPhotosList.push({
              id: 'ph-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              category: photoCategory,
              url,
              caption: photoCaption.trim() || `Registro fotográfico (${file.name || 'Câmera'})`,
              timestamp: new Date().toISOString(),
              userName: currentUser.name
            });
          }
        } catch (err) {
          console.warn('Error processing photo with compression:', err);
          try {
            const rawUrl = await fileToDataUrl(file);
            if (rawUrl) {
              newPhotosList.push({
                id: 'ph-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                category: photoCategory,
                url: rawUrl,
                caption: photoCaption.trim() || `Registro fotográfico (${file.name || 'Câmera'})`,
                timestamp: new Date().toISOString(),
                userName: currentUser.name
              });
            }
          } catch (readErr) {
            console.error('Failed to read photo file:', readErr);
          }
        }
      }
      if (newPhotosList.length > 0) {
        setPhotos(prev => [...prev, ...newPhotosList]);
      }
      setPhotoCaption('');
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  const handleNativeCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddPhotoFromFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddPhotoFromFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  // Instrument calibration validation
  const selectedInstrumentsDetails = instrumentsList.filter(i => selectedInstrumentIds.includes(i.id));
  const today = new Date().toISOString().split('T')[0];
  const hasExpiredInstrument = selectedInstrumentsDetails.some(i => i.calibrationExpiryDate < today);

  // Selected Service Order and Effective Technician (configured on OS or selected)
  const selectedOS = serviceOrders.find(o => o.id === selectedOSId);

  const effectiveTechnician: User = (() => {
    if (selectedTechnicianId) {
      const found = usersList.find(u => u.id === selectedTechnicianId);
      if (found) return found;
    }
    if (selectedOS?.technicianId) {
      const found = usersList.find(u => u.id === selectedOS.technicianId);
      if (found) return found;
    }
    if (selectedOS?.technicianName) {
      const found = usersList.find(u => u.name.toLowerCase() === selectedOS.technicianName?.toLowerCase());
      if (found) return found;
      return {
        id: selectedOS.technicianId || 'usr-os-tech',
        name: selectedOS.technicianName,
        cargo: 'Analista Executor',
        role: 'tecnico',
        creaOrCft: 'CFT / Habilitado',
        active: true,
        email: ''
      };
    }
    return currentUser;
  })();

  // Effective Technical Responsible (configured in "Configurações e Backup" tab)
  const effectiveTechResponsible = (() => {
    if (selectedRTId && selectedRTId !== 'configured-company-rt') {
      const found = usersList.find(u => u.id === selectedRTId);
      if (found) {
        return {
          id: found.id,
          name: found.name,
          title: found.cargo || 'Responsável Técnico',
          creaNumber: found.creaOrCft || companyInfo.technicalResponsible?.creaNumber || 'CREA-SP 5069874211/D',
          rnp: companyInfo.technicalResponsible?.rnp || '',
          signatureUrl: found.signatureUrl || ''
        };
      }
    }

    // Default to the technicalResponsible configured in the "Configurações e Backup" tab
    const rtConfig = companyInfo.technicalResponsible;
    return {
      id: 'configured-company-rt',
      name: rtConfig?.name || 'Eng. João Victor Medeiros',
      title: rtConfig?.title || 'Engenheiro Eletricista e de Segurança do Trabalho',
      creaNumber: rtConfig?.creaNumber || 'CREA-SP 5069874211/D',
      rnp: rtConfig?.rnp || '2614897500',
      signatureUrl: rtConfig?.signatureUrl || ''
    };
  })();

  // Synchronize Default Signature for Technician / Analyst automatically
  useEffect(() => {
    if (!editingTest) {
      if (effectiveTechnician.signatureUrl) {
        setTechnicianSig(effectiveTechnician.signatureUrl);
      } else {
        setTechnicianSig('');
      }
    } else if (!technicianSig && effectiveTechnician.signatureUrl) {
      setTechnicianSig(effectiveTechnician.signatureUrl);
    }
  }, [selectedTechnicianId, effectiveTechnician.id, effectiveTechnician.signatureUrl, editingTest]);

  // Synchronize Default Signature for Technical Responsible automatically
  useEffect(() => {
    const defaultRTSig = effectiveTechResponsible.signatureUrl || companyInfo.technicalResponsible?.signatureUrl || '';
    if (!editingTest) {
      if (defaultRTSig) {
        setTechResponsibleSig(defaultRTSig);
      } else {
        setTechResponsibleSig('');
      }
    } else if (!techResponsibleSig && defaultRTSig) {
      setTechResponsibleSig(defaultRTSig);
    }
  }, [selectedRTId, effectiveTechResponsible.signatureUrl, companyInfo.technicalResponsible?.signatureUrl, editingTest]);

  // Handler to persist signature as default for the selected Analyst
  const handleSaveTechnicianDefaultSig = (newSig: string) => {
    setTechnicianSig(newSig);
    if (!newSig) return;

    const targetUserId = effectiveTechnician.id;
    const targetUser = usersList.find(u => u.id === targetUserId) || effectiveTechnician;
    const updatedUser: User = {
      ...targetUser,
      signatureUrl: newSig
    };

    DielectricStorageService.saveUser(updatedUser);
    setUsersList(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  // Handler to persist signature as default for the selected RT
  const handleSaveRTDefaultSig = (newSig: string) => {
    setTechResponsibleSig(newSig);
    if (!newSig) return;

    if (selectedRTId === 'configured-company-rt' || !selectedRTId) {
      const updatedCompany: CompanyLabInfo = {
        ...companyInfo,
        technicalResponsible: {
          ...companyInfo.technicalResponsible,
          name: companyInfo.technicalResponsible?.name || 'Eng. João Victor Medeiros',
          title: companyInfo.technicalResponsible?.title || 'Engenheiro Eletricista e de Segurança do Trabalho',
          creaNumber: companyInfo.technicalResponsible?.creaNumber || 'CREA-SP 5069874211/D',
          rnp: companyInfo.technicalResponsible?.rnp || '2614897500',
          signatureUrl: newSig
        }
      };
      DielectricStorageService.saveCompanyInfo(updatedCompany);
      setCompanyInfo(updatedCompany);

      const matchRtUser = usersList.find(u => u.role === 'responsavel_tecnico' || u.name === (companyInfo.technicalResponsible?.name || 'Eng. João Victor Medeiros'));
      if (matchRtUser) {
        const updatedRtUser = { ...matchRtUser, signatureUrl: newSig };
        DielectricStorageService.saveUser(updatedRtUser);
        setUsersList(prev => prev.map(u => u.id === updatedRtUser.id ? updatedRtUser : u));
      }
    } else {
      const targetUser = usersList.find(u => u.id === selectedRTId);
      if (targetUser) {
        const updatedUser: User = { ...targetUser, signatureUrl: newSig };
        DielectricStorageService.saveUser(updatedUser);
        setUsersList(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      }
    }
  };

  // Equipments linked to selected OS
  const osEquipmentIds = selectedOS?.equipmentIds || [];
  const osEquipmentList = equipmentList.filter(eq => osEquipmentIds.includes(eq.id));
  const clientEquipmentList = selectedOS?.clientId 
    ? equipmentList.filter(eq => eq.clientId === selectedOS.clientId)
    : [];

  // Filtered equipment list for selection in Wizard
  const filteredEquipmentList = equipmentList.filter(eq => {
    // Scope filter
    if (equipmentScopeFilter === 'os' && osEquipmentIds.length > 0) {
      if (!osEquipmentIds.includes(eq.id)) return false;
    } else if (equipmentScopeFilter === 'client' && selectedOS?.clientId) {
      if (eq.clientId !== selectedOS.clientId) return false;
    }

    // Type filter
    if (equipmentTypeFilter !== 'all' && eq.type !== equipmentTypeFilter) {
      return false;
    }

    // Search query
    if (equipmentSearchTerm.trim()) {
      const q = equipmentSearchTerm.toLowerCase();
      const matchTag = eq.tag.toLowerCase().includes(q);
      const matchSerial = (eq.serialNumber || '').toLowerCase().includes(q);
      const matchModel = (eq.model || '').toLowerCase().includes(q);
      const matchManuf = (eq.manufacturer || '').toLowerCase().includes(q);
      const matchCa = (eq.caNumber || '').toLowerCase().includes(q);
      const matchCollab = (eq.collaboratorName || '').toLowerCase().includes(q);
      const matchMatr = (eq.collaboratorRegistration || '').toLowerCase().includes(q);
      const matchSector = (eq.collaboratorSector || eq.sector || '').toLowerCase().includes(q);
      const matchType = eq.type.toLowerCase().includes(q);
      if (!matchTag && !matchSerial && !matchModel && !matchManuf && !matchCa && !matchCollab && !matchMatr && !matchSector && !matchType) {
        return false;
      }
    }

    return true;
  });

  // Helper to check if equipment has test in current OS or globally
  const getEquipmentTestStatus = (eqId: string, tag: string) => {
    if (selectedOS) {
      const osTest = existingTests.find(t => t.serviceOrderId === selectedOS.id && (t.equipmentId === eqId || t.equipmentTag === tag));
      if (osTest) return { tested: true, inThisOS: true, test: osTest };
    }
    const globalTest = existingTests.find(t => t.equipmentId === eqId || t.equipmentTag === tag);
    if (globalTest) return { tested: true, inThisOS: false, test: globalTest };
    return { tested: false, inThisOS: false, test: null };
  };

  // Function to explicitly link and persist EPI to Selected Company and Service Order
  const saveAndLinkEquipment = (shouldNotify = true): Equipment => {
    try {
      const currentClients = clientsList.length > 0 ? clientsList : DielectricStorageService.getClients();
      const currentOrders = serviceOrders.length > 0 ? serviceOrders : DielectricStorageService.getServiceOrders();
      const targetOS = selectedOS || currentOrders.find(o => o.id === selectedOSId);
      const client = currentClients.find(c => c.id === (selectedClientId || targetOS?.clientId)) || currentClients[0];
      const finalClientId = client?.id || selectedClientId || targetOS?.clientId || selectedEquipment?.clientId || 'cli-1';
      const finalClientName = client?.nomeFantasia || client?.razaoSocial || targetOS?.clientName || selectedEquipment?.clientName || 'Cliente Geral';

      const finalTag = equipmentTag.trim() || selectedEquipment?.tag || `EPI-${selectedEquipmentType.toUpperCase().slice(0, 4)}-${Math.floor(10 + Math.random() * 90)}`;
      const finalSerial = equipmentSerial.trim() || selectedEquipment?.serialNumber || 'S/N';
      const finalCa = equipmentCa.trim() || selectedEquipment?.caNumber || undefined;
      const eqId = selectedEquipment?.id || selectedEquipmentId || ('eq-' + Date.now());

      const eqToSave: Equipment = {
        id: eqId,
        uuid: selectedEquipment?.uuid || ('uuid-' + Math.random().toString(36).substring(2, 9)),
        clientId: finalClientId,
        clientName: finalClientName,
        serviceOrderId: targetOS?.id || (selectedOSId ? selectedOSId : undefined),
        serviceOrderNumber: targetOS?.osNumber || undefined,
        type: selectedEquipmentType,
        tag: finalTag,
        serialNumber: finalSerial,
        caNumber: finalCa,
        manufacturer: equipmentManufacturer || selectedEquipment?.manufacturer || 'Fabricante Homologado',
        model: selectedEquipment?.model || 'Modelo Padrão',
        dielectricClass: selectedDielectricClass,
        collaboratorName: collaboratorName.trim() || undefined,
        collaboratorRegistration: collaboratorRegistration.trim() || undefined,
        collaboratorSector: collaboratorSector.trim() || undefined,
        acquisitionDate: selectedEquipment?.acquisitionDate || new Date().toISOString().split('T')[0],
        status: selectedEquipment?.status || 'em_uso',
        retestIntervalMonths: currentEvaluation?.recommendedRetestMonths || selectedEquipment?.retestIntervalMonths || 6,
        qrCode: finalTag,
        gloveLength_mm: selectedEquipmentType === 'luva_isolante' ? gloveLength_mm : undefined,
        blanketType: selectedEquipmentType === 'manta_isolante' ? blanketType : undefined,
        blanketStyle: selectedEquipmentType === 'manta_isolante' ? blanketStyle : undefined,
        blanketDimensions: selectedEquipmentType === 'manta_isolante' ? blanketDimensions : undefined,
        mattingSurface: selectedEquipmentType === 'tapete_isolante' ? mattingSurface : undefined,
        mattingThickness_mm: selectedEquipmentType === 'tapete_isolante' ? mattingThickness_mm : undefined,
        mattingDimensions: selectedEquipmentType === 'tapete_isolante' ? mattingDimensions : undefined,
        ladderType: selectedEquipmentType === 'escada_isolada' ? ladderType : undefined,
        ladderRungsCount: selectedEquipmentType === 'escada_isolada' ? ladderRungsInspectedCount : undefined,
        ladderLengthExtended_m: selectedEquipmentType === 'escada_isolada' ? ladderLengthExtended_m : undefined,
        ladderLoadCapacity_kg: selectedEquipmentType === 'escada_isolada' ? ladderLoadCapacity_kg : undefined,
        isolatedTools: selectedEquipmentType === 'ferramenta_isolada' ? isolatedTools : undefined,
        createdAt: selectedEquipment?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const saved = DielectricStorageService.saveEquipment(eqToSave);

      // If an OS is linked, ensure this equipment ID is in the OS's equipmentIds array!
      if (targetOS) {
        const currentEqIds = targetOS.equipmentIds || [];
        if (!currentEqIds.includes(saved.id)) {
          const updatedOS: ServiceOrder = {
            ...targetOS,
            equipmentIds: [...currentEqIds, saved.id],
            updatedAt: new Date().toISOString()
          };
          DielectricStorageService.saveServiceOrder(updatedOS);
          setServiceOrders(prev => prev.map(o => o.id === updatedOS.id ? updatedOS : o));
        }
      }

      // Update local state
      setSelectedEquipment(saved);
      setSelectedEquipmentId(saved.id);
      setEquipmentTag(saved.tag);
      setIsManualOverrideMode(false);
      const updatedEqList = DielectricStorageService.getEquipment();
      setEquipmentList(updatedEqList);

      if (shouldNotify) {
        setSaveEquipmentSuccessMsg(`EPI "${saved.tag}" vinculado com sucesso à Empresa "${finalClientName}"${targetOS ? ` e à OS "${targetOS.osNumber}"` : ''}!`);
        setTimeout(() => setSaveEquipmentSuccessMsg(null), 5000);
      }

      return saved;
    } catch (err) {
      console.warn('Erro ao salvar e vincular EPI:', err);
      // Fallback object so navigation never breaks
      return {
        id: selectedEquipmentId || ('eq-' + Date.now()),
        uuid: 'uuid-' + Math.random().toString(36).substring(2, 9),
        clientId: selectedClientId || 'cli-1',
        clientName: 'Cliente Geral',
        type: selectedEquipmentType,
        tag: equipmentTag || 'EPI-01',
        serialNumber: equipmentSerial || 'S/N',
        manufacturer: equipmentManufacturer || 'Fabricante Homologado',
        model: 'Modelo Padrão',
        dielectricClass: selectedDielectricClass,
        status: 'em_uso',
        retestIntervalMonths: 6,
        qrCode: equipmentTag || 'EPI-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  };

  // Complete and Save Test
  const handleFinalizeTest = () => {
    if (!currentEvaluation) return;

    const isEditing = Boolean(editingTest);
    const testNumber = editingTest?.testNumber || DielectricStorageService.generateNextTestNumber();
    const reportNumber = editingTest?.reportNumber || DielectricStorageService.generateNextReportNumber();
    const isEligibleForCert = currentEvaluation ? (currentEvaluation.result === 'APROVADO' || Boolean(currentEvaluation.toolsEvaluation?.canEmitPartialCertificate)) : false;
    const certificateNumber = isEditing
      ? (editingTest?.certificateNumber || ((emitCertificado && isEligibleForCert) ? DielectricStorageService.generateNextCertificateNumber() : undefined))
      : ((emitCertificado && isEligibleForCert) ? DielectricStorageService.generateNextCertificateNumber() : undefined);
    const validationCode = editingTest?.validationCode || DielectricStorageService.generateValidationCode();

    const client = clientsList.find(c => c.id === selectedClientId);
    const clientName = client?.nomeFantasia || client?.razaoSocial || selectedOS?.clientName || selectedEquipment?.clientName || editingTest?.clientName || 'Cliente Geral';
    const clientId = client?.id || selectedClientId || selectedOS?.clientId || selectedEquipment?.clientId || editingTest?.clientId || 'cli-1';

    // Calculate retest date (e.g. +6 or +12 months)
    const retestDateObj = new Date();
    retestDateObj.setMonth(retestDateObj.getMonth() + currentEvaluation.recommendedRetestMonths);
    const retestDueDate = retestDateObj.toISOString().split('T')[0];

    const finalTag = equipmentTag.trim() || selectedEquipment?.tag || editingTest?.equipmentTag || `EPI-${selectedEquipmentType.toUpperCase().slice(0, 4)}-${Math.floor(10 + Math.random() * 90)}`;
    const finalSerial = equipmentSerial.trim() || selectedEquipment?.serialNumber || editingTest?.equipmentSerial || 'S/N';
    const finalCa = equipmentCa.trim() || selectedEquipment?.caNumber || editingTest?.equipmentCa || undefined;

    const testToSave: TestRecord = {
      id: editingTest?.id || ('ens-' + Date.now()),
      uuid: editingTest?.uuid || ('uuid-' + Math.random().toString(36).substring(2, 10)),
      testNumber,
      reportNumber,
      certificateNumber,
      clientId,
      clientName,
      collaboratorName: collaboratorName.trim() || selectedEquipment?.collaboratorName || editingTest?.collaboratorName || undefined,
      collaboratorRegistration: collaboratorRegistration.trim() || selectedEquipment?.collaboratorRegistration || editingTest?.collaboratorRegistration || undefined,
      collaboratorSector: collaboratorSector.trim() || selectedEquipment?.collaboratorSector || selectedEquipment?.sector || editingTest?.collaboratorSector || undefined,
      equipmentId: selectedEquipment?.id || editingTest?.equipmentId || ('eq-' + Date.now()),
      equipmentTag: finalTag,
      equipmentType: selectedEquipmentType,
      equipmentClass: selectedDielectricClass,
      equipmentSerial: finalSerial,
      equipmentCa: finalCa,
      isolatedTools: selectedEquipmentType === 'ferramenta_isolada' ? isolatedTools : undefined,
      serviceOrderId: selectedOS?.id || editingTest?.serviceOrderId || 'os-geral',
      serviceOrderNumber: selectedOS?.osNumber || editingTest?.serviceOrderNumber || 'OS-AVULSA',
      artNumber: selectedOS?.artNumber || editingTest?.artNumber || undefined,
      technicianId: effectiveTechnician.id,
      technicianName: effectiveTechnician.name,
      technicianCftOrCrea: effectiveTechnician.creaOrCft || 'CFT-SP 1458920',
      techResponsibleId: effectiveTechResponsible.id,
      techResponsibleName: effectiveTechResponsible.name,
      techResponsibleCrea: effectiveTechResponsible.creaNumber || 'CREA-SP 5069874211/D',
      testDate: editingTest?.testDate || new Date().toISOString().split('T')[0],
      testTime: editingTest?.testTime || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      location: testLocation,
      normCriterionId: currentEvaluation.matchedCriterion?.id,
      normCode: EQUIPMENT_NORM_SPECIFICATIONS[selectedEquipmentType]?.norm || currentEvaluation.matchedCriterion?.normCode || 'Norma Geral NR-10',
      procedureCode: 'PR-JVM-LAB-01 Rev.08',
      appliedClass: selectedDielectricClass,
      gloveLength_mm: selectedEquipmentType === 'luva_isolante' ? gloveLength_mm : undefined,
      gloveTestMethod: selectedEquipmentType === 'luva_isolante' ? gloveTestMethod : undefined,
      moistureConditioning: selectedEquipmentType === 'luva_isolante' ? moistureConditioning : undefined,
      blanketType: selectedEquipmentType === 'manta_isolante' ? blanketType : undefined,
      blanketStyle: selectedEquipmentType === 'manta_isolante' ? blanketStyle : undefined,
      blanketDimensions: selectedEquipmentType === 'manta_isolante' ? blanketDimensions : undefined,
      mattingSurface: selectedEquipmentType === 'tapete_isolante' ? mattingSurface : undefined,
      mattingThickness_mm: selectedEquipmentType === 'tapete_isolante' ? mattingThickness_mm : undefined,
      mattingDimensions: selectedEquipmentType === 'tapete_isolante' ? mattingDimensions : undefined,
      testElectrodeType,
      flashoverClearance_mm: selectedEquipmentType === 'manta_isolante' ? getASTMD1048Entry(selectedDielectricClass)?.distanciaBordaEletrodo_mm : undefined,
      appliedVoltage_kV: appliedVoltage,
      voltageType,
      applicationDurationSeconds: durationSeconds,
      measuredLeakageCurrent_mA: leakageCurrent,
      leakageCurrentLimit_mA: currentEvaluation.appliedLimit,
      currentUnit: currentEvaluation.appliedUnit,
      withstandWithoutPuncture: withstandPuncture,
      environmental: {
        temperatureC: temperature,
        relativeHumidityPercent: relativeHumidity,
        instrumentUsedId: ambientInstrumentId,
        instrumentUsedName: instrumentsList.find(i => i.id === ambientInstrumentId)?.model,
        measurementDateTime: new Date().toISOString()
      },
      visualInspection: checklist,
      visualInspectionPassed: currentEvaluation.isVisualConforming,
      instrumentsUsed: selectedInstrumentsDetails.map(i => ({
        id: i.id,
        type: i.type,
        model: i.model,
        serialNumber: i.serialNumber,
        calibrationCert: i.calibrationCertNumber,
        calibrationExpiry: i.calibrationExpiryDate,
        isCalibrationValid: i.calibrationExpiryDate >= today
      })),
      calibrationOverrideAuthorizedBy: hasExpiredInstrument ? overrideCalibrationAuth : undefined,
      result: currentEvaluation.result,
      resultRationale: currentEvaluation.rationale,
      approvedOpinion: currentEvaluation.approvedOpinion,
      reprovedOpinion: currentEvaluation.reprovedOpinion,
      toolsEvaluation: currentEvaluation.toolsEvaluation,
      technicalNotes,
      retestDueDate,
      photos,
      technicianSignature: {
        signatureImage: technicianSig,
        userName: effectiveTechnician.name,
        userRole: effectiveTechnician.cargo || effectiveTechnician.role,
        documentNumber: effectiveTechnician.creaOrCft,
        signedAt: new Date().toISOString()
      },
      techResponsibleSignature: {
        signatureImage: techResponsibleSig,
        userName: effectiveTechResponsible.name,
        userRole: effectiveTechResponsible.title,
        documentNumber: effectiveTechResponsible.creaNumber,
        signedAt: new Date().toISOString()
      },
      validationCode,
      documentHash: editingTest?.documentHash || (Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)),
      createdAt: editingTest?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
      syncVersion: (editingTest?.syncVersion || 0) + 1,
      deviceId: getDeviceId()
    };

    // Target OS detection
    const targetOS = selectedOS || serviceOrders.find(o => o.id === selectedOSId || o.osNumber === editingTest?.serviceOrderNumber);
    const finalServiceOrderId = targetOS?.id || (selectedOSId && selectedOSId !== 'os-geral' ? selectedOSId : undefined);
    const finalServiceOrderNumber = targetOS?.osNumber || (editingTest?.serviceOrderNumber !== 'OS-AVULSA' ? editingTest?.serviceOrderNumber : undefined);

    // Save/Update equipment in inventory and ensure linkage to Company and OS
    const savedEquipment = DielectricStorageService.saveEquipment({
      id: selectedEquipment?.id || testToSave.equipmentId,
      uuid: selectedEquipment?.uuid || ('uuid-' + Math.random().toString(36).substring(2, 9)),
      clientId,
      clientName,
      serviceOrderId: finalServiceOrderId,
      serviceOrderNumber: finalServiceOrderNumber,
      type: selectedEquipmentType,
      tag: finalTag,
      serialNumber: finalSerial,
      caNumber: finalCa,
      manufacturer: equipmentManufacturer || selectedEquipment?.manufacturer || 'Fabricante Homologado',
      model: selectedEquipment?.model || 'Modelo Padrão',
      dielectricClass: selectedDielectricClass,
      collaboratorName: collaboratorName.trim() || undefined,
      collaboratorRegistration: collaboratorRegistration.trim() || undefined,
      collaboratorSector: collaboratorSector.trim() || undefined,
      acquisitionDate: selectedEquipment?.acquisitionDate || new Date().toISOString().split('T')[0],
      lastTestDate: testToSave.testDate,
      nextTestDueDate: testToSave.retestDueDate,
      retestIntervalMonths: currentEvaluation.recommendedRetestMonths || 6,
      status: (testToSave.result === 'APROVADO' || (selectedEquipmentType === 'ferramenta_isolada' && (currentEvaluation.toolsEvaluation?.approvedCount || 0) > 0)) ? 'em_uso' : 'reprovado',
      qrCode: finalTag,
      gloveLength_mm: selectedEquipmentType === 'luva_isolante' ? gloveLength_mm : undefined,
      blanketType: selectedEquipmentType === 'manta_isolante' ? blanketType : undefined,
      blanketStyle: selectedEquipmentType === 'manta_isolante' ? blanketStyle : undefined,
      blanketDimensions: selectedEquipmentType === 'manta_isolante' ? blanketDimensions : undefined,
      mattingSurface: selectedEquipmentType === 'tapete_isolante' ? mattingSurface : undefined,
      mattingThickness_mm: selectedEquipmentType === 'tapete_isolante' ? mattingThickness_mm : undefined,
      mattingDimensions: selectedEquipmentType === 'tapete_isolante' ? mattingDimensions : undefined,
      ladderType: selectedEquipmentType === 'escada_isolada' ? ladderType : undefined,
      ladderRungsCount: selectedEquipmentType === 'escada_isolada' ? ladderRungsInspectedCount : undefined,
      ladderLengthExtended_m: selectedEquipmentType === 'escada_isolada' ? ladderLengthExtended_m : undefined,
      ladderLoadCapacity_kg: selectedEquipmentType === 'escada_isolada' ? ladderLoadCapacity_kg : undefined,
      isolatedTools: selectedEquipmentType === 'ferramenta_isolada' ? isolatedTools : undefined,
      createdAt: selectedEquipment?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // If an OS is linked, ensure equipment ID is registered in the OS and OS status updated
    if (targetOS) {
      const eqId = savedEquipment.id;
      const currentEqIds = targetOS.equipmentIds || [];
      const isAlreadyInOS = currentEqIds.includes(eqId);
      const updatedOS: ServiceOrder = {
        ...targetOS,
        equipmentIds: isAlreadyInOS ? currentEqIds : [...currentEqIds, eqId],
        status: (targetOS.status === 'aberta' || targetOS.status === 'agendada') ? 'em_execucao' : targetOS.status,
        updatedAt: new Date().toISOString()
      };
      DielectricStorageService.saveServiceOrder(updatedOS);
    }

    // Auto-persist signatures as default for Analyst and RT if provided
    if (technicianSig) {
      handleSaveTechnicianDefaultSig(technicianSig);
    }
    if (techResponsibleSig) {
      handleSaveRTDefaultSig(techResponsibleSig);
    }

    const saved = DielectricStorageService.saveTestRecord(testToSave);
    onFinishTest(saved);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Edit Mode Notification Banner */}
      {editingTest && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-500 text-white font-bold text-[10px] rounded-md uppercase tracking-wider">
                  Modo de Edição de Ensaio Concluído
                </span>
                <span className="font-mono font-bold text-amber-900 text-xs">
                  {editingTest.reportNumber}
                </span>
              </div>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                Você está alterando os dados, medições e evidências do equipamento <strong className="font-mono">{editingTest.equipmentTag}</strong> ({editingTest.clientName}).
              </p>
            </div>
          </div>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs self-end sm:self-auto cursor-pointer"
            >
              Cancelar Edição
            </button>
          )}
        </div>
      )}

      {/* Wizard Progress Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${editingTest ? 'bg-amber-500' : 'bg-orange-500'} text-white flex items-center justify-center shadow-md`}>
              {editingTest ? <Edit3 className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingTest ? `Editar Ensaio Concluído (${editingTest.reportNumber})` : 'Novo Ensaio Dielétrico'}
              </h2>
              <p className="text-xs text-slate-500">
                {editingTest ? 'Revisão e atualização de medições, fotos e parâmetros técnicos' : 'Fluxo guiado de inspeção, medição e emissão de laudo técnico'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg self-start sm:self-auto">
            <span>Etapa {currentStep} de 6:</span>
            <span className="text-blue-700 font-bold">
              {currentStep === 1 && 'Identificação & OS'}
              {currentStep === 2 && 'Condições Ambientais'}
              {currentStep === 3 && 'Inspeção Visual'}
              {currentStep === 4 && 'Medições Elétricas & Fotos'}
              {currentStep === 5 && 'Instrumentação Utilizada'}
              {currentStep === 6 && 'Resultado & Assinaturas'}
            </span>
          </div>
        </div>

        {/* Step Indicator Pills */}
        <div className="grid grid-cols-6 gap-2 text-center text-xs">
          {[
            { step: 1, label: '1. Identificação' },
            { step: 2, label: '2. Ambiente' },
            { step: 3, label: '3. Checklist' },
            { step: 4, label: '4. Medições' },
            { step: 5, label: '5. Instrumentos' },
            { step: 6, label: '6. Assinaturas' }
          ].map(s => (
            <button
              key={s.step}
              onClick={() => {
                if (currentStep === 1 && s.step === 2) {
                  saveAndLinkEquipment(false);
                }
                if (selectedEquipmentType || s.step === 1) setCurrentStep(s.step);
              }}
              disabled={!selectedEquipmentType && s.step > 1}
              className={`py-2 px-1 rounded-xl font-semibold transition-all text-[11px] truncate ${
                currentStep === s.step
                  ? 'bg-[#0A2540] text-white shadow-sm'
                  : currentStep > s.step
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-50 text-slate-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* STEP 1: Identification & Equipment */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-blue-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                1. Seleção de Ordem de Serviço & Equipamento Cadastrado
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Selecione o EPI/EPC cadastrado na base ou vincule à Ordem de Serviço correspondente
              </p>
            </div>
            {selectedEquipment && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold self-start sm:self-auto">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                Equipamento Selecionado: <strong className="font-mono text-emerald-900">{selectedEquipment.tag}</strong>
              </span>
            )}
          </div>

          {/* Seleção de Ordem de Serviço (OS) */}
          <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                Ordem de Serviço (OS) Vinculada:
              </label>
              {selectedOS && (
                <span className="text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                  Cliente: {selectedOS.clientName}
                </span>
              )}
            </div>
            
            <select
              value={selectedOSId}
              onChange={(e) => {
                const osId = e.target.value;
                setSelectedOSId(osId);
                if (osId) {
                  const os = serviceOrders.find(o => o.id === osId);
                  if (os?.technicianId) {
                    setSelectedTechnicianId(os.technicianId);
                  }
                  if (os?.collaboratorName && !collaboratorName) {
                    setCollaboratorName(os.collaboratorName);
                  }
                  if (os?.collaboratorRegistration && !collaboratorRegistration) {
                    setCollaboratorRegistration(os.collaboratorRegistration);
                  }
                  if (os?.collaboratorSector && !collaboratorSector) {
                    setCollaboratorSector(os.collaboratorSector);
                  }
                  if (os?.equipmentIds && os.equipmentIds.length > 0) {
                    setEquipmentScopeFilter('os');
                    const firstEq = equipmentList.find(eq => os.equipmentIds.includes(eq.id));
                    if (firstEq) handleSelectEquipment(firstEq);
                  }
                }
              }}
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium bg-white"
            >
              <option value="">Selecione uma OS cadastrada (ou Ensaio Avulso)...</option>
              {serviceOrders.map(os => (
                <option key={os.id} value={os.id}>
                  {os.osNumber} - {os.clientName} ({os.status.toUpperCase()}) — {os.equipmentIds?.length || 0} equipamento(s)
                </option>
              ))}
            </select>

            {selectedOS && (
              <div className="px-3 py-2 bg-blue-50 border border-blue-200/80 rounded-lg flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-700 font-medium flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600 inline shrink-0" />
                  Analista da OS: <strong className="text-slate-900">{selectedOS.technicianName || effectiveTechnician.name}</strong>
                </span>
                <div className="flex items-center gap-2">
                  {selectedOS.artNumber && (
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-[10px] border border-amber-300">
                      ART: {selectedOS.artNumber}
                    </span>
                  )}
                  <span className="text-blue-800 font-bold bg-white px-2 py-0.5 rounded border border-blue-200 text-[10px]">
                    {selectedOS.equipmentIds?.length || 0} item(ns) vinculados
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Formulário de Conferência e Parâmetros Técnicos do Equipamento */}
          {/* Dados e Especificações Técnicas para o Laudo */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                Dados e Especificações Técnicas do EPI para o Laudo
              </h4>
              {selectedEquipment && (
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  EPI ({selectedEquipment.tag || equipmentTag})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  Tipo de EPI / EPC para Ensaio:
                </label>
                <select
                  value={selectedEquipmentType}
                  onChange={(e) => handleSelectEquipmentType(e.target.value as EquipmentType)}
                  className="w-full p-2.5 text-xs border-2 border-blue-500 bg-blue-50/20 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                >
                  {(Object.keys(EQUIPMENT_NORM_SPECIFICATIONS) as EquipmentType[]).map((typeKey) => (
                    <option key={typeKey} value={typeKey}>
                      {EQUIPMENT_NORM_SPECIFICATIONS[typeKey].fullLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Classe Dielétrica:
                </label>
                <select
                  value={selectedDielectricClass}
                  onChange={(e) => handleSelectClass(e.target.value as DielectricClass)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="00">Classe 00 — Tensão de Uso: 500 Vca | Ensaio: 2,5 kV</option>
                  <option value="0">Classe 0 — Tensão de Uso: 1.000 Vca | Ensaio: 5,0 kV</option>
                  <option value="1">Classe 1 — Tensão de Uso: 7.500 Vca | Ensaio: 10,0 kV</option>
                  <option value="2">Classe 2 — Tensão de Uso: 17.000 Vca | Ensaio: 20,0 kV</option>
                  <option value="3">Classe 3 — Tensão de Uso: 26.500 Vca | Ensaio: 30,0 kV</option>
                  <option value="4">Classe 4 — Tensão de Uso: 36.000 Vca | Ensaio: 40,0 kV</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tag / Identificação do EPI:
                </label>
                <input
                  type="text"
                  value={equipmentTag}
                  onChange={(e) => setEquipmentTag(e.target.value)}
                  placeholder="Ex: TAG-LUV-01"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CA (Certificado de Aprovação MTE):
                </label>
                <input
                  type="text"
                  value={equipmentCa}
                  onChange={(e) => setEquipmentCa(e.target.value)}
                  placeholder="Ex: CA 29774"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fabricante / Nº de Série:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={equipmentManufacturer}
                    onChange={(e) => setEquipmentManufacturer(e.target.value)}
                    placeholder="Fabricante (Ex: Orion)"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                  <input
                    type="text"
                    value={equipmentSerial}
                    onChange={(e) => setEquipmentSerial(e.target.value)}
                    placeholder="Nº Série (Ex: SN-4982)"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium font-mono"
                  />
                </div>
              </div>

              {/* Campos: Nome/Colaborador, Matrícula Funcional e Setor/Lotação */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alocação / Colaborador:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={collaboratorName}
                    onChange={(e) => setCollaboratorName(e.target.value)}
                    placeholder="Colaborador"
                    className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                  <input
                    type="text"
                    value={collaboratorRegistration}
                    onChange={(e) => setCollaboratorRegistration(e.target.value)}
                    placeholder="Matrícula"
                    className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium font-mono"
                  />
                  <input
                    type="text"
                    value={collaboratorSector}
                    onChange={(e) => setCollaboratorSector(e.target.value)}
                    placeholder="Setor"
                    className="w-full p-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

            {/* Campo de Comprimento da Luva Isolante (NBR 16295 Tabela 4) */}
            {selectedEquipmentType === 'luva_isolante' && (
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Comprimento da Luva (ABNT NBR 16295 Tabela 4):
                  </label>
                  <span className="text-[11px] font-bold font-mono text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                    Classe {selectedDielectricClass} • {gloveLength_mm} mm
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {NBR_16295_LENGTH_OPTIONS.map((opt) => {
                    const classEntry = TABELA_4_NBR_16295.find(e => e.classe === selectedDielectricClass);
                    const isApplicable = classEntry ? classEntry.limitesFugaAC_mA[opt.value] !== null : true;
                    const isSelected = gloveLength_mm === opt.value;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGloveLength_mm(opt.value)}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : isApplicable
                            ? 'bg-white border-slate-200 text-slate-800 hover:border-blue-300'
                            : 'bg-slate-100/80 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold font-mono text-xs">{opt.label}</span>
                          {!isApplicable && (
                            <span className="text-[9px] font-semibold bg-amber-100 text-amber-800 px-1 rounded">
                              N/a
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] block mt-0.5 leading-tight ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                          {isApplicable 
                            ? `Fuga máx (2 luvas): ${(classEntry?.limitesFugaAC_mA[opt.value] || 0) * 2} mA (${classEntry?.limitesFugaAC_mA[opt.value]}x2)`
                            : 'Não aplicável nesta classe'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Configuração Específica ASTM D1048 para Mantas e Lençóis Isolantes */}
            {selectedEquipmentType === 'manta_isolante' && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Parâmetros Normativos ASTM D1048-14 (Mantas Isolantes):
                  </label>
                  <span className="text-[11px] font-bold font-mono text-amber-800 bg-white px-2 py-0.5 rounded-md border border-amber-200 self-start sm:self-auto">
                    Classe {selectedDielectricClass} • Folga de Borda: {getASTMD1048Entry(selectedDielectricClass)?.distanciaBordaEletrodo_pol || '51 mm'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Estilo da Manta (Style) */}
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      Estilo Construtivo (Style):
                    </label>
                    <select
                      value={blanketStyle}
                      onChange={(e) => setBlanketStyle(e.target.value as BlanketStyle)}
                      className="w-full p-2 text-xs bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 font-semibold"
                    >
                      {BLANKET_STYLES_INFO.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo de Elastômero (Type) */}
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      Tipo de Elastômero (Type):
                    </label>
                    <select
                      value={blanketType}
                      onChange={(e) => setBlanketType(e.target.value as BlanketType)}
                      className="w-full p-2 text-xs bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 font-semibold"
                    >
                      {BLANKET_TYPES_INFO.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Dimensões Padrão */}
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      Dimensões da Manta:
                    </label>
                    <select
                      value={blanketDimensions}
                      onChange={(e) => setBlanketDimensions(e.target.value)}
                      className="w-full p-2 text-xs bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 font-semibold"
                    >
                      {BLANKET_SIZES_INFO.map(sz => (
                        <option key={sz.value} value={sz.value}>{sz.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ASTM D1048 Table 1 & 2 Summary Bar */}
                {(() => {
                  const astm = getASTMD1048Entry(selectedDielectricClass);
                  if (!astm) return null;
                  return (
                    <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-medium">Tensão de Prova AC:</span>
                        <span className="font-extrabold font-mono text-amber-900">{astm.tensaoProvaAC_kV} kV CA (60s)</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-medium">Tensão de Prova DC:</span>
                        <span className="font-extrabold font-mono text-amber-800">{astm.tensaoProvaDC_kV} kV CC</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-medium">Espessura Norma (Tab. 2):</span>
                        <span className="font-extrabold font-mono text-slate-800">{astm.espessuraMin_mm} a {astm.espessuraMax_mm} mm</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-medium">Folga Anti-Arco (Clearance):</span>
                        <span className="font-extrabold font-mono text-blue-700">{astm.distanciaBordaEletrodo_pol}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Configuração Específica ASTM D178 para Tapetes Isolantes */}
            {selectedEquipmentType === 'tapete_isolante' && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Parâmetros Normativos ASTM D178-22 (Tapetes Isolantes de Borracha):
                  </label>
                  <span className="text-[11px] font-bold font-mono text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200 self-start sm:self-auto">
                    Classe {selectedDielectricClass} • Espessura Mín.: {getASTMD178Entry(selectedDielectricClass)?.espessuraMinima_pol || '3,2 mm'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Superfície */}
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                      Padrão de Superfície:
                    </label>
                    <select
                      value={mattingSurface}
                      onChange={(e) => setMattingSurface(e.target.value as MattingSurface)}
                      className="w-full p-2 text-xs bg-white border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      {MATTING_SURFACES_INFO.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Espessura Medida (mm) */}
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                      Espessura Medida (mm):
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={mattingThickness_mm}
                      onChange={(e) => setMattingThickness_mm(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 text-xs bg-white border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-900"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Mínimo ASTM D178: {getASTMD178Entry(selectedDielectricClass)?.espessuraMinima_mm || 3.2} mm
                    </span>
                  </div>

                  {/* Dimensões / Rolo */}
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                      Dimensões do Tapete / Manta:
                    </label>
                    <input
                      type="text"
                      value={mattingDimensions}
                      onChange={(e) => setMattingDimensions(e.target.value)}
                      placeholder="Ex: 1,0m x 2,0m ou Rolo 10m"
                      className="w-full p-2 text-xs bg-white border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* ASTM D178 Summary Bar */}
                {(() => {
                  const astm = getASTMD178Entry(selectedDielectricClass);
                  if (!astm) return null;
                  return (
                    <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-medium">Tensão de Prova AC:</span>
                        <span className="font-extrabold font-mono text-emerald-900">{astm.tensaoProvaAC_kV} kV CA (60s)</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-medium">Tensão de Prova DC:</span>
                        <span className="font-extrabold font-mono text-emerald-800">{astm.tensaoProvaDC_kV} kV CC</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-medium">Rigidez Dielétrica Mín.:</span>
                        <span className="font-extrabold font-mono text-indigo-900">{astm.tensaoRigidezAC_kV} kV CA</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block font-medium">Tensão Máx. de Uso:</span>
                        <span className="font-extrabold font-mono text-slate-800">{astm.tensaoMaximaUsoAC_kV * 1000} V CA</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

          {/* Campo Especial de Seleção de Ferramentas Manuais Isoladas (Chaves, Alicates, Qtd e Fabricante) */}
          {selectedEquipmentType === 'ferramenta_isolada' && (
            <IsolatedToolsSelector
              tools={isolatedTools}
              onChange={setIsolatedTools}
              defaultManufacturer={equipmentManufacturer || 'Gedore'}
            />
          )}

          {/* Selected Equipment Preview Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-600 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Resumo do EPI Selecionado para Ensaio
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                Classe {selectedDielectricClass}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Tipo de EPI / EPC:</span>
                <span className="font-bold text-slate-900">
                  {EQUIPMENT_NORM_SPECIFICATIONS[selectedEquipmentType]?.label || selectedEquipmentType.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Tag / Identificação:</span>
                <span className="font-bold text-blue-700 font-mono">{equipmentTag || 'Sem Tag'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Norma de Ensaio:</span>
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                  {EQUIPMENT_NORM_SPECIFICATIONS[selectedEquipmentType]?.norm || 'Norma Geral NR-10'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Tensão de Ensaio:</span>
                <span className="font-bold text-amber-700 font-mono">{appliedVoltage} kV ({voltageType})</span>
              </div>
              <div>
                <span className="text-slate-500 block">CA (MTE):</span>
                <span className="font-semibold text-slate-900">{equipmentCa || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Fabricante / Série:</span>
                <span className="font-semibold text-slate-800">{equipmentManufacturer || 'Homologado'} ({equipmentSerial || 'S/N'})</span>
              </div>
              <div>
                <span className="text-slate-500 block">Ordem de Serviço:</span>
                <span className="font-bold text-slate-900">{serviceOrders.find(o => o.id === selectedOSId)?.osNumber || 'Avulsa / Geral'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Colaborador / Setor:</span>
                <span className="font-semibold text-orange-700">
                  {collaboratorName 
                    ? `${collaboratorName}${collaboratorRegistration ? ` (Mat: ${collaboratorRegistration})` : ''}${collaboratorSector ? ` • ${collaboratorSector}` : ''}` 
                    : 'Não atribuído'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>
                Ao avançar, os dados do EPI serão salvos e vinculados à OS{' '}
                <strong className="text-slate-800 font-mono font-bold">
                  {serviceOrders.find(o => o.id === selectedOSId)?.osNumber || 'Avulsa'}
                </strong>
              </span>
            </div>

            <button
              onClick={() => {
                saveAndLinkEquipment(false);
                setCurrentStep(2);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all bg-blue-600 hover:bg-blue-700 active:scale-98 text-white cursor-pointer self-stretch sm:self-auto"
            >
              <span>Avançar para Condições Ambientais (Etapa 2)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Environmental Conditions */}
      {currentStep === 2 && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-blue-700">
            2. Condições Ambientais e Local de Ensaio
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-orange-500" />
                Temperatura Ambiente (°C):
              </label>
              <input
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Faixa recomendada: 20°C a 26°C</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-blue-500" />
                Umidade Relativa (% UR):
              </label>
              <input
                type="number"
                step="0.5"
                value={relativeHumidity}
                onChange={(e) => setRelativeHumidity(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Faixa recomendada: 45% a 75%</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Instrumento Termohigrômetro:
              </label>
              <select
                value={ambientInstrumentId}
                onChange={(e) => setAmbientInstrumentId(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
              >
                {instrumentsList.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.type} - {inst.model} (Calibração {inst.calibrationCertNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Local do Ensaio:
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-medium">Sugestões:</span>
                <button
                  type="button"
                  onClick={() => setTestLocation('Laboratório Móvel JVM')}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors ${
                    testLocation === 'Laboratório Móvel JVM'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Laboratório Móvel JVM
                </button>
                <button
                  type="button"
                  onClick={() => setTestLocation('Laboratório Central JVM')}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                    testLocation === 'Laboratório Central JVM'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Laboratório Central JVM
                </button>
                <button
                  type="button"
                  onClick={() => setTestLocation('Instalações do Cliente (In Company)')}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                    testLocation.includes('Cliente')
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  In Company
                </button>
              </div>
            </div>
            <input
              type="text"
              value={testLocation}
              onChange={(e) => setTestLocation(e.target.value)}
              placeholder="Ex: Laboratório Móvel JVM"
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
            >
              Avançar para Inspeção Visual <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Visual Inspection Checklist */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-blue-700">
                3. Inspeção Visual e Exame Preliminar
              </h3>
              <p className="text-xs text-slate-500">
                Verifique minuciosamente cada item antes de submeter o equipamento à alta tensão.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {checklist.map((chk, idx) => (
              <div
                key={chk.id}
                className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex-1">
                  <span className="text-xs font-bold text-slate-800 block">
                    {idx + 1}. {chk.item}
                  </span>
                  <input
                    type="text"
                    placeholder="Observações (opcional)..."
                    value={chk.observation || ''}
                    onChange={(e) => handleChecklistChange(chk.id, chk.status, e.target.value)}
                    className="mt-1.5 w-full p-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleChecklistChange(chk.id, 'conforme')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      chk.status === 'conforme'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Conforme
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChecklistChange(chk.id, 'nao_conforme')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      chk.status === 'nao_conforme'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Não Conforme
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChecklistChange(chk.id, 'nao_aplicavel')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      chk.status === 'nao_aplicavel'
                        ? 'bg-slate-700 text-white'
                        : 'bg-white border border-slate-300 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    N/A
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Inspeção e Aprovação Individual de Ferramentas Isoladas na Etapa 3 */}
          {selectedEquipmentType === 'ferramenta_isolada' && (
            <div className="pt-2 border-t border-slate-200">
              <IsolatedToolsSelector
                tools={isolatedTools}
                onChange={setIsolatedTools}
                defaultManufacturer={equipmentManufacturer || 'Gedore'}
                showEvaluationControls={true}
              />
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm"
            >
              Avançar para Medições Elétricas <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Electrical Dielectric Measurements */}
      {currentStep === 4 && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-blue-700">
                4. Registro de Medições Dielétricas (Hipot / Rigidez)
              </h3>
              <p className="text-xs text-slate-500">
                Os limites e critérios são carregados automaticamente conforme a norma selecionada.
              </p>
            </div>

            <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full">
              Norma: {EQUIPMENT_NORM_SPECIFICATIONS[selectedEquipmentType]?.norm || currentEvaluation?.matchedCriterion?.normCode || 'Norma Técnica'}
            </span>
          </div>

          {/* Norm Criterion Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Norma e Critério Técnico de Avaliação:
              </label>
              {EQUIPMENT_NORM_SPECIFICATIONS[selectedEquipmentType] && (
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  Norma {EQUIPMENT_NORM_SPECIFICATIONS[selectedEquipmentType].norm}
                </span>
              )}
            </div>
            <select
              value={selectedNormId}
              onChange={(e) => {
                setSelectedNormId(e.target.value);
                const norm = normsList.find(n => n.id === e.target.value);
                if (norm) {
                  setAppliedVoltage(norm.testVoltage_kV);
                  setVoltageType(norm.voltageType);
                  setDurationSeconds(norm.testDurationSeconds);
                }
              }}
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold bg-white"
            >
              {(() => {
                const applicableNorms = normsList.filter(n => n.applicableEquipmentTypes?.includes(selectedEquipmentType));
                const otherNorms = normsList.filter(n => !n.applicableEquipmentTypes?.includes(selectedEquipmentType));
                const eqLabel = EQUIPMENT_NORM_SPECIFICATIONS[selectedEquipmentType]?.label || 'Equipamento Selecionado';

                return (
                  <>
                    {applicableNorms.length > 0 && (
                      <optgroup label={`⭐ Normas Aplicáveis (${eqLabel})`}>
                        {applicableNorms.map(n => (
                          <option key={n.id} value={n.id}>
                            {n.normCode} - {n.normName} (Tensão: {n.testVoltage_kV}kV {n.voltageType}, Fuga máx: {n.maxLeakageCurrent}{n.currentUnit})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {otherNorms.length > 0 && (
                      <optgroup label="Outras Normas Cadastradas no Laboratório">
                        {otherNorms.map(n => (
                          <option key={n.id} value={n.id}>
                            {n.normCode} - {n.normName} (Tensão: {n.testVoltage_kV}kV {n.voltageType}, Fuga máx: {n.maxLeakageCurrent}{n.currentUnit})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                );
              })()}
            </select>
          </div>

          {/* NBR 16295 Tabela 4 Dedicated Glove Controls */}
          {selectedEquipmentType === 'luva_isolante' && (
            <div className="p-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border border-blue-200 rounded-2xl space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    4
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-blue-950">
                      Parâmetros Normativos NBR 16295 — Tabela 4 (Luvas Isolantes)
                    </h4>
                    <p className="text-[11px] text-blue-700">
                      Cálculo de corrente máxima de fuga conforme comprimento e condicionamento de umidade.
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-extrabold font-mono bg-blue-600 text-white px-2.5 py-1 rounded-full self-start sm:self-auto">
                  Classe {selectedDielectricClass} • {gloveLength_mm} mm
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Method selector */}
                <div>
                  <label className="block text-xs font-bold text-blue-950 mb-1">
                    Método de Ensaio Elétrico:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setGloveTestMethod('ensaio_prova');
                        const v = getNBR16295Voltages(selectedDielectricClass);
                        if (v) setAppliedVoltage(v.tensaoProva_kV);
                      }}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        gloveTestMethod === 'ensaio_prova'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white border-blue-200 text-slate-700 hover:bg-blue-50'
                      }`}
                    >
                      <span className="font-bold text-xs block">Ensaio de Prova</span>
                      <span className={`text-[10px] block ${gloveTestMethod === 'ensaio_prova' ? 'text-blue-100' : 'text-slate-500'}`}>
                        Item 8.4.2.1 ({getNBR16295Voltages(selectedDielectricClass)?.tensaoProva_kV || 0} kV)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setGloveTestMethod('rigidez_dieletrica');
                        const v = getNBR16295Voltages(selectedDielectricClass);
                        if (v) setAppliedVoltage(v.tensaoRigidez_kV);
                      }}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        gloveTestMethod === 'rigidez_dieletrica'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white border-blue-200 text-slate-700 hover:bg-blue-50'
                      }`}
                    >
                      <span className="font-bold text-xs block">Rigidez Dielétrica</span>
                      <span className={`text-[10px] block ${gloveTestMethod === 'rigidez_dieletrica' ? 'text-blue-100' : 'text-slate-500'}`}>
                        Item 8.4.2.2 ({getNBR16295Voltages(selectedDielectricClass)?.tensaoRigidez_kV || 0} kV)
                      </span>
                    </button>
                  </div>
                </div>

                {/* Moisture conditioning toggle */}
                <div>
                  <label className="block text-xs font-bold text-blue-950 mb-1">
                    Condicionamento de Umidade (Nota c):
                  </label>
                  <label className={`flex items-start gap-2.5 p-2.5 bg-white rounded-xl border transition-all cursor-pointer ${
                    moistureConditioning ? 'border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50/40' : 'border-blue-200 hover:border-blue-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={moistureConditioning}
                      onChange={(e) => setMoistureConditioning(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">
                        Absorção de Umidade (+2,0 mA)
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Aplica acréscimo de 2 mA ao limite máximo de fuga conforme Nota c da Tabela 4.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Live Tabela 4 Summary Row */}
              {(() => {
                const entry = TABELA_4_NBR_16295.find(e => e.classe === selectedDielectricClass);
                if (!entry) return null;
                const baseLimit = entry.limitesFugaAC_mA[gloveLength_mm];
                const singleLimit = baseLimit !== null ? (moistureConditioning ? baseLimit + 2 : baseLimit) : null;
                const doubledLimit = singleLimit !== null ? singleLimit * 2 : null;

                return (
                  <div className="bg-white/90 p-2.5 rounded-xl border border-blue-200/70 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Tensão de Prova:</span>
                      <span className="font-extrabold font-mono text-blue-900">{entry.tensaoProvaAC_kV} kV CA</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Tensão de Rigidez:</span>
                      <span className="font-extrabold font-mono text-indigo-900">{entry.tensaoRigidezAC_kV} kV CA</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Tensão Máx. de Uso:</span>
                      <span className="font-extrabold font-mono text-slate-800">{entry.tensaoMaximaUsoAC_kV * 1000} V CA</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Limite Fuga (2 Luvas Simultâneas):</span>
                      <span className="font-extrabold font-mono text-blue-700">
                        {doubledLimit !== null ? `${doubledLimit.toFixed(1)} mA` : 'N/A nesta classe'}
                        {singleLimit !== null && (
                          <span className="text-[9px] text-slate-500 font-semibold ml-1">({singleLimit} mA × 2)</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ASTM D1048 Mantas Isolantes Test Method & Voltage Quick Config */}
          {selectedEquipmentType === 'manta_isolante' && (
            <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                    Método de Ensaio Elétrico ASTM D1048-14 (Mantas Isolantes)
                  </span>
                </div>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300">
                  Folga de Borda: {getASTMD1048Entry(selectedDielectricClass)?.distanciaBordaEletrodo_pol || '51 mm'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBlanketMattingTestMethod('ensaio_prova_ac');
                    const astm = getASTMD1048Entry(selectedDielectricClass);
                    if (astm) {
                      setAppliedVoltage(astm.tensaoProvaAC_kV);
                      setVoltageType('AC');
                      setDurationSeconds(60);
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    blanketMattingTestMethod === 'ensaio_prova_ac'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white border-amber-200 text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  <span className="font-bold text-xs block">Ensaio de Prova CA (AC Proof)</span>
                  <span className={`text-[10px] block ${blanketMattingTestMethod === 'ensaio_prova_ac' ? 'text-amber-100' : 'text-slate-500'}`}>
                    {getASTMD1048Entry(selectedDielectricClass)?.tensaoProvaAC_kV || 0} kV CA • 60 seg
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBlanketMattingTestMethod('ensaio_prova_dc');
                    const astm = getASTMD1048Entry(selectedDielectricClass);
                    if (astm) {
                      setAppliedVoltage(astm.tensaoProvaDC_kV);
                      setVoltageType('DC');
                      setDurationSeconds(60);
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    blanketMattingTestMethod === 'ensaio_prova_dc'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white border-amber-200 text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  <span className="font-bold text-xs block">Ensaio de Prova CC (DC Proof)</span>
                  <span className={`text-[10px] block ${blanketMattingTestMethod === 'ensaio_prova_dc' ? 'text-amber-100' : 'text-slate-500'}`}>
                    {getASTMD1048Entry(selectedDielectricClass)?.tensaoProvaDC_kV || 0} kV CC • 60 seg
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBlanketMattingTestMethod('rigidez_dieletrica_ac');
                    const astm = getASTMD1048Entry(selectedDielectricClass);
                    if (astm) {
                      setAppliedVoltage(astm.tensaoRigidezAC_kV);
                      setVoltageType('AC');
                      setDurationSeconds(60);
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    blanketMattingTestMethod === 'rigidez_dieletrica_ac'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white border-amber-200 text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  <span className="font-bold text-xs block">Rigidez Dielétrica Breakdown</span>
                  <span className={`text-[10px] block ${blanketMattingTestMethod === 'rigidez_dieletrica_ac' ? 'text-amber-100' : 'text-slate-500'}`}>
                    {getASTMD1048Entry(selectedDielectricClass)?.tensaoRigidezAC_kV || 0} kV CA Breakdown
                  </span>
                </button>
              </div>

              {/* ASTM D1048 Summary Live Bar */}
              {(() => {
                const astm = getASTMD1048Entry(selectedDielectricClass);
                if (!astm) return null;
                return (
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/70 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Tensão de Ensaio:</span>
                      <span className="font-extrabold font-mono text-amber-900">{appliedVoltage} kV {voltageType}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Folga Anti-Arco (Flashover):</span>
                      <span className="font-extrabold font-mono text-blue-700">{astm.distanciaBordaEletrodo_pol}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Espessura Permitida:</span>
                      <span className="font-extrabold font-mono text-slate-800">{astm.espessuraMin_mm} a {astm.espessuraMax_mm} mm</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Critério de Aprovação:</span>
                      <span className="font-extrabold font-mono text-emerald-700">Sem Perfuração / Arco</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ASTM D178 Tapetes Isolantes Test Method & Voltage Quick Config */}
          {selectedEquipmentType === 'tapete_isolante' && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Método de Ensaio Elétrico ASTM D178-22 (Tapetes Isolantes)
                  </span>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                  Espessura Mínima: {getASTMD178Entry(selectedDielectricClass)?.espessuraMinima_pol || '3,2 mm'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBlanketMattingTestMethod('ensaio_prova_ac');
                    const astm = getASTMD178Entry(selectedDielectricClass);
                    if (astm) {
                      setAppliedVoltage(astm.tensaoProvaAC_kV);
                      setVoltageType('AC');
                      setDurationSeconds(60);
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    blanketMattingTestMethod === 'ensaio_prova_ac'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-emerald-200 text-slate-700 hover:bg-emerald-50'
                  }`}
                >
                  <span className="font-bold text-xs block">Ensaio de Prova CA (AC Proof)</span>
                  <span className={`text-[10px] block ${blanketMattingTestMethod === 'ensaio_prova_ac' ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {getASTMD178Entry(selectedDielectricClass)?.tensaoProvaAC_kV || 0} kV CA • 60 seg
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBlanketMattingTestMethod('ensaio_prova_dc');
                    const astm = getASTMD178Entry(selectedDielectricClass);
                    if (astm) {
                      setAppliedVoltage(astm.tensaoProvaDC_kV);
                      setVoltageType('DC');
                      setDurationSeconds(60);
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    blanketMattingTestMethod === 'ensaio_prova_dc'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-emerald-200 text-slate-700 hover:bg-emerald-50'
                  }`}
                >
                  <span className="font-bold text-xs block">Ensaio de Prova CC (DC Proof)</span>
                  <span className={`text-[10px] block ${blanketMattingTestMethod === 'ensaio_prova_dc' ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {getASTMD178Entry(selectedDielectricClass)?.tensaoProvaDC_kV || 0} kV CC • 60 seg
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBlanketMattingTestMethod('rigidez_dieletrica_ac');
                    const astm = getASTMD178Entry(selectedDielectricClass);
                    if (astm) {
                      setAppliedVoltage(astm.tensaoRigidezAC_kV);
                      setVoltageType('AC');
                      setDurationSeconds(60);
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    blanketMattingTestMethod === 'rigidez_dieletrica_ac'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-emerald-200 text-slate-700 hover:bg-emerald-50'
                  }`}
                >
                  <span className="font-bold text-xs block">Rigidez Dielétrica Breakdown</span>
                  <span className={`text-[10px] block ${blanketMattingTestMethod === 'rigidez_dieletrica_ac' ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {getASTMD178Entry(selectedDielectricClass)?.tensaoRigidezAC_kV || 0} kV CA Breakdown
                  </span>
                </button>
              </div>

              {/* ASTM D178 Summary Live Bar */}
              {(() => {
                const astm = getASTMD178Entry(selectedDielectricClass);
                if (!astm) return null;
                const isThicknessOk = mattingThickness_mm >= astm.espessuraMinima_mm;
                return (
                  <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-200/70 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Tensão de Ensaio:</span>
                      <span className="font-extrabold font-mono text-emerald-900">{appliedVoltage} kV {voltageType}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Espessura Medida / Mínima:</span>
                      <span className={`font-extrabold font-mono ${isThicknessOk ? 'text-emerald-700' : 'text-red-600'}`}>
                        {mattingThickness_mm} mm / {astm.espessuraMinima_mm} mm {isThicknessOk ? '✓' : '⚠️'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Tensão Máx. de Uso:</span>
                      <span className="font-extrabold font-mono text-slate-800">{astm.tensaoMaximaUsoAC_kV * 1000} V CA</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Critério de Aprovação:</span>
                      <span className="font-extrabold font-mono text-emerald-700">Sem Perfuração + Espessura</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Escadas Isoladas (EN 50528:2024 / NBR IEC 61478) Quick Config */}
          {selectedEquipmentType === 'escada_isolada' && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-300 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                    Método de Ensaio Elétrico em Escadas Isolantes (PRFV)
                  </span>
                </div>
                <span className="text-[11px] font-bold text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-200 self-start sm:self-auto">
                  {ladderTestMethod.includes('en50528') ? 'Norma EN 50528:2024 (Baixa Tensão)' : 'Norma ABNT NBR IEC 61478 (Linha Viva)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLadderTestMethod('baixa_tensao_en50528_36kv');
                    const entry = getLadderNormEntry('baixa_tensao_en50528_36kv');
                    if (entry) {
                      setAppliedVoltage(entry.testVoltageAC_kV);
                      setVoltageType('AC');
                      setDurationSeconds(entry.testDurationSeconds);
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    ladderTestMethod === 'baixa_tensao_en50528_36kv'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white border-indigo-200 text-slate-700 hover:bg-indigo-50'
                  }`}
                >
                  <span className="font-bold text-xs block">Baixa Tensão (EN 50528:2024)</span>
                  <span className={`text-[10px] block ${ladderTestMethod === 'baixa_tensao_en50528_36kv' ? 'text-indigo-100' : 'text-slate-500'}`}>
                    36 kV CA • 60s • Fuga ≤ 0,50 mA
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLadderTestMethod('baixa_tensao_en50528_degraus');
                    const entry = getLadderNormEntry('baixa_tensao_en50528_degraus');
                    if (entry) {
                      setAppliedVoltage(entry.testVoltageAC_kV);
                      setVoltageType('AC');
                      setDurationSeconds(entry.testDurationSeconds);
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    ladderTestMethod === 'baixa_tensao_en50528_degraus'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white border-indigo-200 text-slate-700 hover:bg-indigo-50'
                  }`}
                >
                  <span className="font-bold text-xs block">Degraus BT (EN 50528:2024)</span>
                  <span className={`text-[10px] block ${ladderTestMethod === 'baixa_tensao_en50528_degraus' ? 'text-indigo-100' : 'text-slate-500'}`}>
                    36 kV CA • 60s • Fuga ≤ 0,30 mA
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLadderTestMethod('segmento_300mm_100kv');
                    const entry = getLadderNormEntry('segmento_300mm_100kv');
                    if (entry) {
                      setAppliedVoltage(entry.testVoltageAC_kV);
                      setVoltageType('AC');
                      setDurationSeconds(entry.testDurationSeconds);
                    }
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    ladderTestMethod === 'segmento_300mm_100kv'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white border-indigo-200 text-slate-700 hover:bg-indigo-50'
                  }`}
                >
                  <span className="font-bold text-xs block">Segmento 300 mm (NBR IEC 61478)</span>
                  <span className={`text-[10px] block ${ladderTestMethod === 'segmento_300mm_100kv' ? 'text-indigo-100' : 'text-slate-500'}`}>
                    100 kV CA • 60s • Fuga ≤ 0,10 mA
                  </span>
                </button>
              </div>

              {/* Summary of current ladder norm */}
              {(() => {
                const normEntry = getLadderNormEntry(ladderTestMethod);
                if (!normEntry) return null;
                return (
                  <div className="bg-white/90 p-2.5 rounded-xl border border-indigo-200/70 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Norma de Referência:</span>
                      <span className="font-extrabold font-mono text-indigo-900">{normEntry.normCode}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Tensão de Ensaio:</span>
                      <span className="font-extrabold font-mono text-amber-900">{normEntry.testVoltageAC_kV} kV CA (60s)</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Corrente de Fuga Máx:</span>
                      <span className="font-extrabold font-mono text-rose-700">≤ {normEntry.maxLeakageCurrent_mA.toFixed(2)} mA</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Periodicidade:</span>
                      <span className="font-extrabold font-mono text-slate-800">{normEntry.retestMonths} meses</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Capacete de Segurança Classe B (Classe 2 — ABNT NBR 8221 / ANSI Z89.1) Info Card */}
          {selectedEquipmentType === 'capacete_classe_b' && (
            <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                    Capacete de Segurança Classe B — Classe Dielétrica 2 (NBR 8221 / ANSI Z89.1)
                  </span>
                </div>
                <span className="text-[11px] font-bold text-amber-900 bg-amber-200/70 px-2.5 py-0.5 rounded-full border border-amber-300 self-start sm:self-auto">
                  Equivalência Dielétrica: Classe 2 (Até 20.000 Vca)
                </span>
              </div>

              <div className="bg-white/90 p-3 rounded-xl border border-amber-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">Norma Aplicável:</span>
                  <span className="font-extrabold font-mono text-amber-900">ABNT NBR 8221 / ANSI Z89.1</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">Tensão de Ensaio:</span>
                  <span className="font-extrabold font-mono text-blue-900">20,0 kV CA (180s / 3 min)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">Corrente de Fuga Máx:</span>
                  <span className="font-extrabold font-mono text-rose-700">≤ 9,0 mA (após 24h imersão)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block font-medium">Condição / Suportabilidade:</span>
                  <span className="font-extrabold text-slate-800">Sem perfuração até 30 kV</span>
                </div>
              </div>
            </div>
          )}

          {/* Ferramentas Manuais Isoladas (ABNT NBR 9699 / IEC 60900) Info Card */}
          {selectedEquipmentType === 'ferramenta_isolada' && (
            <div className="p-4 bg-blue-50/90 border border-blue-300 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-700" />
                  <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                    Ferramentas Manuais Isoladas 1000V — ABNT NBR 9699 / IEC 60900
                  </span>
                </div>
                {(() => {
                  const toolsCount = isolatedTools.reduce((acc, t) => acc + (Number(t.quantity) || 1), 0);
                  return (
                    <span className="text-[11px] font-bold text-blue-900 bg-blue-200/80 px-2.5 py-0.5 rounded-full border border-blue-300 self-start sm:self-auto">
                      Critério Normativo: {toolsCount} un × 1,0 mA = {toolsCount * 1.0} mA máx
                    </span>
                  );
                })()}
              </div>

              {(() => {
                const toolsCount = isolatedTools.reduce((acc, t) => acc + (Number(t.quantity) || 1), 0);
                const limitCalc = (toolsCount * 1.0).toFixed(1);
                return (
                  <div className="bg-white/95 p-3 rounded-xl border border-blue-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Norma Aplicável:</span>
                      <span className="font-extrabold font-mono text-blue-950">ABNT NBR 9699 / IEC 60900</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Tensão & Tempo de Ensaio:</span>
                      <span className="font-extrabold font-mono text-blue-900">10,0 kV CA • 180s (3 min)</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Limite Máx de Fuga do Lote:</span>
                      <span className="font-extrabold font-mono text-emerald-700">
                        ≤ {limitCalc} mA <span className="text-[10px] font-normal text-slate-500">({toolsCount} un × 1 mA)</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-medium">Condicionamento:</span>
                      <span className="font-extrabold text-slate-800">Banho-maria 24h</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Measurements Form Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Zap className="w-4 h-4 text-amber-500" />
                Tensão Aplicada (kV):
              </label>
              <input
                type="number"
                step="0.5"
                value={appliedVoltage}
                onChange={(e) => setAppliedVoltage(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Exigido: {currentEvaluation?.matchedCriterion?.testVoltage_kV || 0} kV
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tipo de Tensão:
              </label>
              <select
                value={voltageType}
                onChange={(e) => setVoltageType(e.target.value as 'AC' | 'DC')}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                <option value="AC">CA (Corrente Alternada 60Hz)</option>
                <option value="DC">CC (Corrente Contínua)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Duração da Aplicação (s):
              </label>
              <input
                type="number"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10) || 0)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Exigido: {currentEvaluation?.matchedCriterion?.testDurationSeconds || 60}s
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Corrente de Fuga Medida ({currentEvaluation?.appliedUnit || 'mA'}):
              </label>
              <input
                type="number"
                step="0.1"
                value={leakageCurrent}
                onChange={(e) => setLeakageCurrent(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-blue-700"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Limite Máximo: <span className="font-bold text-slate-700">{currentEvaluation?.appliedLimit || 0} {currentEvaluation?.appliedUnit}</span>
                {selectedEquipmentType === 'luva_isolante' && (
                  <span className="text-blue-700 font-semibold ml-1">
                    (2 luvas simultâneas: {((currentEvaluation?.appliedLimit || 0) / 2).toFixed(1)} mA × 2)
                  </span>
                )}
                {selectedEquipmentType === 'ferramenta_isolada' && (
                  <span className="text-blue-700 font-semibold ml-1">
                    ({isolatedTools.reduce((acc, t) => acc + (Number(t.quantity) || 1), 0)} un × 1,0 mA)
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Withstand Toggle */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Suportabilidade sem Perfuração Dielétrica:</span>
              <span className="text-xs text-slate-500">
                Ocorreu alguma disrupção, centelhamento ou perfuração física no material durante o ensaio?
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWithstandPuncture(true)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                  withstandPuncture ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                Suportou (Sem Perfuração)
              </button>
              <button
                type="button"
                onClick={() => setWithstandPuncture(false)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                  !withstandPuncture ? 'bg-red-600 text-white' : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                Houve Disrupção / Furo
              </button>
            </div>
          </div>

          {/* Real-Time Result Preview Card */}
          {currentEvaluation && (
            <div className="space-y-3">
              <div className={`p-4 rounded-xl border-2 flex items-start gap-3 ${
                currentEvaluation.result === 'APROVADO'
                  ? 'bg-emerald-50 border-emerald-400'
                  : currentEvaluation.result === 'PENDENTE'
                  ? 'bg-amber-50 border-amber-400'
                  : 'bg-red-50 border-red-400'
              }`}>
                {currentEvaluation.result === 'APROVADO' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : currentEvaluation.result === 'PENDENTE' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      Cálculo Normativo em Tempo Real: <span className={`font-extrabold ${
                        currentEvaluation.result === 'APROVADO'
                          ? 'text-emerald-800'
                          : currentEvaluation.result === 'PENDENTE'
                          ? 'text-amber-800'
                          : 'text-red-800'
                      }`}>{currentEvaluation.result}</span>
                    </span>
                    {currentEvaluation.result === 'PENDENTE' && (
                      <span className="text-[10px] bg-amber-200/80 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-md">
                        Critério Não Configurado
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1 text-slate-700 leading-relaxed font-medium">
                    {currentEvaluation.result === 'PENDENTE' 
                      ? (currentEvaluation.errorMessage || 'Critério técnico não configurado. Consulte a norma/procedimento aplicável.')
                      : currentEvaluation.rationale}
                  </p>
                </div>
              </div>

              {/* DUAL OPINIONS PREVIEW FOR ISOLATED TOOLS WITH BOTH APPROVED AND REPROVED ITEMS */}
              {currentEvaluation.toolsEvaluation && currentEvaluation.toolsEvaluation.approvedCount > 0 && currentEvaluation.toolsEvaluation.reprovedCount > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Parecer 1: Ferramentas Aprovadas */}
                  <div className="p-3.5 bg-emerald-50/90 border-2 border-emerald-500 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>PARECER 1 — FERRAMENTAS APROVADAS ({currentEvaluation.toolsEvaluation.approvedCount} un)</span>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {currentEvaluation.approvedOpinion || 'Ferramentas aprovadas consideradas aptas para uso operacional até 1000V CA / 1500V CC com emissão de Certificado de Conformidade.'}
                    </p>
                    <div className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-1 rounded border border-emerald-200 inline-block">
                      ✓ Liberadas para emissão de Certificado de Conformidade
                    </div>
                  </div>

                  {/* Parecer 2: Ferramentas Reprovadas */}
                  <div className="p-3.5 bg-red-50/90 border-2 border-red-500 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5 text-red-900 font-bold text-xs">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span>PARECER 2 — FERRAMENTAS REPROVADAS ({currentEvaluation.toolsEvaluation.reprovedCount} un)</span>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {currentEvaluation.reprovedOpinion || 'Ferramentas reprovadas consideradas inaptas. Segregação imediata e descarte compulsório.'}
                    </p>
                    <div className="text-[10px] font-bold text-red-800 bg-red-100/80 px-2 py-1 rounded border border-red-200 inline-block">
                      ⚠ Segregação e destruição mecânica obrigatória (NR-10)
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Photo Capture & Upload (Evidências Fotográficas do Ensaio) */}
          <div className="border-t border-slate-200 pt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                  </div>
                  <span>Registro Fotográfico do Ensaio</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                    {photos.length} foto(s) anexada(s)
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tire fotos com a câmera do celular ou carregue da galeria para compor o anexo fotográfico do Laudo Técnico.
                </p>
              </div>
            </div>

            {/* Selection & Controls Bar */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDraggingPhotos(true); }}
              onDragLeave={() => setIsDraggingPhotos(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingPhotos(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleAddPhotoFromFiles(e.dataTransfer.files);
                }
              }}
              className={`p-4 rounded-2xl border transition-all space-y-3.5 ${
                isDraggingPhotos
                  ? 'bg-orange-50 border-orange-400 border-dashed scale-[1.01]'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              {/* Category and Caption inputs */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-4">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Etapa / Categoria:
                  </label>
                  <select
                    value={photoCategory}
                    onChange={(e) => setPhotoCategory(e.target.value as any)}
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none shadow-xs"
                  >
                    <option value="antes">🛡️ Antes do Ensaio (Inspeção Visual)</option>
                    <option value="durante">⚡ Durante o Ensaio (Cuba / Tensão)</option>
                    <option value="apos">✅ Após o Ensaio (Aprovado / Secagem)</option>
                    <option value="identificacao">🏷️ Identificação / CA / Tag</option>
                    <option value="defeito">⚠️ Defeito / Não Conformidade / Furo</option>
                    <option value="medicao">📊 Painel de Medição / Miliamperímetro</option>
                    <option value="equipamento_teste">🔬 Equipamento de Teste / Cuba</option>
                  </select>
                </div>

                <div className="md:col-span-8">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Legenda da Foto (Opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Tensão de ensaio aplicada sem disrupção, lote em cuba..."
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:outline-none shadow-xs"
                  />
                </div>
              </div>

              {/* Action Buttons: Câmera em Tempo Real, Câmera Nativa, Conectar Celular e Galeria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/80">
                {/* 1. Câmera em Tempo Real (Visor / Webcam / Aparelho) */}
                <button
                  type="button"
                  onClick={() => setIsLiveCameraOpen(true)}
                  disabled={isProcessingPhotos}
                  className="w-full px-3.5 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-orange-600/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                  title="Abrir visor da câmera em tempo real para capturar foto com iluminação e controles"
                >
                  <Camera className="w-4 h-4 text-white shrink-0" />
                  <span>Câmera em Tempo Real</span>
                </button>

                {/* 2. Câmera Nativa do Celular */}
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  disabled={isProcessingPhotos}
                  className="w-full px-3.5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                  title="Abrir a câmera padrão do dispositivo diretamente"
                >
                  <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Câmera Nativa</span>
                </button>

                {/* 3. Conectar Celular sem Fio via QR Code */}
                <button
                  type="button"
                  onClick={() => setIsMobileBridgeOpen(true)}
                  disabled={isProcessingPhotos}
                  className="w-full px-3.5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                  title="Usar a câmera do smartphone à distância escaneando o QR Code"
                >
                  <QrCode className="w-4 h-4 text-white shrink-0" />
                  <span>Celular via QR Code</span>
                </button>

                {/* 4. Carregar da Galeria */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isProcessingPhotos}
                  className="w-full px-3.5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                  title="Selecionar fotos salvas na galeria do celular ou arquivos"
                >
                  <FolderOpen className="w-4 h-4 text-white shrink-0" />
                  <span>Galeria / Arquivos</span>
                </button>

                {/* Hidden Native Inputs */}
                <input
                  ref={nativeCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleNativeCameraChange}
                />

                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleGalleryChange}
                />
              </div>

              {isProcessingPhotos && (
                <div className="p-2.5 text-center text-xs text-orange-700 font-semibold bg-orange-100 border border-orange-200 rounded-xl flex items-center justify-center gap-2 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-orange-600" />
                  <span>Processando, otimizando e anexando imagem ao ensaio...</span>
                </div>
              )}
            </div>

            {/* Photos Grid */}
            {photos.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Fotos anexadas ({photos.length}):</span>
                  <span className="text-[11px] text-slate-400">Clique na foto para ampliar</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {photos.map((p, idx) => {
                    const categoryBadges: Record<string, { label: string; bg: string; text: string }> = {
                      antes: { label: 'Antes', bg: 'bg-amber-100 border-amber-300', text: 'text-amber-800' },
                      durante: { label: 'Durante', bg: 'bg-blue-100 border-blue-300', text: 'text-blue-800' },
                      apos: { label: 'Após', bg: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-800' },
                      identificacao: { label: 'Tag / CA', bg: 'bg-purple-100 border-purple-300', text: 'text-purple-800' },
                      defeito: { label: 'Defeito', bg: 'bg-red-100 border-red-300', text: 'text-red-800' },
                      medicao: { label: 'Medição', bg: 'bg-cyan-100 border-cyan-300', text: 'text-cyan-800' },
                      equipamento_teste: { label: 'Cuba', bg: 'bg-slate-100 border-slate-300', text: 'text-slate-800' }
                    };
                    const badge = categoryBadges[p.category] || { label: p.category, bg: 'bg-slate-100 border-slate-300', text: 'text-slate-800' };

                    return (
                      <div 
                        key={p.id} 
                        className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs hover:shadow-md transition-all flex flex-col"
                      >
                        <div 
                          className="relative h-32 bg-slate-900 cursor-pointer overflow-hidden"
                          onClick={() => setSelectedPhotoForDetail(p)}
                        >
                          <img 
                            src={p.url} 
                            alt={p.caption} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition-opacity">
                              <Maximize2 className="w-3 h-3" /> Ampliar
                            </span>
                          </div>
                          
                          <span className={`absolute top-2 left-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shadow-xs ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </div>

                        <div className="p-2.5 text-[11px] text-slate-700 flex-1 flex flex-col justify-between">
                          <p className="font-semibold text-slate-800 line-clamp-2 leading-tight">
                            {p.caption || `Foto #${idx + 1}`}
                          </p>
                          <span className="text-[9px] text-slate-400 mt-1 block">
                            {new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {p.userName}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePhoto(p.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-full opacity-80 hover:opacity-100 shadow-md transition-opacity cursor-pointer"
                          title="Remover Foto"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-2">
                  <Camera className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">Nenhuma foto anexada ao ensaio ainda</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Use os botões acima para <strong>Tirar Foto (Câmera do Celular)</strong> ou <strong>Carregar da Galeria</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Photo Zoom / Detail Lightbox Modal */}
          <PhotoDetailModal
            photo={selectedPhotoForDetail}
            onClose={() => setSelectedPhotoForDetail(null)}
            onDelete={(id) => handleRemovePhoto(id)}
          />

          {/* Live Camera Viewfinder Modal */}
          <LiveCameraModal
            isOpen={isLiveCameraOpen}
            onClose={() => setIsLiveCameraOpen(false)}
            onCapturePhoto={handleCaptureFromLiveCamera}
            defaultCategory={photoCategory}
            defaultCaption={photoCaption}
            userName={currentUser.name}
          />

          {/* Direct Mobile Camera QR Code Bridge */}
          <MobileCameraBridgeModal
            isOpen={isMobileBridgeOpen}
            onClose={() => setIsMobileBridgeOpen(false)}
            onPhotoReceived={(photo) => {
              handleCaptureFromLiveCamera(photo);
              setIsMobileBridgeOpen(false);
            }}
            defaultCategory={photoCategory}
            defaultCaption={photoCaption}
            userName={currentUser.name}
          />

          <div className="flex justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button
              onClick={() => setCurrentStep(5)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm"
            >
              Avançar para Instrumentos <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Lab Instruments */}
      {currentStep === 5 && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-blue-700">
                5. Instrumentação Utilizada no Ensaio
              </h3>
              <p className="text-xs text-slate-500">
                Selecione os equipamentos laboratoriais e padrões calibrados com rastreabilidade RBC utilizados.
              </p>
            </div>
          </div>

          {/* Instruments Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-blue-600" />
              Instrumentos de Ensaio Empregados:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {instrumentsList.map(inst => {
                const isSelected = selectedInstrumentIds.includes(inst.id);
                const isExpired = inst.calibrationExpiryDate < today;
                return (
                  <div
                    key={inst.id}
                    onClick={() => {
                      setSelectedInstrumentIds(prev => 
                        isSelected ? prev.filter(id => id !== inst.id) : [...prev, inst.id]
                      );
                    }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-500 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {inst.imageUrl ? (
                          <img
                            src={inst.imageUrl}
                            alt={inst.model}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 object-cover rounded-lg border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                            <Gauge className="w-5 h-5" />
                          </div>
                        )}
                        <div className="truncate">
                          <span className="text-xs font-bold text-slate-900 block truncate">{inst.type}</span>
                          <span className="text-[11px] text-slate-600 block truncate">{inst.model} • SN: {inst.serialNumber}</span>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5 truncate">
                            Cert: {inst.calibrationCertNumber} {inst.certFileUrl ? '📎 (Anexado)' : ''}
                          </span>
                        </div>
                      </div>
                      <StatusBadge type="calibration" status={isExpired ? 'expired' : 'valid'} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Block / Override warning if expired instrument selected */}
            {hasExpiredInstrument && (
              <div className="mt-3 p-3 bg-red-50 border border-red-300 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-red-900">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  Instrumento com calibração RBC vencida selecionado!
                </div>
                <p className="text-xs text-red-700">
                  A conclusão do ensaio requer autorização expressa do Responsável Técnico:
                </p>
                <input
                  type="text"
                  placeholder="Nome do Responsável Técnico que autorizou a liberação..."
                  value={overrideCalibrationAuth}
                  onChange={(e) => setOverrideCalibrationAuth(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button
              onClick={() => setCurrentStep(6)}
              disabled={hasExpiredInstrument && !overrideCalibrationAuth}
              className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm ${
                hasExpiredInstrument && !overrideCalibrationAuth
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Avançar para Assinaturas & Finalização <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Signatures, Technical Notes & Finalize */}
      {currentStep === 6 && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-blue-700">
            6. Conclusão Técnica, Assinaturas & Emissão
          </h3>

          {/* Final Status Alert */}
          {currentEvaluation && (
            <div className="space-y-3">
              <div className={`p-4 rounded-xl border-2 flex items-center justify-between ${
                currentEvaluation.result === 'APROVADO'
                  ? 'bg-emerald-50 border-emerald-400'
                  : currentEvaluation.result === 'PENDENTE'
                  ? 'bg-amber-50 border-amber-400'
                  : 'bg-red-50 border-red-400'
              }`}>
                <div className="flex items-center gap-3">
                  {currentEvaluation.result === 'APROVADO' ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                  ) : currentEvaluation.result === 'PENDENTE' ? (
                    <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-600 shrink-0" />
                  )}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Resultado Oficial</span>
                    <h4 className="text-base font-extrabold text-slate-900">
                      PARECER TÉCNICO: {currentEvaluation.result}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {currentEvaluation.result === 'APROVADO' 
                        ? `Serão gerados automaticamente o Laudo Técnico e o Certificado de Conformidade com validade de ${currentEvaluation.recommendedRetestMonths} meses.`
                        : currentEvaluation.result === 'PENDENTE'
                        ? 'Cálculo pendente de configuração de critério técnico normativo.'
                        : (currentEvaluation.toolsEvaluation?.canEmitPartialCertificate
                            ? `Lote com reprovação parcial (${currentEvaluation.toolsEvaluation.reprovedCount} reprovada(s) e ${currentEvaluation.toolsEvaluation.approvedCount} aprovada(s)). Dois pareceres serão emitidos: liberação para as aprovadas e termo de descarte para as reprovadas.`
                            : 'O equipamento será registrado como REPROVADO e bloqueado para uso operacional.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* DUAL OPINIONS IN STEP 6 */}
              {currentEvaluation.toolsEvaluation && currentEvaluation.toolsEvaluation.approvedCount > 0 && currentEvaluation.toolsEvaluation.reprovedCount > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Parecer 1: {currentEvaluation.toolsEvaluation.approvedCount} Ferramenta(s) Aprovada(s)</span>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Aptas para uso em instalações energizadas até 1000V CA. Certificado de Conformidade liberado para emissão.
                    </p>
                  </div>

                  <div className="p-3 bg-red-50 border border-red-300 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-red-900 font-bold text-xs">
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      <span>Parecer 2: {currentEvaluation.toolsEvaluation.reprovedCount} Ferramenta(s) Reprovada(s)</span>
                    </div>
                    <p className="text-[11px] text-red-800">
                      Inaptas para uso. Segregação imediata, etiquetação vermelha e descarte compulsório conforme NR-10.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CAMPO DE EMISSÃO DO CERTIFICADO / LAUDO */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600" />
              <span>Opções de Emissão do Certificado & Laudo Técnico</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                <input
                  type="checkbox"
                  checked={emitLaudo}
                  onChange={(e) => setEmitLaudo(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
                />
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Emitir Laudo Técnico Dielétrico</span>
                  <span className="text-[11px] text-slate-500">Documento técnico completo com registros ambientais, checklist e rastreabilidade</span>
                </div>
              </label>

              {(() => {
                const canEmitCert = currentEvaluation ? (currentEvaluation.result === 'APROVADO' || Boolean(currentEvaluation.toolsEvaluation?.canEmitPartialCertificate)) : false;
                const hasPartialApprovedTools = Boolean(currentEvaluation?.toolsEvaluation?.canEmitPartialCertificate && (currentEvaluation?.toolsEvaluation?.reprovedCount || 0) > 0);

                return (
                  <label className={`flex items-start gap-2.5 p-3 bg-white rounded-lg border cursor-pointer transition-colors ${
                    canEmitCert ? 'hover:border-orange-300 border-slate-200' : 'opacity-60 border-slate-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={emitCertificado && canEmitCert}
                      disabled={!canEmitCert}
                      onChange={(e) => setEmitCertificado(e.target.checked)}
                      className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4 mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs flex flex-wrap items-center gap-1.5">
                        <span>Emitir Certificado de Conformidade</span>
                        {!canEmitCert && (
                          <span className="text-[9px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">(Apenas p/ Aprovados)</span>
                        )}
                        {hasPartialApprovedTools && (
                          <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            (Para as {currentEvaluation?.toolsEvaluation?.approvedCount} ferramentas aprovadas)
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {hasPartialApprovedTools
                          ? `Certificado oficial emitido exclusivamente para as ${currentEvaluation?.toolsEvaluation?.approvedCount} ferramentas aprovadas do lote.`
                          : 'Certificado oficial de conformidade para auditoria e fiscalização NR-10'}
                      </span>
                    </div>
                  </label>
                );
              })()}
            </div>
          </div>

          {/* Technical Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observações Técnicas Adicionais para o Laudo / Certificado:
            </label>
            <textarea
              rows={2}
              value={technicalNotes}
              onChange={(e) => setTechnicalNotes(e.target.value)}
              placeholder="Ex: Equipamento higienizado com água desmineralizada e ensaiado conforme rotina periódica..."
              className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Select Technical Responsible & Analista Executor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Analista Executor (Ordem de Serviço):
                </span>
                {selectedOS && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/50">
                    Definido na {selectedOS.osNumber}
                  </span>
                )}
              </label>
              <select
                value={effectiveTechnician.id}
                onChange={(e) => setSelectedTechnicianId(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800 bg-white"
              >
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.cargo || u.role} {u.creaOrCft ? `(${u.creaOrCft})` : ''} {selectedOS?.technicianId === u.id ? ' ★ (Analista da OS)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-blue-600" />
                  Responsável Técnico (Engenheiro CREA):
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Configurações & Backup
                </span>
              </label>
              <select
                value={selectedRTId}
                onChange={(e) => setSelectedRTId(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800 bg-white"
              >
                <option value="configured-company-rt">
                  ★ {companyInfo.technicalResponsible?.name || 'Eng. João Victor Medeiros'} — {companyInfo.technicalResponsible?.creaNumber || 'CREA-SP'} ({companyInfo.technicalResponsible?.title || 'Responsável Técnico'}) [Padrão do Laboratório]
                </option>
                {usersList
                  .filter(u => (u.role === 'responsavel_tecnico' || u.role === 'admin') && u.name !== companyInfo.technicalResponsible?.name)
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.creaOrCft || 'CREA'} ({u.cargo || u.role})
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Configurado na aba <strong>Configurações & Backup</strong>: <strong className="text-slate-800">{companyInfo.technicalResponsible?.name}</strong> • {companyInfo.technicalResponsible?.creaNumber}
              </p>
            </div>
          </div>

          {/* Digital Signature Pads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SignatureCanvas
              title="Assinatura do Analista Executor"
              signerName={effectiveTechnician.name}
              signerRole={effectiveTechnician.cargo || 'Analista Executor'}
              documentNumber={effectiveTechnician.creaOrCft || 'CFT-SP'}
              onSave={setTechnicianSig}
              onSaveAsDefault={handleSaveTechnicianDefaultSig}
              initialSignature={technicianSig}
              isDefault={Boolean(effectiveTechnician.signatureUrl && technicianSig === effectiveTechnician.signatureUrl)}
            />

            <SignatureCanvas
              title="Assinatura do Responsável Técnico"
              signerName={effectiveTechResponsible.name}
              signerRole={effectiveTechResponsible.title || 'Responsável Técnico'}
              documentNumber={effectiveTechResponsible.creaNumber || 'CREA-SP 5069874211/D'}
              onSave={setTechResponsibleSig}
              onSaveAsDefault={handleSaveRTDefaultSig}
              initialSignature={techResponsibleSig}
              isDefault={Boolean((effectiveTechResponsible.signatureUrl || companyInfo.technicalResponsible?.signatureUrl) && techResponsibleSig === (effectiveTechResponsible.signatureUrl || companyInfo.technicalResponsible?.signatureUrl))}
            />
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setCurrentStep(5)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
            <button
              onClick={handleFinalizeTest}
              className={`inline-flex items-center gap-2 px-6 py-3 ${
                editingTest ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              } text-white rounded-xl text-sm font-extrabold shadow-md transition-all active:scale-98 cursor-pointer`}
            >
              {editingTest ? (
                <>
                  <Edit3 className="w-5 h-5" /> Salvar Alterações no Ensaio & Atualizar Laudo
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" /> Finalizar Ensaio & Emitir Laudo
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
