import { describe, expect, it } from 'vitest';
import { canUseModule, getAssignableModules, getAvailableWorkspaces } from '../workspaces';

const ids = (list: Array<{ id: string }>) => list.map(w => w.id);

describe('Módulos liberados por usuário', () => {
  it('sem restrição no cadastro: todos os módulos do perfil', () => {
    expect(ids(getAvailableWorkspaces({}, { role: 'tecnico', allowedModules: null }))).toEqual(['ensaios', 'treinamentos']);
    expect(ids(getAvailableWorkspaces({}, { role: 'tecnico' }))).toEqual(['ensaios', 'treinamentos']);
  });

  it('restrito: só os módulos marcados', () => {
    expect(ids(getAvailableWorkspaces({}, { role: 'tecnico', allowedModules: ['treinamentos'] }))).toEqual(['treinamentos']);
    expect(ids(getAvailableWorkspaces({}, { role: 'administrativo', allowedModules: ['ensaios'] }))).toEqual(['ensaios']);
    expect(getAvailableWorkspaces({}, { role: 'tecnico', allowedModules: [] })).toEqual([]);
  });

  it('administrador acessa todos, mesmo com restrição gravada', () => {
    expect(canUseModule({ role: 'admin', allowedModules: ['ensaios'] }, 'treinamentos')).toBe(true);
    expect(canUseModule({ role: 'tecnico', isMasterAdmin: true, allowedModules: [] }, 'ensaios')).toBe(true);
  });

  it('módulo desligado para a empresa não aparece nem pode ser liberado', () => {
    const info = { enabledModules: { treinamentos: false } };
    expect(ids(getAssignableModules(info))).toEqual(['ensaios']);
    expect(ids(getAvailableWorkspaces(info, { role: 'tecnico', allowedModules: null }))).toEqual(['ensaios']);
  });

  it('perfil cliente continua só com os ensaios', () => {
    expect(ids(getAvailableWorkspaces({}, { role: 'cliente', allowedModules: null }))).toEqual(['ensaios']);
  });
});
