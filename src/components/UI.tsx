import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import {
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  FileSearch,
} from "lucide-react";
import { errorTH } from "../lib/errors";
import { statuses, paymentLabels, type AppStatus } from "../types/models";
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="field">
      <span>
        {label}
        {props.required && <b className="text-orange-500"> *</b>}
      </span>
      <input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}
export function Textarea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={4} {...props} />
    </label>
  );
}
export function Notice({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: "info" | "error" | "success";
}) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`notice ${kind}`}
    >
      {kind === "error" ? (
        <AlertCircle size={19} />
      ) : kind === "success" ? (
        <CheckCircle2 size={19} />
      ) : (
        <AlertCircle size={19} />
      )}
      <span>{children}</span>
    </div>
  );
}
export function State({
  loading,
  error,
  empty,
  children,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div className="state">
        <LoaderCircle className="animate-spin" />
        กำลังโหลดข้อมูล…
      </div>
    );
  if (error) return <Notice kind="error">{errorTH(error)}</Notice>;
  if (empty)
    return (
      <div className="state">
        <FileSearch size={40} />
        <strong>ยังไม่มีข้อมูล</strong>
        <span>เมื่อมีรายการใหม่ ข้อมูลจะแสดงที่นี่</span>
      </div>
    );
  return <>{children}</>;
}
export function Badge({
  status,
  payment = false,
}: {
  status: string;
  payment?: boolean;
}) {
  return (
    <span className={`badge ${status}`}>
      {payment
        ? paymentLabels[status] || status
        : statuses[status as AppStatus] || status}
    </span>
  );
}
export function Title({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Submit({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button type="submit" className="btn primary" disabled={busy}>
      {busy && <LoaderCircle size={18} className="animate-spin" />}
      {busy ? "กำลังบันทึก…" : children}
    </button>
  );
}
