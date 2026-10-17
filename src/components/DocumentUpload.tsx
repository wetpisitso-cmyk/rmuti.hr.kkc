import { useState } from "react";
import { Upload, ExternalLink, RotateCw, PenLine, AlertTriangle, FileCheck2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { signedFile, uploadDocument } from "../services/api";
import { errorTH } from "../lib/errors";
import type { AppDocument, DocRequirement } from "../types/models";
export function PreviewButton({
  path,
  label = "ดูเอกสาร",
}: {
  path: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const preview = async () => {
    setBusy(true);
    setError("");
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const url = await signedFile(path);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      tab?.close();
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className="btn small outline"
        onClick={preview}
        disabled={busy}
      >
        <ExternalLink size={15} />
        {busy ? "กำลังเปิด…" : label}
      </button>
      {error && <small className="error-text">{error}</small>}
    </>
  );
}
/** Applicant-facing reminder; this does not alter or sign uploaded files. */
export function CopyCertificationNotice() {
  return (
    <aside className="copy-cert-banner" aria-label="คำแนะนำการเซ็นสำเนาถูกต้อง">
      <span className="copy-cert-icon" aria-hidden="true"><PenLine size={30} strokeWidth={2.4} /></span>
      <div className="copy-cert-content">
        <div className="copy-cert-kicker"><AlertTriangle size={18} /> กรุณาอ่านก่อนแนบเอกสาร</div>
        <strong className="copy-cert-title">เซ็นสำเนาถูกต้อง <span>ทุกฉบับ</span></strong>
        <p>เอกสารที่เป็นสำเนา ให้เขียนคำว่า <b>“สำเนาถูกต้อง”</b> พร้อมลงลายมือชื่อรับรอง
          บนเอกสารก่อนถ่ายภาพหรือสแกนอัปโหลด <span>ยกเว้นรูปถ่ายและสลิปชำระเงิน</span>
        </p>
      </div>
      <div className="copy-cert-stamp" aria-hidden="true">
        <FileCheck2 size={25} />
        <b>สำเนาถูกต้อง</b>
        <small>กรุณาลงลายมือชื่อ</small>
      </div>
    </aside>
  );
}
export function DocumentUpload({
  id,
  requirement,
  document,
  maxMb,
  disabled = false,
}: {
  id: string;
  requirement: DocRequirement;
  document?: AppDocument;
  maxMb: number;
  disabled?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState("");
  const qc = useQueryClient();
  const uploadLimitMb = Math.min(maxMb, 3);
  const upload = async (f: File) => {
    setFile(f);
    setError("");
    if (f.size > uploadLimitMb * 1048576) {
      setError(`ไฟล์ต้องไม่เกิน ${uploadLimitMb} MB`);
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      await uploadDocument(id, requirement.key, f, setProgress);
      await qc.invalidateQueries({ queryKey: ["application", id] });
      setFile(null);
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`upload-card ${document ? "complete" : ""}`}>
      <div className="upload-icon">
        <Upload size={22} />
      </div>
      <div className="flex-1">
        <strong>
          {requirement.label}
          {requirement.required && <b className="text-orange-500"> *</b>}
        </strong>
        <small>
          {document
            ? document.file_name
            : `${requirement.key === "photo" ? "JPG / PNG" : "PDF / JPG / PNG"} ไม่เกิน ${maxMb} MB`}
        </small>
        {requirement.key !== "photo" && requirement.key !== "payment" && (
          <small className="copy-cert-inline">✍ เซ็นสำเนาถูกต้องก่อนอัปโหลด</small>
        )}
        {busy && (
          <div className="upload-progress">
            <progress max="100" value={progress} />
            <span>{progress === 100 ? "กำลังตรวจไฟล์…" : `${progress}%`}</span>
          </div>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </div>
      <div className="upload-actions">
        {document && <PreviewButton path={document.storage_path} />}
        <label
          className={`btn small ${busy || disabled ? "disabled" : "outline"}`}
        >
          {document ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}
          <input
            className="sr-only"
            type="file"
            accept={
              requirement.key === "photo"
                ? "image/jpeg,image/png"
                : "application/pdf,image/jpeg,image/png"
            }
            disabled={busy || disabled}
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>
        {error && file && !disabled && (
          <button
            type="button"
            className="btn small outline"
            onClick={() => upload(file)}
            disabled={busy}
          >
            <RotateCw size={15} /> ลองใหม่
          </button>
        )}
      </div>
    </div>
  );
}
