import { PDFDocument } from "pdf-lib";
import type { ExamCardRecord } from "./exam-card-data";
import { layoutExamCardFields, wrapCardText } from "./exam-card-layout";
import { ensureExamCardFont, examCardFont } from "./exam-card-font";
type CardItem={card:ExamCardRecord;photo:string};
const WIDTH=1240, HEIGHT=1754;
const INSTRUCTIONS=[
 "1. ต้องแสดงบัตรประจำตัวผู้สมัครนี้ คู่กับ บัตรประชาชน หรือบัตรประตัวอื่นที่ทางราชการออกให้ทุกครั้งที่เข้าสอบข้อเขียน สอบปฏิบัติ และมารับการจัดจ้าง หากไม่มีทั้งสองบัตรแสดงคู่กัน อาจไม่ได้รับอนุญาตให้เข้ารับการสอบคัดเลือก",
 "2. ผู้กระทำการทุจริตในการสอบคัดเลือกจะถูกลงโทษปรับให้ออกทุกวิชา และเป็นผู้ขาดคุณสมบัติที่จะจัดจ้าง",
];
export const EXAM_CARD_INSTRUCTIONS=INSTRUCTIONS;
async function imageFromData(url:string){
 return new Promise<HTMLImageElement>((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error("INVALID_CARD_IMAGE"));img.src=url;
 });
}
function drawFitted(
 ctx: CanvasRenderingContext2D,
 text: string,
 cx: number,
 y: number,
 maxWidth: number,
 initialSize: number,
 minSize: number,
) {
 for (let size=initialSize;size>=minSize;size--) {
  ctx.font=examCardFont(size,true);
  if(ctx.measureText(text).width<=maxWidth){ctx.fillText(text,cx,y);return;}
 }
 throw new Error("CARD_TEXT_OVERFLOW");
}
function dateBE(date:string){
 const d=new Date(date);return Number.isFinite(d.valueOf())
  ?new Intl.DateTimeFormat("th-TH",{dateStyle:"long",timeZone:"Asia/Bangkok"}).format(d):"";
}
async function makePage(item:CardItem):Promise<Uint8Array>{
 const canvas=document.createElement("canvas");canvas.width=WIDTH;canvas.height=HEIGHT;
 const ctx=canvas.getContext("2d");if(!ctx)throw Error("PDF_CANVAS_UNAVAILABLE");
 ctx.fillStyle="#fff";ctx.fillRect(0,0,WIDTH,HEIGHT);
 ctx.fillStyle="#102D55";ctx.fillRect(0,0,WIDTH,265);
 ctx.fillStyle="#F47721";ctx.fillRect(0,260,WIDTH,8);
 // Reuse the original unmodified university crest already shipped with the portal.
 try {const crest=await imageFromData(import.meta.env.BASE_URL+"logo.png");
  const ratio=Math.min(125/crest.naturalWidth,175/crest.naturalHeight);
  ctx.drawImage(crest,55,40,crest.naturalWidth*ratio,crest.naturalHeight*ratio);
 }catch{throw Error("UNIVERSITY_LOGO_MISSING");}
 // Keep the university heading inside the page and to the right of the crest.
 ctx.textAlign="center";ctx.fillStyle="#fff";
 drawFitted(ctx,"มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน",715,100,870,38,25);
 drawFitted(ctx,"วิทยาเขตขอนแก่น",715,151,870,35,27);
 drawFitted(ctx,"บัตรประจำตัวผู้สมัครสอบ",715,219,870,42,30);

 // Section label and portrait occupy separate fixed regions.
 ctx.textAlign="left";ctx.fillStyle="#102D55";
 ctx.font=examCardFont(30,true);
 const roundLines=wrapCardText(item.card.issue_label||"ครั้งที่สอบ",1065,t=>ctx.measureText(t).width);
 if(roundLines.length>1)throw Error("CARD_TEXT_OVERFLOW");
 ctx.fillText(roundLines[0],85,329);

 const photo=await imageFromData(item.photo);
 const dx=955,dy=374,dw=225,dh=266;
 const ratio=Math.max(dw/photo.naturalWidth,dh/photo.naturalHeight);
 const sw=dw/ratio,sh=dh/ratio;
 ctx.drawImage(photo,(photo.naturalWidth-sw)/2,(photo.naturalHeight-sh)/2,sw,sh,dx,dy,dw,dh);
 ctx.strokeStyle="#9AAEC4";ctx.lineWidth=3;ctx.strokeRect(dx,dy,dw,dh);

 const layout=layoutExamCardFields({
  examNumber:item.card.exam_number,
  name:item.card.name,
  jobTitle:item.card.job_title,
  department:item.card.department,
 },(value,size)=>{
  ctx.font=examCardFont(size);
  return ctx.measureText(value).width;
 });
 for(const field of layout.fields){
  ctx.textAlign="left";ctx.fillStyle="#173558";
  ctx.font=examCardFont(layout.fontSize,true);
  ctx.fillText(field.label,field.x,field.labelY);
  ctx.fillStyle="#172F4A";
  ctx.font=examCardFont(layout.fontSize);
  field.lines.forEach((line,i)=>ctx.fillText(line,field.x,field.valueYs[i]));
 }
 ctx.strokeStyle="#D8E1E9";ctx.beginPath();ctx.moveTo(80,1025);ctx.lineTo(1160,1025);ctx.stroke();
 const signature=await imageFromData(item.card.signature_png);
 const maxW=275,maxH=135,scale=Math.min(maxW/signature.naturalWidth,maxH/signature.naturalHeight);
 const x=970-signature.naturalWidth*scale/2;
 ctx.drawImage(signature,x,1040,signature.naturalWidth*scale,signature.naturalHeight*scale);
 ctx.fillStyle="#1D3553";ctx.font=examCardFont(25);ctx.textAlign="center";
 ctx.fillText("____________________________",970,1177);
 ctx.font=examCardFont(26,true);ctx.fillText("เจ้าหน้าที่ออกบัตรรับสมัคร",970,1210);
 ctx.font=examCardFont(23);ctx.fillText(item.card.signer_name||"",970,1240);
 ctx.textAlign="left";ctx.font=examCardFont(23);ctx.fillText("ออกบัตรวันที่ "+dateBE(item.card.issued_at),88,1210);
 const boxTop=1275,boxBottom=1683;
 ctx.fillStyle="#FFF4E8";ctx.fillRect(75,boxTop,1090,boxBottom-boxTop);
 ctx.strokeStyle="#102D55";ctx.lineWidth=3;ctx.strokeRect(75,boxTop,1090,boxBottom-boxTop);
 ctx.fillStyle="#F47721";ctx.fillRect(75,boxTop,1090,55);
 ctx.fillStyle="#102D55";ctx.font=examCardFont(31,true);ctx.textAlign="center";
 ctx.fillText("ข้อปฏิบัติสำหรับผู้เข้าสอบ",WIDTH/2,boxTop+39);
 ctx.textAlign="left";ctx.fillStyle="#1D3553";ctx.font=examCardFont(23);
 let py=boxTop+92;
 for (const rule of INSTRUCTIONS){
  const lines=wrapCardText(rule,1012,t=>ctx.measureText(t).width);
  lines.forEach(line=>{ctx.fillText(line,113,py);py+=34;});
  py+=18;
 }
 if(py>boxBottom-18)throw Error("CARD_NOTICE_OVERFLOW");
 ctx.font=examCardFont(19);ctx.fillStyle="#667B92";ctx.textAlign="center";
 ctx.fillText("เอกสารจากระบบรับสมัครบุคลากรออนไลน์ · มทร.อีสาน วิทยาเขตขอนแก่น",WIDTH/2,1725);
 return new Uint8Array(await (await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("PNG_FAILED")),"image/png"))).arrayBuffer());
}
export async function makeExamCardPdf(items:CardItem[]):Promise<Blob>{
 if(items.length===0)throw Error("NO_CARDS");
 if(items.length>20)throw Error("BATCH_MAX_20");
 await ensureExamCardFont();
 const doc=await PDFDocument.create();doc.setTitle("บัตรประจำตัวผู้สมัครสอบ");
 for(const item of items){
  const img=await doc.embedPng(await makePage(item));
  const page=doc.addPage([595.28,841.89]);
  page.drawImage(img,{x:0,y:0,width:595.28,height:841.89});
 }
 const bytes=await doc.save();const copy=new Uint8Array(bytes.length);copy.set(bytes);
 return new Blob([copy.buffer],{type:"application/pdf"});
}
export function downloadExamCard(blob:Blob,filename:string){
 const url=URL.createObjectURL(blob);const a=document.createElement("a");
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
