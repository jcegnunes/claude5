/** Tipos do módulo Treinamentos (certificados de treinamento). */

export type TrainingModality = 'presencial' | 'ead' | 'semipresencial';

export interface TrainingTopic {
  title: string;
  hours: number;
}

/** Campos de controle comuns a todos os registros do módulo. */
export interface TrainingRecordBase {
  id: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  /** Versão do servidor em que a última edição local se baseou (conflitos). */
  serverUpdatedAt?: string;
}

export interface TrainingCourse extends TrainingRecordBase {
  code: string;
  name: string;
  /** Ex.: "NR-10 – item 10.8.8 e Anexo III" */
  normReference: string;
  workloadHours: number;
  /** 0 = sem vencimento */
  validityMonths: number;
  modality: TrainingModality;
  /** Presença mínima para aprovação (%) */
  minAttendance: number;
  /** Nota mínima (0 a 10); vazio = sem avaliação */
  minGrade?: number;
  topics: TrainingTopic[];
  /** Pré-requisito impresso no verso (ex.: "NR-10 Básico válido") */
  prerequisite?: string;
  /** Texto complementar do verso do certificado */
  notes?: string;
  active: boolean;
}

export interface TrainingInstructor extends TrainingRecordBase {
  name: string;
  /** Ex.: "Engenheiro Eletricista" */
  qualification: string;
  /** Ex.: "CREA-SP 123456" */
  registration: string;
  email?: string;
  phone?: string;
  signatureUrl?: string;
  active: boolean;
}

export interface TrainingParticipant {
  id: string;
  name: string;
  cpf: string;
  role?: string;
  company?: string;
  /** Presença (%) */
  attendance: number;
  /** Nota (0 a 10) */
  grade?: number;
  /** Aprovação definida manualmente (senão calculada pela regra do curso) */
  approvedOverride?: boolean;
  certificateId?: string;
}

export type TrainingClassStatus = 'planejada' | 'em_andamento' | 'concluida' | 'cancelada';

export interface TrainingClass extends TrainingRecordBase {
  classNumber: string;
  courseId: string;
  courseName: string;
  clientId?: string;
  clientName?: string;
  startDate: string;
  endDate: string;
  location: string;
  modality: TrainingModality;
  workloadHours: number;
  instructorIds: string[];
  participants: TrainingParticipant[];
  status: TrainingClassStatus;
  notes?: string;
}

export type TrainingCertificateStatus = 'valido' | 'cancelado';

export interface TrainingCertificate extends TrainingRecordBase {
  certificateNumber: string;
  validationCode: string;
  classId?: string;
  classNumber?: string;
  courseId: string;
  courseName: string;
  normReference: string;
  workloadHours: number;
  modality: TrainingModality;
  topics: TrainingTopic[];
  prerequisite?: string;
  courseNotes?: string;
  participantName: string;
  participantCpf: string;
  participantRole?: string;
  participantCompany?: string;
  attendance?: number;
  grade?: number;
  startDate: string;
  endDate: string;
  location: string;
  issueDate: string;
  /** vazio = sem vencimento */
  expiryDate?: string;
  instructorIds: string[];
  instructorNames: string[];
  /** Cópia do instrutor no momento da emissão (nome, qualificação, assinatura) */
  instructors: Array<Pick<TrainingInstructor, 'name' | 'qualification' | 'registration' | 'signatureUrl'>>;
  technicalResponsibleName?: string;
  technicalResponsibleTitle?: string;
  technicalResponsibleRegistration?: string;
  technicalResponsibleSignature?: string;
  status: TrainingCertificateStatus;
  cancelReason?: string;
}

export type TrainingTable = 'training_courses' | 'training_instructors' | 'training_classes' | 'training_certificates';

export interface TrainingQueueItem {
  table: TrainingTable;
  id: string;
  action: 'upsert' | 'delete';
  attempts: number;
  lastError?: string;
}

export interface TrainingConflict {
  table: TrainingTable;
  id: string;
  label: string;
  detectedAt: string;
}

/** Dados públicos devolvidos pelo validador (sem login). */
export interface PublicTrainingCertificate {
  certificateNumber: string;
  validationCode: string;
  participantName: string;
  participantCpfMasked?: string;
  participantCompany?: string;
  courseName: string;
  normReference?: string;
  workloadHours?: number;
  modality?: string;
  startDate?: string;
  endDate?: string;
  issueDate?: string;
  expiryDate?: string;
  status: TrainingCertificateStatus;
  cancelReason?: string;
  instructorNames?: string[];
  technicalResponsibleName?: string;
  companyName?: string;
  companyLegalName?: string;
  companyCnpj?: string;
}
