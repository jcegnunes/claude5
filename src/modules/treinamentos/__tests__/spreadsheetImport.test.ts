import { describe, expect, it } from 'vitest';
import { buildImportRows, groupImportRows, parseDateCell, parseNumberCell, rowStatus } from '../spreadsheetImport';
import type { TrainingCertificate, TrainingCourse, TrainingInstructor } from '../types';

const base = { companyId: 'c', createdAt: '', updatedAt: '' };
const nr10: TrainingCourse = { ...base, id: 'crs-nr10', code: 'NR-10 BÁSICO', name: 'NR-10 – Curso Básico', normReference: 'NR-10', workloadHours: 40, validityMonths: 24, modality: 'presencial', minAttendance: 100, minGrade: 7, topics: [], active: true };
const nr35: TrainingCourse = { ...nr10, id: 'crs-nr35', code: 'NR-35', name: 'NR-35 – Trabalho em Altura', workloadHours: 8 };
const ana: TrainingInstructor = { ...base, id: 'ins-ana', name: 'Ana Instrutora', qualification: 'Eng.', registration: 'CREA 1', active: true };
const ctx = (extra: Partial<Parameters<typeof buildImportRows>[1]> = {}) => ({
  courses: [nr10, nr35], instructors: [ana], existing: [] as TrainingCertificate[],
  defaults: { courseId: '', startDate: '', endDate: '', location: '', instructorIds: [] }, ...extra
});

describe('Planilha de certificados — leitura das células', () => {
  it('datas: texto dd/mm/aaaa, Date do Excel e número serial', () => {
    expect(parseDateCell('05/10/2026')).toBe('2026-10-05');
    expect(parseDateCell('5-10-26')).toBe('2026-10-05');
    expect(parseDateCell('2026-10-05')).toBe('2026-10-05');
    expect(parseDateCell(new Date(2026, 9, 5))).toBe('2026-10-05');
    expect(parseDateCell(46300)).toBe('2026-10-05');
    expect(parseDateCell('31/02/2026')).toBeNull();
    expect(parseDateCell('amanhã')).toBeNull();
  });

  it('números com vírgula e porcentagem', () => {
    expect(parseNumberCell('8,5')).toBe(8.5);
    expect(parseNumberCell('100%')).toBe(100);
    expect(parseNumberCell(9)).toBe(9);
    expect(parseNumberCell('')).toBeUndefined();
  });
});

describe('Planilha de certificados — validação das linhas', () => {
  it('reconhece os títulos com ou sem acento, curso pela sigla e instrutor pelo nome', () => {
    const rows = buildImportRows([
      { 'NOME': 'Maria Souza', 'cpf': '529.982.247-25', 'Funcao': 'Eletricista', 'Empresa': 'Cliente X', 'Curso': 'nr-10 basico', 'Início': '01/10/2026', 'Termino': '05/10/2026', 'Presença (%)': '100', 'Nota': '9,5', 'Instrutor': 'ana instrutora' }
    ], ctx());
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(rowStatus(r)).toBe('ok');
    expect(r.line).toBe(2);
    expect(r.course?.id).toBe('crs-nr10');
    expect([r.startDate, r.endDate]).toEqual(['2026-10-01', '2026-10-05']);
    expect(r.grade).toBe(9.5);
    expect(r.instructorIds).toEqual(['ins-ana']);
  });

  it('CPF digitado como número no Excel recupera o zero à esquerda', () => {
    const [r] = buildImportRows([{ Nome: 'Zé', CPF: 1234567890 - 0, Curso: 'NR-35', 'Início': '01/10/2026', Nota: 8 }], ctx());
    expect(r.cpf).toBe('012.345.678-90');
  });

  it('aponta erros e reprovados sem impedir as demais linhas', () => {
    const rows = buildImportRows([
      { Nome: 'Sem Curso', Curso: '', 'Início': '01/10/2026' },
      { Nome: 'Curso Errado', Curso: 'NR-99', 'Início': '01/10/2026' },
      { Nome: 'CPF Errado', CPF: '123.456.789-00', Curso: 'NR-35', 'Início': '01/10/2026', Nota: 9 },
      { Nome: 'Datas', Curso: 'NR-35', 'Início': '05/10/2026', 'Término': '01/10/2026', Nota: 9 },
      { Nome: 'Instrutor', Curso: 'NR-35', 'Início': '01/10/2026', Nota: 9, Instrutor: 'Fulano' },
      { Nome: 'Reprovado', Curso: 'NR-35', 'Início': '01/10/2026', Nota: 5 },
      { Nome: 'Faltou', Curso: 'NR-35', 'Início': '01/10/2026', Nota: 9, 'Presença': 80 },
      { Nome: '', CPF: '', Curso: '' },
      { Nome: 'Aprovado', Curso: 'NR-35', 'Início': '01/10/2026', Nota: 7 }
    ], ctx());
    expect(rows.map(rowStatus)).toEqual(['erro', 'erro', 'erro', 'erro', 'erro', 'reprovado', 'reprovado', 'ok']);
    expect(rows[1].errors[0]).toContain('NR-99');
    expect(rows[4].errors[0]).toContain('Fulano');
  });

  it('usa os valores padrão da tela para colunas em branco', () => {
    const [r] = buildImportRows([{ Nome: 'Maria', Nota: 10 }], ctx({ defaults: { courseId: 'crs-nr35', startDate: '2026-10-01', endDate: '2026-10-02', location: 'Campinas/SP', instructorIds: ['ins-ana'] } }));
    expect(rowStatus(r)).toBe('ok');
    expect([r.course?.id, r.startDate, r.endDate, r.location, r.instructorIds[0]]).toEqual(['crs-nr35', '2026-10-01', '2026-10-02', 'Campinas/SP', 'ins-ana']);
  });

  it('não emite duas vezes: repetido na planilha ou já emitido', () => {
    const existing = [{ status: 'valido', courseId: 'crs-nr35', participantCpf: '111.444.777-35', endDate: '2026-10-01' } as TrainingCertificate];
    const rows = buildImportRows([
      { Nome: 'Maria', CPF: '52998224725', Curso: 'NR-35', 'Início': '01/10/2026', Nota: 9 },
      { Nome: 'Maria de novo', CPF: '529.982.247-25', Curso: 'NR-35', 'Início': '01/10/2026', Nota: 9 },
      { Nome: 'João', CPF: '111.444.777-35', Curso: 'NR-35', 'Início': '01/10/2026', Nota: 9 }
    ], ctx({ existing }));
    expect(rows.map(rowStatus)).toEqual(['ok', 'erro', 'erro']);
    expect(rows[2].errors[0]).toContain('já emitido');
  });

  it('sem CPF, a repetição é conferida pelo nome', () => {
    const existing = [{ status: 'valido', courseId: 'crs-nr35', participantCpf: '', participantName: 'Ana Altura', endDate: '2026-10-06' } as TrainingCertificate];
    const rows = buildImportRows([
      { Nome: 'ana altura', Curso: 'NR-35', 'Início': '06/10/2026', Nota: 9 },
      { Nome: 'Beto', Curso: 'NR-35', 'Início': '06/10/2026', Nota: 9 },
      { Nome: 'BETO', Curso: 'NR-35', 'Início': '06/10/2026', Nota: 9 }
    ], ctx({ existing }));
    expect(rows.map(rowStatus)).toEqual(['erro', 'ok', 'erro']);
  });
});

describe('Planilha de certificados — turmas', () => {
  it('uma turma por curso, período e local; linhas com erro ficam de fora', () => {
    const rows = buildImportRows([
      { Nome: 'A', Curso: 'NR-35', 'Início': '01/10/2026', Local: 'SP', Nota: 9 },
      { Nome: 'B', Curso: 'NR-35', 'Início': '01/10/2026', Local: 'sp', Nota: 4 },
      { Nome: 'C', Curso: 'NR-35', 'Início': '02/10/2026', Local: 'SP', Nota: 9 },
      { Nome: 'D', Curso: 'NR-10 BÁSICO', 'Início': '01/10/2026', Local: 'SP', Nota: 9 },
      { Nome: 'E', Curso: 'NR-99', 'Início': '01/10/2026', Local: 'SP', Nota: 9 }
    ], ctx());
    const groups = groupImportRows(rows);
    expect(groups.map(g => g.rows.map(r => r.name).join(''))).toEqual(['AB', 'C', 'D']);
    expect(groups[0].workloadHours).toBe(8);
  });
});

describe('Planilha de alunos — Nome, CPF e Colaborador da Empresa', () => {
  it('3 colunas + curso, datas e nota escolhidos na tela', () => {
    const rows = buildImportRows([
      { 'Nome': 'Rogerio Conceição Couto', 'CPF': '702.409.145-20', 'Colaborador da Empresa': 'Empresa A' },
      { 'Nome': 'Jorge Luiz', 'CPF': '049.384.421-08', 'Colaborador da Empresa': 'Empresa B' }
    ], ctx({ defaults: { courseId: 'crs-nr10', startDate: '2026-09-21', endDate: '2026-09-25', location: 'SP', attendance: 100, grade: 9, instructorIds: ['ins-ana'] } }));
    expect(rows.map(rowStatus)).toEqual(['ok', 'ok']);
    expect(rows.map(r => r.company)).toEqual(['Empresa A', 'Empresa B']);
    expect([rows[0].course?.id, rows[0].startDate, rows[0].endDate, rows[0].grade]).toEqual(['crs-nr10', '2026-09-21', '2026-09-25', 9]);
    expect(groupImportRows(rows)).toHaveLength(1);
  });

  it('sem nota na tela, curso com avaliação fica reprovado (não emite por engano)', () => {
    const [r] = buildImportRows([{ Nome: 'A', CPF: '', 'Colaborador da Empresa': 'X' }],
      ctx({ defaults: { courseId: 'crs-nr10', startDate: '2026-09-21', endDate: '', location: '', instructorIds: [] } }));
    expect(rowStatus(r)).toBe('reprovado');
  });

  it('alunos para a turma: valida CPF e usa a empresa da turma quando em branco', async () => {
    const { parseParticipantRows } = await import('../spreadsheetImport');
    const rows = parseParticipantRows([
      { Nome: 'Maria', CPF: 52998224725, 'Colaborador da Empresa': 'Empresa A' },
      { Nome: 'Zé', CPF: '123.456.789-00', 'Colaborador da Empresa': '' },
      { Nome: 'Ana', CPF: '', 'Colaborador da Empresa': '' },
      { Nome: '', CPF: '', 'Colaborador da Empresa': '' }
    ], 'Cliente da Turma');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ name: 'Maria', cpf: '529.982.247-25', company: 'Empresa A', attendance: 100 });
    expect(rows[1].error).toBe('CPF inválido');
    expect(rows[2]).toMatchObject({ company: 'Cliente da Turma', error: undefined });
  });
});
