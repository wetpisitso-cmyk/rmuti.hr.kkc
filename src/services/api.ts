import { supabase, publishableKey, supabaseUrl } from "../lib/supabase";
import type {
  Application,
  AppDocument,
  Education,
  Experience,
  Job,
  Personal,
  Filters,
  StaffRow,
} from "../types/models";
export async function rows<T = any>(
  table: string,
  columns = "*",
  order = "created_at",
  limit = 100,
) {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .order(order, { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as T[];
}
export async function rpc<T = any>(
  fn: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}
export async function getJobs() {
  return rows<Job>(
    "job_positions",
    "*,departments(*),recruitment_rounds(*)",
    "title",
    1000,
  );
}
export async function getApplication(id: string) {
  const { data, error } = await supabase
    .from("applications")
    .select("*,job_positions(*,departments(*),recruitment_rounds(*))")
    .eq("id", id)
    .single();
  if (error) throw error;
  const detail = async (table: string) => {
    const r = await supabase.from(table).select("*").eq("application_id", id);
    if (r.error) throw r.error;
    return r.data;
  };
  const results = await Promise.all([
    detail("application_education"),
    detail("application_experience"),
    detail("application_documents"),
    detail("payment_records"),
    detail("application_status_history"),
    detail("exam_assignments"),
    detail("selection_results"),
  ]);
  return {
    application: data as Application,
    education: results[0] as Education[],
    experience: results[1] as Experience[],
    documents: results[2] as AppDocument[],
    payments: results[3],
    history: results[4],
    assignments: results[5],
    results: results[6],
  };
}
export const saveDraft = (
  id: string | null,
  job: string,
  personal: Personal,
  education: Education[],
  experience: Experience[],
) =>
  rpc<string>("save_application", {
    p_id: id,
    p_job: job,
    p_personal: personal,
    p_education: education,
    p_experience: experience,
  });
export const staffList = (
  filters: Partial<Filters>,
  page = 0,
  size = 20,
  sort = "created",
) =>
  rpc<{ rows: StaffRow[]; count: number }>("staff_list", {
    p_filters: filters,
    p_page: page,
    p_size: size,
    p_sort: sort,
  });
export async function signedFile(path: string) {
  // A private Drive document can only be read by a logged-in applicant
  // who owns it or an authorized staff member (verified via RLS on server).
  const driveDocument = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/gdrive\/[A-Za-z0-9_-]{10,200}\.(pdf|jpg|png)$/i.test(path);
  const verifiedLegacy = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/i.test(path);
  if (driveDocument || verifiedLegacy) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("UNAUTHORIZED");
    const response = await fetch(`${supabaseUrl}/functions/v1/read-drive-document`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
      cache: "no-store",
    });
    if (!response.ok) {
      const reason = await response.json().catch(() => ({}));
      throw new Error(reason.error || "FILE_DOWNLOAD_FAILED");
    }
    const url = URL.createObjectURL(await response.blob());
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    return url;
  }
  // B2 files are private. Download through an authenticated RLS-checked Edge
  // Function; never expose B2 credentials or unauthenticated object URLs.
  if (/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/b2\/[0-9a-f-]{36}\.(pdf|jpg|png)$/i.test(path)) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("UNAUTHORIZED");
    const response = await fetch(`${supabaseUrl}/functions/v1/read-b2-document`,{
      method:"POST",
      headers: {
        Authorization:`Bearer ${session.access_token}`,
        apikey:publishableKey,
        "Content-Type":"application/json",
      },
      body:JSON.stringify({path}),
      cache:"no-store",
    });
    if (!response.ok) {
      const reason = await response.json().catch(() => ({}));
      throw new Error(reason.error || "FILE_DOWNLOAD_FAILED");
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    // Give document previews time to start loading, then reclaim browser memory.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
    return objectUrl;
  }
  const { data, error } = await supabase.storage
    .from("application-files")
    .createSignedUrl(path, 120);
  if (error) throw error;
  return data.signedUrl;
}
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 1048576) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, file.type, 0.86),
  );
  return blob && blob.size < file.size
    ? new File([blob], file.name, { type: blob.type })
    : file;
}
export async function uploadDocument(
  id: string,
  type: string,
  file: File,
  onProgress: (n: number) => void,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  const body = new FormData();
  body.set("application_id", id);
  body.set("document_type", type);
  const optimized = await compressImage(file);
  if (optimized.size > 3 * 1048576) throw new Error("FILE_TOO_LARGE");
  body.set("file", optimized);
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${supabaseUrl}/functions/v1/upload-document`);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", publishableKey);
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error("UPLOAD_FAILED"));
    xhr.ontimeout = xhr.onerror;
    xhr.onload = () => {
      let r;
      try {
        r = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("UPLOAD_FAILED"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(r.error || "UPLOAD_FAILED"));
    };
    xhr.send(body);
  });
}
