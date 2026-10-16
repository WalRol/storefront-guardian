#!/usr/bin/env -S npx tsx
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { git } from './exec';
import { createProvider, PROVIDERS, type ProviderName } from './llm';
import { runPipeline } from './pipeline';
import { loadPolicy } from './policy';
import { renderMarkdown } from './report';

const USAGE = `Uso:
  guardian review --base <ref> (--head <ref> | --patch <archivo>) [opciones]

Opciones:
  --provider <p>   ${PROVIDERS.join(' | ')}  (por defecto: GUARDIAN_PROVIDER o "replay")
  --record         Graba las respuestas del modelo para reproducirlas luego con --provider replay
  --no-fix         Solo revisar, sin intentar correcciones
  --title <t>      Título del PR (por defecto: mensaje del último commit de --head)
  --body <b>       Descripción del PR
  --label <l>      Identificador de la corrida (por defecto: hash del diff)
  --repo <dir>     Raíz del repo (por defecto: repo git actual)
  --out <dir>      Carpeta de salida (por defecto: <repo>/.guardian-out)
  --exit-zero      Devolver exit code 0 aunque el veredicto sea BLOCK`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      base: { type: 'string' },
      head: { type: 'string' },
      patch: { type: 'string' },
      provider: { type: 'string' },
      record: { type: 'boolean', default: false },
      'no-fix': { type: 'boolean', default: false },
      title: { type: 'string' },
      body: { type: 'string', default: '' },
      label: { type: 'string' },
      repo: { type: 'string' },
      out: { type: 'string' },
      'exit-zero': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help || positionals[0] !== 'review' || !values.base || (!values.head && !values.patch)) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 2);
  }

  const repoDir = values.repo ?? (await git(['rev-parse', '--show-toplevel'], process.cwd())).trim();
  const envFile = path.join(repoDir, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

  const providerName = (values.provider ?? process.env.GUARDIAN_PROVIDER ?? 'replay') as ProviderName;
  if (!PROVIDERS.includes(providerName)) throw new Error(`Proveedor inválido: ${providerName}`);

  const policy = loadPolicy(path.join(repoDir, 'guardian.policy.yaml'));
  const provider = createProvider(providerName, {
    cassetteDir: path.join(repoDir, 'agent', 'cassettes'),
    record: values.record,
  });
  const title =
    values.title ?? (values.head ? (await git(['log', '-1', '--format=%s', values.head], repoDir)).trim() : 'PR');

  const report = await runPipeline({
    repoDir,
    base: values.base,
    head: values.head,
    patch: values.patch,
    title,
    body: values.body,
    label: values.label,
    policy,
    provider,
    fix: !values['no-fix'],
    log: (msg) => console.error(`› ${msg}`),
  });

  const markdown = renderMarkdown(report, policy);
  const outDir = path.join(values.out ?? path.join(repoDir, '.guardian-out'), report.label);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.md'), markdown);
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  console.log(markdown);
  console.error(`› Reporte guardado en ${outDir}`);
  process.exit(report.decision.verdict === 'BLOCK' && !values['exit-zero'] ? 1 : 0);
}

main().catch((err) => {
  console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
