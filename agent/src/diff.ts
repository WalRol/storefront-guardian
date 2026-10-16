export interface AddedLine {
  line: number;
  text: string;
}

export interface ChangedFile {
  path: string;
  added: AddedLine[];
  deleted: boolean;
}

/** Extrae, de un diff unificado de git, las líneas agregadas por archivo con su número de línea. */
export function parseDiff(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  let current: ChangedFile | undefined;
  let newLine = 0;

  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      const path = / b\/(.+)$/.exec(raw)?.[1] ?? '';
      current = { path, added: [], deleted: false };
      files.push(current);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('+++ ')) {
      if (raw.includes('/dev/null')) current.deleted = true;
      continue;
    }
    if (raw.startsWith('--- ')) continue;

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      newLine = Number(hunk[1]);
    } else if (raw.startsWith('+')) {
      current.added.push({ line: newLine++, text: raw.slice(1) });
    } else if (raw.startsWith(' ')) {
      newLine++;
    }
  }
  return files;
}
