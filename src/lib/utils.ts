export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in (value as object) && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  const d = new Date(value as any);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: unknown): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}
