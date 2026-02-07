import path from 'node:path';

export function normalizeRepoKey(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }
  const resolved = path.resolve(trimmed);
  const unified = resolved.replace(/[\\/]+/g, path.sep);
  if (process.platform === 'win32') {
    return unified.toLowerCase();
  }
  return unified;
}
