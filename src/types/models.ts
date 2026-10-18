export type Role = "applicant" | "hr" | "admin";
export type AppStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "needs_correction"
  | "eligible"
  | "ineligible"
  | "withdrawn";
export const statuses: Record<AppStatus, string> = {
  draft: "แบบร่าง",
  submitted: "ส่งใบสมัครแล้ว",
  under_review: "กำลังตรวจสอบ",
  needs_correction: "ต้องแก้ไข",
  eligible: "ผ่านคุณสมบัติ",
  ineligible: "ไม่ผ่านคุณสมบัติ",
  withdrawn: "ถอนใบสมัคร",
};
export const paymentLabels: Record<string, string> = {
  not_required: "ไม่ต้องชำระ",
  awaiting_payment: "รอชำระ",
  pending: "รอตรวจสลิป",
  confirmed: "ยืนยันแล้ว",
  rejected: "ต้องแก้ไขสลิป",
};
export const outcomeLabels: Record<string, string> = {
  selected: "ได้รับคัดเลือก",
  reserve: "สำรอง",
  not_selected: "ไม่ได้รับคัดเลือก",
  eligible: "มีสิทธิสอบ",
  ineligible: "ไม่มีสิทธิสอบ",
};
export interface Profile {
  id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  phone: string;
  consent_version: string;
}
export interface Department {
  id: string;
  name: string;
  archived: boolean;
}
export interface Round {
  id: string;
  name: string;
  year_be: number;
  opens_at: string;
  closes_at: string;
  max_per_user: number;
  published: boolean;
  archived: boolean;
}
export interface DocRequirement {
  key: string;
  label: string;
  required: boolean;
}
export interface Job {
  id: string;
  round_id: string;
  department_id: string;
  title: string;
  category: "academic" | "support";
  employment_type: string;
  vacancies: number;
  qualifications: string;
  required_documents: DocRequirement[];
  require_national_id: boolean;
  fee_amount: number;
  payment_instructions: string;
  announcement_url: string;
  max_file_mb: number;
  published: boolean;
  archived: boolean;
  recruitment_rounds: Round;
  departments: Department;
}
export interface Personal {
  prefix: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  phone: string;
  address: string;
  national_id?: string;
}
export interface Education {
  degree: string;
  major: string;
  institution: string;
  graduation_year: number | string;
  gpa: number | string;
}
export interface Experience {
  employer: string;
  position: string;
  details: string;
  start_date: string;
  end_date: string;
}
export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  status: AppStatus;
  personal_data: Personal;
  snapshot: {
    personal: Personal;
    email: string;
    job: Job;
    round: Round;
    education: Education[];
    experience: Experience[];
    documents: AppDocument[];
  } | null;
  application_number: string | null;
  payment_status: string;
  public_message: string;
  correction_deadline: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  archived_at: string | null;
  job_positions: Job;
}
export interface AppDocument {
  id: string;
  application_id: string;
  document_type: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}
export interface Announcement {
  id: string;
  title: string;
  content: string;
  attachment_url: string;
  banner_path: string;
  created_at: string;
  published: boolean;
}
export interface PublishedResult {
  id: string;
  title: string;
  kind: string;
  published_at: string;
  rows: { number: string; name: string; outcome: string }[];
}
export interface Filters {
  year: string;
  round: string;
  job: string;
  department: string;
  status: string;
  from: string;
  to: string;
  search: string;
}
export interface StaffRow {
  id: string;
  status: AppStatus;
  payment_status: string;
  application_number: string | null;
  personal_data: Personal;
  created_at: string;
  submitted_at: string | null;
  job_title: string;
  department_name: string;
  round_name: string;
  year_be: number;
}
