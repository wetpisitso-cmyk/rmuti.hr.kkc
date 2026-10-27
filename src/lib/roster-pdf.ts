import type { RosterLine, RosterMeta } from "./roster-export";
import { dateTH } from "./format";

// Render Thai text through the browser canvas rather than PDF standard fonts,
// which do not support the Thai glyph set. Keep each page A4 landscape.
const W = 1600, H = 1132;
const PAGE_SIZE = 22;
type PdfLib = typeof import("pdf-lib");
let library: Promise<PdfLib> | undefined;
const loadPdfLib = () => library ||= import("pdf-lib").catch(e => { library = undefined; throw e; });
function trimText(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let value = text;
  while (value.length && ctx.measureText(value + "…").width > max) value = value.slice(0, -1);
  return value + "…";
}
function renderPage(lines: RosterLine[], meta: RosterMeta, page: number, pages: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("ไม่สามารถสร้างเอกสาร PDF บนอุปกรณ์นี้");
  c.fillStyle = "#ffffff"; c.fillRect(0, 0, W, H);
  c.fillStyle = "#102D55"; c.fillRect(0, 0, W, 160);
  c.fillStyle = "#F47721"; c.fillRect(0, 154, W, 8);
  c.textAlign = "center"; c.fillStyle = "#ffffff";
  c.font = "bold 35px Tahoma, sans-serif";
  c.fillText("มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น", W / 2, 64);
  c.font = "bold 31px Tahoma, sans-serif";
  c.fillText("บัญชีรายชื่อผู้สมัครสอบคัดเลือก", W / 2, 116);
  c.fillStyle = "#102D55"; c.font = "bold 28px Tahoma, sans-serif";
  c.fillText(trimText(c, "ตำแหน่ง " + meta.jobTitle, W - 120), W / 2, 208);
  c.font = "23px Tahoma, sans-serif";
  c.fillText(trimText(c, "สังกัด " + meta.department, W - 120), W / 2, 250);
  c.font = "21px Tahoma, sans-serif";
  c.fillText(trimText(c, "รอบ " + meta.round + " (พ.ศ. " + meta.yearBE + ")", W - 120), W / 2, 285);

  const left = 60, right = 1540, top = 325, rowH = 31;
  const columns = [
    { text: "ลำดับ", x: 65, width: 95 },
    { text: "เลขที่ใบสมัคร", x: 160, width: 225 },
    { text: "ชื่อ–นามสกุล", x: 385, width: 435 },
    { text: "สถานะใบสมัคร", x: 820, width: 235 },
    { text: "การชำระเงิน", x: 1055, width: 215 },
    { text: "วันที่ส่งใบสมัคร", x: 1270, width: 270 },
  ];
  c.fillStyle = "#102D55"; c.fillRect(left, top, right - left, 48);
  c.fillStyle = "#fff"; c.font = "bold 22px Tahoma, sans-serif";
  c.textAlign = "left";
  columns.forEach(col => c.fillText(col.text, col.x + 9, top + 32));
  lines.forEach((line, i) => {
    const y = top + 48 + i * rowH;
    c.fillStyle = i % 2 ? "#ffffff" : "#F3F7FC";
    c.fillRect(left, y, right - left, rowH);
    c.fillStyle = "#1C304D"; c.font = "20px Tahoma, sans-serif";
    const values = [String(line.order), line.applicationNumber, line.name, line.status, line.payment, line.submitted];
    columns.forEach((col, k) => c.fillText(trimText(c, values[k], col.width - 17), col.x + 9, y + 23));
  });
  c.strokeStyle = "#CAD4E3"; c.lineWidth = 1;
  c.strokeRect(left, top, right - left, 48 + lines.length * rowH);
  c.fillStyle = "#64748B"; c.textAlign = "left";
  c.font = "20px Tahoma, sans-serif";
  c.fillText("จัดทำเมื่อ " + dateTH(meta.generatedAt, true) + " • เฉพาะเจ้าหน้าที่ผู้มีสิทธิ์", left, H - 45);
  c.textAlign = "right";
  c.fillText("หน้า " + page + "/" + pages, right, H - 45);
  return canvas;
}
export async function buildRosterPdf(lines: RosterLine[], meta: RosterMeta) {
  await document.fonts.ready;
  const lib = await loadPdfLib();
  const pdf = await lib.PDFDocument.create();
  pdf.setTitle("บัญชีรายชื่อผู้สมัครสอบคัดเลือก - " + meta.jobTitle);
  const pages = Math.max(1, Math.ceil(lines.length / PAGE_SIZE));
  for (let p = 0; p < pages; p++) {
    const canvas = renderPage(lines.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE), meta, p + 1, pages);
    const png = await pdf.embedPng(canvas.toDataURL("image/png"));
    const paper = pdf.addPage([841.89, 595.28]);
    paper.drawImage(png, { x: 0, y: 0, width: 841.89, height: 595.28 });
  }
  const bytes = await pdf.save();
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: "application/pdf" });
}
