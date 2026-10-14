export const dateTH = (s?: string | null, time = false) =>
  s
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        ...(time ? { timeStyle: "short" as const } : {}),
        timeZone: "Asia/Bangkok",
      }).format(new Date(s))
    : "—";
export const numberTH = (n: number) => new Intl.NumberFormat("th-TH").format(n);
export const money = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(
    n,
  );
export function bangkokInput(iso: string) {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
  return p.replace(" ", "T");
}
export const bangkokISO = (local: string) =>
  local
    ? new Date(
        local.length === 10 ? `${local}T00:00:00+07:00` : `${local}:00+07:00`,
      ).toISOString()
    : "";
export const safeUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
};
export function csv(rows: Record<string, unknown>[]) {
  const keys = Object.keys(rows[0] || {});
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      keys.map(cell).join(","),
      ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
    ].join("\r\n")
  );
}
export function downloadCSV(rows: Record<string, unknown>[], name: string) {
  const url = URL.createObjectURL(
    new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const printPage = async () => {
  await document.fonts.ready;
  window.print();
};
