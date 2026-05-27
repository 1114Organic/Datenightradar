export function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean)));
}

export function sanitizeNote(note?: string): string | undefined {
  return note?.slice(0, 2000).replace(/[<>]/g, "");
}
