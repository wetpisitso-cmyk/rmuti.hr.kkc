import { supabase, supabaseUrl } from "./supabase";
const BUCKET = "announcement-banners";
export const bannerUrl = (path?: string | null) =>
  path && /^banners\/[a-f0-9-]{36}\.webp$/.test(path)
    ? `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}` : "";

export async function uploadBanner(original: File): Promise<string> {
  if (!["image/jpeg","image/png","image/webp"].includes(original.type))
    throw new Error("กรุณาเลือกรูป JPG PNG หรือ WebP");
  if (original.size > 12 * 1048576) throw new Error("กรุณาเลือกรูปไม่เกิน 12 MB");
  const bitmap = await createImageBitmap(original);
  let blob: Blob | null = null;
  try {
    const scale = Math.min(1,1200/bitmap.width,675/bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext("2d");
    if(!ctx) throw new Error("ไม่สามารถแปลงรูปบนอุปกรณ์นี้");
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for(const quality of [0.8,0.65,0.5]){
      blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",quality));
      if(blob?.type==="image/webp" && blob.size<=512*1024) break;
    }
  }finally{bitmap.close();}
  if(!blob||blob.type!=="image/webp"||blob.size>512*1024)
    throw new Error("ไม่สามารถบีบอัดรูปให้ต่ำกว่า 500 KB");
  const path=`banners/${crypto.randomUUID()}.webp`;
  const {error}=await supabase.storage.from(BUCKET).upload(path,blob,{contentType:"image/webp",upsert:false});
  if(error)throw error;
  return path;
}
export async function setBanner(id:string,path:string){
  const {data,error}=await supabase.from("announcements").update({banner_path:path}).eq("id",id).select("id").single();
  if(error)throw error;
  if(!data)throw new Error("ไม่สามารถบันทึกรูปประกาศ");
}
export async function deleteBanner(path:string){
  if(!bannerUrl(path))return;
  const {error}=await supabase.storage.from(BUCKET).remove([path]);
  if(error)throw error;
}
