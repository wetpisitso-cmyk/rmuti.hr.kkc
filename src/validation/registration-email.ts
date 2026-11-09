/** Registration guard for obvious typo domains. This cannot prove mailbox ownership.
 * True mailbox verification must be done by Supabase Auth Confirm Email + working SMTP.
 */
const domainCorrections: Record<string, string> = {
  "gamil.com": "gmail.com",
  "gamail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cmo": "gmail.com",
  "gmai.co": "gmail.com",
  "gamil.co": "gmail.com",
  "gnail.com": "gmail.com",
  "gimail.com": "gmail.com",
  "hotnail.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "outllok.com": "outlook.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outloook.com": "outlook.com",
  "yahho.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yhoo.com": "yahoo.com",
};
const disposableDomains = new Set([
  "10minutemail.com", "mailinator.com", "guerrillamail.com",
  "yopmail.com", "tempmail.com", "trashmail.com",
]);
const reservedDomains = new Set(["example.com","example.org","example.net"]);

export function normalizeRegistrationEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function suggestedEmailCorrection(value: string): string | null {
  const email = normalizeRegistrationEmail(value);
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  const replacement = domainCorrections[email.slice(at + 1)];
  return replacement ? `${email.slice(0,at)}@${replacement}` : null;
}

export function registrationEmailIssue(value: string): string | null {
  const email = normalizeRegistrationEmail(value);
  if (!email) return "กรุณากรอกอีเมล";
  if (email.length > 254 || /\s/.test(email)) return "อีเมลไม่ถูกต้อง";
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "อีเมลไม่ถูกต้อง";
  const [local, domain] = parts;
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".")
    || local.includes("..") || domain.includes("..")) return "อีเมลไม่ถูกต้อง";
  const correction = suggestedEmailCorrection(email);
  if (correction) return `โดเมนอีเมลอาจพิมพ์ผิด คุณหมายถึง ${correction} ใช่หรือไม่?`;
  if (reservedDomains.has(domain) || /\.(invalid|test|local|localhost|example)$/.test(domain))
    return "กรุณาใช้อีเมลจริงของคุณ ไม่ใช่อีเมลตัวอย่างหรือโดเมนทดสอบ";
  if (disposableDomains.has(domain))
    return "กรุณาใช้อีเมลส่วนตัวที่ใช้งานประจำ ไม่ใช่อีเมลชั่วคราว";
  return null;
}
