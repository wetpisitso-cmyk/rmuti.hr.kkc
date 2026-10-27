import type { StaffRow } from "../types/models";
import { paymentLabels, statuses } from "../types/models";
import { dateTH } from "./format";

export interface RosterMeta {
  jobTitle: string;
  department: string;
  round: string;
  yearBE: number;
  generatedAt: string;
}
export interface RosterLine {
  order: number;
  applicationNumber: string;
  name: string;
  status: string;
  payment: string;
  submitted: string;
}

// A public-facing list is not appropriate: only staff who have report
// permissions can open the report page. Never export ID, address or phone.
export function rosterLines(rows: StaffRow[]): RosterLine[] {
  return rows.map((r, index) => ({
    order: index + 1,
    applicationNumber: r.application_number || "รอออกเลข",
    name: [r.personal_data?.prefix, r.personal_data?.first_name, r.personal_data?.last_name]
      .filter(Boolean).join(" ").trim() || "ไม่ระบุชื่อ",
    status: statuses[r.status] || r.status || "—",
    payment: paymentLabels[r.payment_status] || r.payment_status || "—",
    submitted: dateTH(r.submitted_at, true),
  }));
}
export function rosterFilename(meta: RosterMeta, ext: "pdf" | "xlsx") {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "-")
    .replace(/\s+/g, " ").trim().slice(0, 48);
  return "รายชื่อผู้สมัคร_" + safe(meta.jobTitle) + "_" + safe(meta.department) +
    "_" + meta.yearBE + "." + ext;
}
function xmlText(s: string) {
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function makeCell(ref: string, value: string | number, style: number) {
  const base = '<c r="' + ref + '" s="' + style + '"';
  // Inline strings, not formulas, block Excel formula injection.
  return typeof value === "number"
    ? base + '><v>' + value + '</v></c>'
    : base + ' t="inlineStr"><is><t xml:space="preserve">' +
      xmlText(value) + '</t></is></c>';
}
function makeRow(n: number, values: (string | number)[], style: number) {
  return '<row r="' + n + '">' +
    values.map((v, i) => makeCell("ABCDEF"[i] + n, v, style)).join("") +
    "</row>";
}
export function rosterSheetXml(lines: RosterLine[], meta: RosterMeta) {
  const headers = ["ลำดับ", "เลขที่ใบสมัคร", "ชื่อ–นามสกุล", "สถานะใบสมัคร", "สถานะชำระเงิน", "วันที่ส่งใบสมัคร"];
  const rows = [
    makeRow(1, ["บัญชีรายชื่อผู้สมัครสอบคัดเลือก"], 1),
    makeRow(2, ["ตำแหน่ง: " + meta.jobTitle + " | สังกัด: " + meta.department], 3),
    makeRow(3, ["รอบรับสมัคร: " + meta.round + " | พ.ศ. " + meta.yearBE], 3),
    makeRow(4, ["จัดทำเมื่อ " + dateTH(meta.generatedAt, true) + " | รวม " + lines.length + " รายการ"], 3),
    makeRow(6, headers, 2),
    ...lines.map((r, i) => makeRow(i + 7,
      [r.order, r.applicationNumber, r.name, r.status, r.payment, r.submitted], 4)),
  ];
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="20"/><cols>' +
    '<col min="1" max="1" width="10" customWidth="1"/>' +
    '<col min="2" max="2" width="23" customWidth="1"/>' +
    '<col min="3" max="3" width="38" customWidth="1"/>' +
    '<col min="4" max="4" width="24" customWidth="1"/>' +
    '<col min="5" max="5" width="24" customWidth="1"/>' +
    '<col min="6" max="6" width="28" customWidth="1"/>' +
    '</cols><sheetData>' + rows.join("") + '</sheetData>' +
    '<mergeCells count="4"><mergeCell ref="A1:F1"/><mergeCell ref="A2:F2"/>' +
    '<mergeCell ref="A3:F3"/><mergeCell ref="A4:F4"/></mergeCells>' +
    '<autoFilter ref="A6:F' + Math.max(7, lines.length + 6) + '"/>' +
    '<pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>' +
    '<pageSetup orientation="landscape" paperSize="9"/></worksheet>';
}
const stylesXml = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  '<fonts count="3"><font><sz val="11"/><name val="Tahoma"/></font>',
  '<font><b/><sz val="16"/><color rgb="FF102D55"/><name val="Tahoma"/></font>',
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font></fonts>',
  '<fills count="3"><fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FF102D55"/><bgColor indexed="64"/></patternFill></fill></fills>',
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>',
  '<border><left/><right/><top/><bottom style="hair"><color rgb="FFCFD8E3"/></bottom/><diagonal/></border></borders>',
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
  '<cellXfs count="5">',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
  '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>',
  '</cellXfs></styleSheet>',
].join("");

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
type ZipFile = { path: Uint8Array; bytes: Uint8Array; crc: number; offset: number };
function zipStore(files: Record<string, string>) {
  const encoder = new TextEncoder();
  const entries: ZipFile[] = Object.entries(files).map(([path, xml]) => {
    const bytes = encoder.encode(xml);
    return { path: encoder.encode(path), bytes, crc: crc32(bytes), offset: 0 };
  });
  const localSize = entries.reduce((n, x) => n + 30 + x.path.length + x.bytes.length, 0);
  const centralSize = entries.reduce((n, x) => n + 46 + x.path.length, 0);
  const zip = new Uint8Array(localSize + centralSize + 22);
  const d = new DataView(zip.buffer);
  const u16 = (i: number, n: number) => d.setUint16(i, n, true);
  const u32 = (i: number, n: number) => d.setUint32(i, n >>> 0, true);
  let p = 0;
  for (const e of entries) {
    e.offset = p;
    u32(p, 0x04034b50); u16(p + 4, 20); u16(p + 6, 0x0800);
    u32(p + 14, e.crc); u32(p + 18, e.bytes.length); u32(p + 22, e.bytes.length);
    u16(p + 26, e.path.length);
    zip.set(e.path, p + 30); zip.set(e.bytes, p + 30 + e.path.length);
    p += 30 + e.path.length + e.bytes.length;
  }
  const centralAt = p;
  for (const e of entries) {
    u32(p, 0x02014b50); u16(p + 4, 20); u16(p + 6, 20); u16(p + 8, 0x0800);
    u32(p + 16, e.crc); u32(p + 20, e.bytes.length); u32(p + 24, e.bytes.length);
    u16(p + 28, e.path.length); u32(p + 42, e.offset);
    zip.set(e.path, p + 46); p += 46 + e.path.length;
  }
  u32(p, 0x06054b50); u16(p + 8, entries.length); u16(p + 10, entries.length);
  u32(p + 12, centralSize); u32(p + 16, centralAt);
  return zip;
}
export function buildRosterXlsx(lines: RosterLine[], meta: RosterMeta): Blob {
  const files = {
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="รายชื่อผู้สมัคร" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "xl/styles.xml": stylesXml,
    "xl/worksheets/sheet1.xml": rosterSheetXml(lines, meta),
  };
  const zip = zipStore(files);
  const copy = new Uint8Array(zip.length);
  copy.set(zip);
  return new Blob([copy.buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
export function saveRosterFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
