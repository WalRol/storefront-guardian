import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, runShell } from './exec';
import type { Policy } from './policy';

/**
 * Copia aislada del repo (git worktree) con el PR aplicado como HEAD.
 * El agente nunca toca el directorio de trabajo del desarrollador: prueba sus
 * correcciones aquí y entrega un patch.
 */
export interface Workspace {
  dir: string;
  baseSha: string;
  diff: string;
  diffHash: string;
  /** Vuelve al estado exacto del PR, descartando cambios del corrector. */
  reset(): Promise<void>;
  cleanup(): Promise<void>;
}

export interface WorkspaceInput {
  repoDir: string;
  base: string;
  head?: string;
  patch?: string;
  policy: Policy;
}

const GUARDIAN_GIT = ['-c', 'user.name=storefront-guardian', '-c', 'user.email=guardian@localhost'];

export async function prepareWorkspace(input: WorkspaceInput): Promise<Workspace> {
  const { repoDir, policy } = input;
  const baseSha = (await git(['rev-parse', input.base], repoDir)).trim();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-'));

  if (input.head) {
    await git(['worktree', 'add', '--detach', dir, input.head], repoDir);
  } else if (input.patch) {
    await git(['worktree', 'add', '--detach', dir, baseSha], repoDir);
    await git(['apply', '--index', path.resolve(input.patch)], dir);
    await git([...GUARDIAN_GIT, 'commit', '-q', '-m', 'PR bajo revisión'], dir);
  } else {
    throw new Error('Se necesita --head o --patch');
  }

  const diff = await git(['diff', baseSha, 'HEAD'], dir);
  const projectDir = path.join(dir, policy.project.dir);
  const linked = linkDependencies(path.join(repoDir, policy.project.dir), projectDir, diff, policy);
  if (!linked) {
    const install = await runShell(policy.project.install, projectDir, 600_000);
    if (install.code !== 0) throw new Error(`Falló la instalación de dependencias:\n${install.output}`);
  }

  return {
    dir,
    baseSha,
    diff,
    diffHash: createHash('sha256').update(diff).digest('hex').slice(0, 12),
    async reset() {
      await git(['reset', '--hard', '-q', 'HEAD'], dir);
      await git(['clean', '-fdq'], dir);
    },
    async cleanup() {
      unlinkDependencies(projectDir);
      await git(['worktree', 'remove', '--force', dir], repoDir).catch(() => undefined);
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Reutiliza node_modules del repo original vía symlink/junction si el PR no
 * toca las dependencias. Evita un `npm ci` de ~1 minuto por corrida.
 */
function linkDependencies(sourceProject: string, targetProject: string, diff: string, policy: Policy): boolean {
  const source = path.join(sourceProject, 'node_modules');
  const depsChanged = new RegExp(`${policy.project.dir}/(package(-lock)?\\.json)`).test(diff);
  if (depsChanged || !fs.existsSync(source)) return false;
  fs.symlinkSync(source, path.join(targetProject, 'node_modules'), 'junction');
  return true;
}

function unlinkDependencies(projectDir: string) {
  const link = path.join(projectDir, 'node_modules');
  try {
    if (!fs.lstatSync(link).isSymbolicLink()) return;
  } catch {
    return;
  }
  // Se borra solo el enlace, nunca el node_modules original al que apunta.
  try {
    fs.unlinkSync(link);
  } catch {
    fs.rmdirSync(link);
  }
}
