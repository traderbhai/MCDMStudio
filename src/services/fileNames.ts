export function safeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim()
    .replace(/[. ]+$/g, '') || 'mcdm-studio-export';
}

export function safeSheetName(name: string, usedNames = new Set<string>()): string {
  const base = (name.replace(/[\\/:?*[\]]/g, '-').trim() || 'Sheet').slice(0, 31);
  let candidate = base;
  let index = 2;
  while (usedNames.has(candidate)) {
    const suffix = ` ${index}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  usedNames.add(candidate);
  return candidate;
}
