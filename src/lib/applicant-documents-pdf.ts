import { getApplication, signedFile } from "../services/api";
import type { AppDocument, Application } from "../types/models";
import { dateTH } from "./format";

// pdf-lib only loads when an Admin actually exports a dossier.
// Personal applicant data is processed locally: nothing is posted to the CDN.
type PdfPage = { getSize(): {width:number;height:number} };
type PdfDoc = {
  addPage(size?:[number,number]): PdfPage;
  embedPng(bytes: Uint8Array):Promise<{width:number;height:number}>;
  embedJpg(bytes: Uint8Array):Promise<{width:number;height:number}>;
  embedPdf?(bytes:Uint8Array):Promise<unknown>;
  copyPages(from: PdfDoc, indexes:number[]):Promise<PdfPage[]>;
  getPageCount():number;
  getPageIndices():number[];
  save():Promise<Uint8Array>;
  insertPage(index:number,page:PdfPage):void;
};
type PdfLib = { PDFDocument: {create():Promise<PdfDoc>;load(bytes:Uint8Array):Promise<PdfDoc>} };
declare global { interface Window { PDFLib?: PdfLib } }
let library:Promise<PdfLib>|undefined;
function loadPdfLib():Promise<PdfLib> {
  if(window.PDFLib) return Promise.resolve(window.PDFLib);
  if(library) return library;
  const pending:Promise<PdfLib>=new Promise<PdfLib>((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
    script.crossOrigin="anonymous";
    script.referrerPolicy="no-referrer";
    script.onload=()=>window.PDFLib?resolve(window.PDFLib):reject(new Error("PDF_LIBRARY_FAILED"));
    script.onerror=()=>reject(new Error("PDF_LIBRARY_FAILED"));
    document.head.appendChild(script);
  });
  library=pending.catch(e=>{library=undefined;throw e});
  return library;
}
const A4:[number,number]=[595.28,841.89];
const toBytes=async(url:string)=>{
  const response=await fetch(url,{mode:"cors",credentials:"omit",cache:"no-store"});
  if(!response.ok) throw new Error("FILE_DOWNLOAD_FAILED");
  const body=await response.arrayBuffer();
  if(body.byteLength>15*1024*1024) throw new Error("FILE_TOO_LARGE");
  return new Uint8Array(body);
};
function coverPng(title:string,lines:string[]):Uint8Array {
  const canvas=document.createElement("canvas");
  canvas.width=1240;canvas.height=1754;
  const c=canvas.getContext("2d");
  if(!c) throw new Error("PDF_RENDER_FAILED");
  c.fillStyle="#fff";c.fillRect(0,0,canvas.width,canvas.height);
  c.fillStyle="#102D55";c.fillRect(0,0,canvas.width,255);
  c.fillStyle="#F47721";c.fillRect(0,240,canvas.width,15);
  c.textAlign="left";c.fillStyle="#fff";c.font="bold 49px sans-serif";
  c.fillText("RMUTI KHON KAEN",85,106);
  c.font="35px sans-serif";c.fillText("แฟ้มเอกสารประกอบใบสมัคร",85,178);
  c.fillStyle="#102D55";c.font="bold 48px sans-serif";
  const chunks=title.match(/.{1,28}/gu)||[title];
  chunks.slice(0,3).forEach((line,i)=>c.fillText(line,85,360+i*69));
  let y=610;c.font="32px sans-serif";c.fillStyle="#253e5d";
  for(const line of lines){
    if(y>1570) break;
    const pieces=line.match(/.{1,57}/gu)||[line];
    for(const part of pieces){c.fillText(part,85,y);y+=53;}
    y+=11;
  }
  c.fillStyle="#63748a";c.font="24px sans-serif";
  c.fillText("จัดทำจากเอกสารแนบของผู้สมัครโดยผู้ดูแลระบบ",85,1660);
  const b64=canvas.toDataURL("image/png").split(",")[1];
  const bin=atob(b64),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return bytes;
}
function safeFilename(s:string){return s.replace(/[\\/:*?"<>|\\x00-\\x1f]/g,"-").trim().slice(0,100)||"ผู้สมัคร";}
function isImage(mime:string){return mime==="image/png"||mime==="image/jpeg";}
export async function downloadApplicantDocumentsPdf(applicationId:string,onProgress?:(text:string)=>void){
  const {data:auth}=await (await import("../lib/supabase")).supabase.auth.getUser();
  if(!auth.user)throw new Error("UNAUTHORIZED");
  const {data:role,error}=await (await import("../lib/supabase")).supabase.from("user_roles").select("role").eq("user_id",auth.user.id).single();
  if(error||role?.role!=="admin")throw new Error("FORBIDDEN");
  const result=await getApplication(applicationId);
  const a:Application=result.application;
  const all:AppDocument[]=[...result.documents];
  const existing=new Set(all.map(d=>d.storage_path));
  // Include payment evidence even if it has a historic storage path.
  for(const p of result.payments){
    const path=String(p.slip_path||"");
    if(path && !existing.has(path)){
      all.push({id:String(p.id),application_id:applicationId,document_type:"payment",storage_path:path,file_name:"หลักฐานชำระเงิน",mime_type:"",size_bytes:0,uploaded_at:String(p.created_at||"")});
      existing.add(path);
    }
  }
  if(!all.length)throw new Error("NO_APPLICANT_DOCUMENTS");
  if(all.length>45)throw new Error("TOO_MANY_DOCUMENTS");
  onProgress?.("กำลังเตรียมแฟ้ม PDF…");
  const lib=await loadPdfLib();
  const pdf=await lib.PDFDocument.create();
  const fullname=[a.personal_data.prefix,a.personal_data.first_name,a.personal_data.last_name].filter(Boolean).join(" ");
  const descriptors=all.map((doc,i)=>`${i+1}. ${a.job_positions?.required_documents?.find(r=>r.key===doc.document_type)?.label || (doc.document_type==="payment"?"หลักฐานชำระเงิน":doc.document_type)} — ${doc.file_name}`);
  const cover=await pdf.embedPng(coverPng(fullname,[
    "เลขผู้สมัคร: "+(a.application_number||"ยังไม่ได้รับเลขผู้สมัคร"),
    "ตำแหน่ง: "+(a.job_positions?.title||"—"),
    "วันที่จัดทำ: "+dateTH(new Date().toISOString(),true),
    "เอกสารที่แนบทั้งหมด: "+all.length+" รายการ",
    ...descriptors,
  ]));
  const coverPage=pdf.addPage(A4);
  const cp=coverPage as PdfPage & {drawImage:(image:unknown,opts:Record<string,number>)=>void};
  cp.drawImage(cover,{x:0,y:0,width:A4[0],height:A4[1]});
  for(let i=0;i<all.length;i++){
    const doc=all[i];
    onProgress?.(`กำลังรวมเอกสาร ${i+1}/${all.length}: ${doc.file_name}`);
    let bytes:Uint8Array;
    try {
      bytes=await toBytes(await signedFile(doc.storage_path));
      const maybePdf=doc.mime_type==="application/pdf"||bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70;
      if(maybePdf){
        const source=await lib.PDFDocument.load(bytes);
        if(source.getPageCount()>100)throw new Error("TOO_MANY_PAGES");
        const pages=await pdf.copyPages(source,source.getPageIndices());
        for(const page of pages) pdf.insertPage(pdf.getPageCount(),page);
      }else if(isImage(doc.mime_type)||bytes[0]===255&&bytes[1]===216||bytes[0]===137&&bytes[1]===80){
        const image=bytes[0]===137?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);
        const page=pdf.addPage(A4) as PdfPage & {drawImage:(image:unknown,opts:Record<string,number>)=>void};
        const scale=Math.min((A4[0]-48)/image.width,(A4[1]-48)/image.height);
        const w=image.width*scale,h=image.height*scale;
        page.drawImage(image,{x:(A4[0]-w)/2,y:(A4[1]-h)/2,width:w,height:h});
      }else throw new Error("UNSUPPORTED_FILE");
    }catch(e){throw new Error(`ไม่สามารถรวมไฟล์ ${doc.file_name}: ${e instanceof Error?e.message:"เกิดข้อผิดพลาด"}`);}
  }
  onProgress?.("กำลังสร้างไฟล์ PDF…");
  const output=await pdf.save();
  const blob=new Blob([output as BlobPart],{type:"application/pdf"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=safeFilename(`เอกสารผู้สมัคร_${fullname}_${a.application_number||"ยังไม่มีเลข"}`)+".pdf";
  link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}
