export function localDateKey() {
  return formatLocalDateKey(new Date());
}

export function formatLocalDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function diffDays(a: string, b: string) {
  if (!isValidDateKey(a) || !isValidDateKey(b)) return 0;
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function offsetDateKey(dateKey: string, days: number): string {
  if (!isValidDateKey(dateKey) || !Number.isFinite(days)) return dateKey;
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + Math.trunc(days));
  return formatLocalDateKey(date);
}
