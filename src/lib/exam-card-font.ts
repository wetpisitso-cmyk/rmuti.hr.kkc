/**
 * All typography on the exam admission card uses Google Fonts' Sarabun.
 * The font is already declared in the portal's index.html and distributed
 * under the SIL Open Font License. It supports Thai and Latin glyphs.
 *
 * Do not silently create an official-looking PDF using a fallback font when
 * the webfont fails to load: report the issue instead.
 */
export const EXAM_CARD_FONT_FAMILY = "Sarabun";

export function examCardFont(size: number, bold = false) {
  return (bold ? "700 " : "400 ") + size + 'px "Sarabun", sans-serif';
}

export async function ensureExamCardFont() {
  if (typeof document === "undefined" || !document.fonts) {
    throw new Error("EXAM_CARD_FONT_UNAVAILABLE");
  }
  try {
    const sample = "มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน ผู้สมัครสอบ สังกัด";
    const [regular, bold] = await Promise.all([
      document.fonts.load(examCardFont(32, false), sample),
      document.fonts.load(examCardFont(32, true), sample),
    ]);
    if (regular.length === 0 || bold.length === 0) {
      throw new Error("EXAM_CARD_FONT_UNAVAILABLE");
    }
    await document.fonts.ready;
  } catch {
    throw new Error("EXAM_CARD_FONT_UNAVAILABLE");
  }
}
