// Regenera supabase/recriar_banco.sql a partir do schema.sql (mantém a parte
// inicial que apaga tudo e a parte final do primeiro usuário).
// Uso: npm run build:sql
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const recriarPath = path.join(dir, 'recriar_banco.sql');
const recriar = fs.readFileSync(recriarPath, 'utf8');
const schema = fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8');
// Módulos independentes (supabase/modules/*.sql) entram logo depois do schema
const modulesDir = path.join(dir, 'modules');
const modules = fs.existsSync(modulesDir)
  ? fs.readdirSync(modulesDir).filter(f => f.endsWith('.sql')).sort()
      .map(f => fs.readFileSync(path.join(modulesDir, f), 'utf8').trimEnd()).join('\n\n')
  : '';

const HEAD_END = '-- PARTE 2 - CRIAR TUDO NOVO (padrão deste projeto)\n-- -------------------------------------------------------------------------\n';
const TAIL_START = '-- -------------------------------------------------------------------------\n-- PARTE 3 - PRIMEIRO USUÁRIO';

const headEnd = recriar.indexOf(HEAD_END);
const tailStart = recriar.lastIndexOf(TAIL_START);
if (headEnd < 0 || tailStart < 0) {
  console.error('Marcadores das partes 2/3 não encontrados em recriar_banco.sql');
  process.exit(1);
}

const out = recriar.slice(0, headEnd + HEAD_END.length) + schema.trimEnd() + '\n\n' + (modules ? modules + '\n\n' : '') + recriar.slice(tailStart);
fs.writeFileSync(recriarPath, out);
console.log('recriar_banco.sql atualizado a partir do schema.sql');
