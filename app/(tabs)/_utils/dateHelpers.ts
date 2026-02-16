export function localDateKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function diffDays(a: string, b: string) {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
