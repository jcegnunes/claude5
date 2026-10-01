/**
 * Chaves de armazenamento do módulo Treinamentos. Arquivo leve: é lido na
 * abertura do app (main.tsx) para carregar os dados do IndexedDB.
 */
export const TRAINING_KEYS = {
  COURSES: 'jvm_training_courses',
  INSTRUCTORS: 'jvm_training_instructors',
  CLASSES: 'jvm_training_classes',
  CERTIFICATES: 'jvm_training_certificates',
  QUEUE: 'jvm_training_queue',
  CONFLICTS: 'jvm_training_conflicts',
  // pequenas: ficam no localStorage
  CURSORS: 'jvm_training_cursors',
  NUMBER_BLOCKS: 'jvm_training_number_blocks',
  SEEDED: 'jvm_training_seeded'
};

/** Chaves guardadas no IndexedDB (carregadas na abertura do app). */
export const TRAINING_MANAGED_KEYS = [
  TRAINING_KEYS.COURSES, TRAINING_KEYS.INSTRUCTORS, TRAINING_KEYS.CLASSES,
  TRAINING_KEYS.CERTIFICATES, TRAINING_KEYS.QUEUE, TRAINING_KEYS.CONFLICTS
];
