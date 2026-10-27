import { PDFDocument } from "pdf-lib";
import type { ExamCardRecord } from "./exam-card-data";
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
function fitLines(ctx:CanvasRenderingContext2D,text:string,maxWidth:number){
 const out:string[]=[];let segment="";
 // Thai has no word separators. Intl.Segmenter improves wrapping and works in current Chrome/Safari.
 const pieces=typeof Intl.Segmenter==="function"
  ?Array.from(new Intl.Segmenter("th",{granularity:"word"}).segment(text),x=>x.segment)
  :Array.from(text);
 for(const piece of pieces){
  if(segment&&ctx.measureText(segment+piece).width>maxWidth){out.push(segment);segment=piece.trimStart();}
  else segment+=piece;
 }
 if(segment)out.push(segment);
 return out;
}
function field(ctx:CanvasRenderingContext2D,label:string,value:string,y:number){
 ctx.font="bold 29px Tahoma, sans-serif";ctx.fillStyle="#173558";ctx.fillText(label,85,y);
 ctx.font="29px Tahoma, sans-serif";ctx.fillStyle="#172F4A";
 const lines=fitLines(ctx,value,y<610?590:750);
 lines.slice(0,3).forEach((t,i)=>ctx.fillText(t,320,y+i*42));
 return y+Math.max(lines.length,1)*48+21;
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
 ctx.textAlign="center";ctx.fillStyle="#fff";
 ctx.font="bold 37px Tahoma, sans-serif";
 ctx.fillText("มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน",WIDTH/2,100);
 ctx.font="bold 34px Tahoma, sans-serif";ctx.fillText("วิทยาเขตขอนแก่น",WIDTH/2,151);
 ctx.font="bold 40px Tahoma, sans-serif";ctx.fillText("บัตรประจำตัวผู้สมัครสอบ",WIDTH/2,220);
 ctx.textAlign="left";ctx.fillStyle="#102D55";
 ctx.font="bold 30px Tahoma, sans-serif";ctx.fillText(item.card.issue_label,90,329);
 const photo=await imageFromData(item.photo);
 const dx=937,dy=320,dw=205,dh=262;
 // Maintain proportions, crop at center.
 const ratio=Math.max(dw/photo.naturalWidth,dh/photo.naturalHeight);
 const sw=dw/ratio,sh=dh/ratio;
 ctx.drawImage(photo,(photo.naturalWidth-sw)/2,(photo.naturalHeight-sh)/2,sw,sh,dx,dy,dw,dh);
 ctx.strokeStyle="#9AAEC4";ctx.lineWidth=3;ctx.strokeRect(dx,dy,dw,dh);
 let y=402;
 y=field(ctx,"เลขที่ประจำตัวสอบ",item.card.exam_number,y);
 y=field(ctx,"ชื่อ–นามสกุล",item.card.name,y);
 y=field(ctx,"ตำแหน่งที่สมัคร",item.card.job_title,y);
 y=field(ctx,"สังกัดที่สมัคร",item.card.department,y);
 if(y>835)throw Error("CARD_TEXT_OVERFLOW");
 ctx.strokeStyle="#D8E1E9";ctx.beginPath();ctx.moveTo(80,875);ctx.lineTo(1160,875);ctx.stroke();
 const signature=await imageFromData(item.card.signature_png);
 const maxW=275,maxH=135,scale=Math.min(maxW/signature.naturalWidth,maxH/signature.naturalHeight);
 const x=970-signature.naturalWidth*scale/2;
 ctx.drawImage(signature,x,927,signature.naturalWidth*scale,signature.naturalHeight*scale);
 ctx.fillStyle="#1D3553";ctx.font="25px Tahoma, sans-serif";ctx.textAlign="center";
 ctx.fillText("____________________________",970,1090);
 ctx.font="bold 26px Tahoma, sans-serif";ctx.fillText("เจ้าหน้าที่ออกบัตรรับสมัคร",970,1135);
 ctx.font="23px Tahoma, sans-serif";ctx.fillText(item.card.signer_name,970,1172);
 ctx.textAlign="left";ctx.font="23px Tahoma, sans-serif";ctx.fillText("ออกบัตรวันที่ "+dateBE(item.card.issued_at),88,1140);
 const boxTop=1240,boxBottom=1660;
 ctx.fillStyle="#FFF4E8";ctx.fillRect(75,boxTop,1090,boxBottom-boxTop);
 ctx.strokeStyle="#102D55";ctx.lineWidth=3;ctx.strokeRect(75,boxTop,1090,boxBottom-boxTop);
 ctx.fillStyle="#F47721";ctx.fillRect(75,boxTop,1090,55);
 ctx.fillStyle="#102D55";ctx.font="bold 31px Tahoma, sans-serif";ctx.textAlign="center";
 ctx.fillText("ข้อปฏิบัติสำหรับผู้เข้าสอบ",WIDTH/2,boxTop+39);
 ctx.textAlign="left";ctx.fillStyle="#1D3553";ctx.font="23px Tahoma, sans-serif";
 let py=boxTop+92;
 for (const rule of INSTRUCTIONS){
  const lines=fitLines(ctx,rule,1012);
  lines.forEach(line=>{ctx.fillText(line,113,py);py+=34;});
  py+=18;
 }
 if(py>boxBottom-18)throw Error("CARD_NOTICE_OVERFLOW");
 ctx.font="19px Tahoma, sans-serif";ctx.fillStyle="#667B92";ctx.textAlign="center";
 ctx.fillText("เอกสารจากระบบรับสมัครบุคลากรออนไลน์ · มทร.อีสาน วิทยาเขตขอนแก่น",WIDTH/2,1710);
 return new Uint8Array(await (await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error("PNG_FAILED")),"image/png"))).arrayBuffer());
}
export async function makeExamCardPdf(items:CardItem[]):Promise<Blob>{
 if(items.length===0)throw Error("NO_CARDS");
 if(items.length>100)throw Error("BATCH_MAX_100");
 await document.fonts.ready;
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
 a.href=url;a.download=filename;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
