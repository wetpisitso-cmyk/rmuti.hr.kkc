import type { Personal } from "../types/models";
import { dateTH } from "../lib/format";

type Props = {
  person: Personal;
  email?: string;
};

/**
 * Applicant identity summary for authorized staff reviewers.
 * Submitted applications pass the saved snapshot here, matching the PDF.
 * Older applications can lack fields introduced after their submission.
 */
export function AdminApplicantDetails({ person, email }: Props) {
  const text = (value?: string | null) => value?.trim() || "—";
  const fullName = [person.prefix, person.first_name, person.last_name]
    .filter(Boolean).join(" ");
  const items = [
    { label: "ชื่อ–นามสกุล", value: fullName },
    { label: "ชื่อ–นามสกุลภาษาอังกฤษ", value: text(person.english_name), requiredNew: true },
    { label: "เพศ", value: text(person.gender), requiredNew: true },
    { label: "วันเดือนปีเกิด (พ.ศ.)", value: person.birth_date ? dateTH(person.birth_date) : "—" },
    { label: "สัญชาติ", value: text(person.nationality), requiredNew: true },
    { label: "เชื้อชาติ", value: text(person.ethnicity) },
    { label: "ศาสนา", value: text(person.religion) },
    { label: "เลขประจำตัวประชาชน", value: text(person.national_id) },
    { label: "สถานภาพ", value: text(person.marital_status), requiredNew: true },
    { label: "โทรศัพท์", value: text(person.phone) },
    { label: "อีเมล", value: text(email) },
    { label: "LINE ID", value: text(person.line_id) },
    { label: "ที่อยู่ตามทะเบียนบ้าน", value: text(person.registered_address), requiredNew: true, wide: true },
    { label: "ที่อยู่ปัจจุบัน", value: text(person.address), wide: true },
    { label: "สถานะการเกณฑ์ทหาร (ถ้ามี)", value: text(person.military_status), wide: true },
    { label: "ความรู้ความสามารถพิเศษ", value: text(person.skills), wide: true },
  ];
  const missing = items.filter(item => item.requiredNew && item.value === "—");

  return (
    <section className="review-applicant-details" aria-label="รายละเอียดข้อมูลส่วนบุคคลในใบสมัคร">
      <h3>ข้อมูลส่วนบุคคลที่ผู้สมัครกรอก</h3>
      {missing.length > 0 && (
        <p className="review-applicant-missing" role="status">
          ไม่พบข้อมูลบางช่องในใบสมัครนี้: {missing.map(item => item.label).join(" • ")}
          {" "}หากเป็นใบสมัครเดิมที่ส่งก่อนปรับระบบ ให้เจ้าหน้าที่ตรวจสอบกับผู้สมัครก่อนรับรองข้อมูล
        </p>
      )}
      <dl className="review-applicant-detail-grid">
        {items.map(item => (
          <div
            key={item.label}
            className={`review-applicant-detail ${item.wide ? "review-applicant-detail-wide" : ""}`}
          >
            <dt>{item.label}</dt>
            <dd className={item.value === "—" && item.requiredNew ? "review-applicant-empty" : ""}>
              {item.value === "—" && item.requiredNew ? "ไม่ได้ระบุในใบสมัครเดิม" : item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
