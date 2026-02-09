export function formatTagLabel(raw: string): string {
  return raw.replace(/^\[(.*)\]$/, '$1');
}

export function normalizeTagValue(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed;
  }

  return `[${trimmed}]`;
}

export function stripTagBrackets(raw: string): string {
  return raw.replace(/^\[(.*)\]$/, '$1').trim();
}
