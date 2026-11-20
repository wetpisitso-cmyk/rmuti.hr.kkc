export type DocumentConfigurationItem = {
  key: string;
  label: string;
  required?: boolean;
};

/**
 * Document keys are unique per position. A single degree document upload type
 * covers both Bachelor's and higher-vocational applicants when allowed by the
 * position's qualification text.
 */
export function documentConfigurationError(docs: DocumentConfigurationItem[]): string | null {
  const seen = new Set<string>();
  for (const doc of docs) {
    const key = (doc.key || "").trim();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || !doc.label?.trim()) {
      return "กรุณาเลือกประเภทเอกสารและกรอกชื่อเอกสารให้ครบ";
    }
    if (seen.has(key)) {
      return "มีประเภทเอกสารซ้ำ กรุณาเลือกชนิดเอกสารที่ไม่ซ้ำกัน หรือแก้ไขชื่อที่แสดงแทนการเพิ่มรายการใหม่";
    }
    seen.add(key);
  }
  return null;
}

export function nextUnusedDocumentOption(
  docs: DocumentConfigurationItem[],
  options: readonly (readonly [string, string])[],
): readonly [string, string] | undefined {
  const used = new Set(docs.map((doc) => doc.key));
  return options.find(([key]) => !used.has(key));
}
