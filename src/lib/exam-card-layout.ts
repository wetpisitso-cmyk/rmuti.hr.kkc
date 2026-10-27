/**
 * Pure, measured A4 admission-card layout. All applicant values start on a
 * new line below their labels, never at a fixed X beside a long Thai label.
 * Widths are canvas pixels at 1240 × 1754 (A4 portrait).
 */
export interface ExamCardFieldInput {
  examNumber: string | null | undefined;
  name: string | null | undefined;
  jobTitle: string | null | undefined;
  department: string | null | undefined;
}

export interface PositionedCardField {
  label: string;
  lines: string[];
  x: number;
  labelY: number;
  valueYs: number[];
  maxWidth: number;
}

export interface ExamCardFieldLayout {
  fontSize: number;
  fields: PositionedCardField[];
  lastValueY: number;
}

const clean = (value: string | null | undefined) =>
  typeof value === "string" && value.trim() ? value.trim() : "—";

function segments(text: string, granularity: "word" | "grapheme"): string[] {
  if (typeof Intl.Segmenter === "function") {
    return Array.from(new Intl.Segmenter("th", { granularity }).segment(text), item => item.segment);
  }
  return Array.from(text);
}

/** Wrap without discarding long unspaced values or breaking Thai vowel glyphs. */
export function wrapCardText(text: string, maxWidth: number, measure: (text: string) => number) {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) throw new Error("CARD_LAYOUT_INVALID");
  const lines: string[] = [];
  let current = "";
  const commit = () => {
    if (current) lines.push(current);
    current = "";
  };
  for (const word of segments(text, "word")) {
    if (!word) continue;
    if (current && measure(current + word) > maxWidth) commit();
    // A single unspaced exam number can exceed the available width.
    if (measure(word) > maxWidth) {
      for (const glyph of segments(word, "grapheme")) {
        if (current && measure(current + glyph) > maxWidth) commit();
        if (measure(glyph) > maxWidth) throw new Error("CARD_TEXT_OVERFLOW");
        current += glyph;
      }
    } else {
      current += current ? word : word.trimStart();
    }
  }
  commit();
  return lines.length ? lines : ["—"];
}

/**
 * Reserve the portrait at x=955..1180, y=370..636.
 * Place exam number and name on the left, then long job/department full width.
 * Only accept layouts that fit above the approval/signature section at y=1010.
 */
export function layoutExamCardFields(
  input: ExamCardFieldInput,
  measure: (text: string, px: number) => number,
): ExamCardFieldLayout {
  const values = [
    ["เลขที่ประจำตัวสอบ", clean(input.examNumber)],
    ["ชื่อ–นามสกุล", clean(input.name)],
    ["ตำแหน่งที่สมัคร", clean(input.jobTitle)],
    ["สังกัดที่สมัคร", clean(input.department)],
  ] as const;

  for (const fontSize of [29, 27, 25, 23]) {
    let top = 380;
    const fields: PositionedCardField[] = [];
    const lineHeight = fontSize + 10;
    let lastValueY = 0;
    for (let i = 0; i < values.length; i++) {
      if (i === 2) top = Math.max(top, 672);
      const maxWidth = i < 2 ? 810 : 1070;
      const lines = wrapCardText(values[i][1], maxWidth, text => measure(text, fontSize));
      const valueYs = lines.map((_, line) => top + 68 + line * lineHeight);
      lastValueY = valueYs[valueYs.length - 1];
      fields.push({
        label: values[i][0],
        lines,
        x: 85,
        labelY: top + 23,
        valueYs,
        maxWidth,
      });
      top = lastValueY + 28;
    }
    if (lastValueY <= 984) return { fontSize, fields, lastValueY };
  }
  // Fail clearly instead of producing a clipped or overlapping official PDF.
  throw new Error("CARD_TEXT_OVERFLOW");
}
