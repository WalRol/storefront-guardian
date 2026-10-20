import { execFile, spawn } from 'node:child_process';

export interface ExecResult {
  code: number;
  output: string;
  durationMs: number;
  timedOut: boolean;
}

const ANSI = /\x1b\[[0-9;]*m/g;
const SECRET_VAR = /KEY|TOKEN|SECRET|PASSWORD|WEBHOOK/i;

/** El código del PR corre con este entorno: sin credenciales que pueda exfiltrar. */
function projectEnv(): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !SECRET_VAR.test(name)));
  return { ...env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' };
}

/**
 * Ejecuta un comando de shell del proyecto (npm, npx, etc.). Nunca lanza
 * excepción por exit code != 0: el llamador decide qué significa.
 */
export function runShell(command: string, cwd: string, timeoutMs = 180_000): Promise<ExecResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: projectEnv(),
    });
    let output = '';
    const onData = (chunk: Buffer) => (output += chunk.toString());
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        output: output.replace(ANSI, ''),
        durationMs: Date.now() - started,
        timedOut,
      });
    });
  });
}

/** Ejecuta git sin shell (evita problemas de quoting) y lanza si falla. */
export function git(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`git ${args.join(' ')} falló: ${stderr || err.message}`));
      else resolve(stdout);
    });
  });
}

export function tail(text: string, lines = 60): string {
  return text.trimEnd().split('\n').slice(-lines).join('\n');
}
