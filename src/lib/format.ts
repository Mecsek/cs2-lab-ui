export function fmtClock(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "-:--";
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtMoney(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

/** `weapon_ak47` -> `ak47` */
export function weaponLabel(w: string): string {
  return w.replace(/^weapon_/, "").replace(/_silencer$/, "-s");
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function fmtDuration(fromIso: string, toIso: string | null): string {
  const a = Date.parse(fromIso);
  const b = toIso ? Date.parse(toIso) : Date.now();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "—";
  const m = Math.round((b - a) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}
