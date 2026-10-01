/** Chaves do IndexedDB de todos os módulos (lidas em main.tsx antes de abrir o app). */
import { TRAINING_MANAGED_KEYS } from './treinamentos/storageKeys';

export const MODULE_STORAGE_KEYS: string[] = [...TRAINING_MANAGED_KEYS];
