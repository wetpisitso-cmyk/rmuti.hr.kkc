/** UI uses Thai Buddhist Era; API/database storage remains Gregorian ISO. */
export const BE_OFFSET = 543;
const pad = (n: number) => String(n).padStart(2, "0");

export function normalizeThaiDigits(value: string): string {
  return value.replace(/[๐-๙]/g, (digit) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit)));
}

/** Buddhist DD/MM/BBBB -> Gregorian YYYY-MM-DD; null means invalid. */
export function parseBuddhistDate(value: string): string | null {
  const input = normalizeThaiDigits(value.trim());
  if (!input) return "";
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[2]);
  const yearBE = Number(match[3]), year = yearBE - BE_OFFSET;
  if (yearBE < 2400 || yearBE > 2800 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Gregorian YYYY-MM-DD or YYYY-MM-DDTHH:mm -> Buddhist DD/MM/BBBB. */
export function formatBuddhistInput(value?: string | null): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "";
  const display = `${match[3]}/${match[2]}/${Number(match[1]) + BE_OFFSET}`;
  return parseBuddhistDate(display) ? display : "";
}
