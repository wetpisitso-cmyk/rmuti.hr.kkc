import type { Application, AppDocument } from "../types/models";
import { dateTH } from "../lib/format";
import type { AdminSignature } from "./AdminSignaturePad";

type Submission = NonNullable<Application["snapshot"]>;
type Props = {
  application: Application;
  snapshot: Submission;
  documents: AppDocument[];
  photo: string;
  signature: AdminSignature | null;
};

const dash = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  const str = String(value).trim();
  return str || "—";
};
function optional(personal: Submission["personal"], ...names: string[]) {
  const values = personal as unknown as Record<string, unknown>;
  for (const name of names) {
    if (values[name] != null && String(values[name]).trim()) return dash(values[name]);
  }
  return "—";
}
function Row({ label, value }: { label: string; value: unknown }) {
  return <tr><th scope="row">{label}</th><td>{dash(value)}</td></tr>;
}

export default function ApplicantSubmissionForm({
  application, snapshot, documents, photo, signature,
}: Props) {
  const person = snapshot.personal;
  const fullName = [person.prefix, person.first_name, person.last_name]
    .filter(Boolean).join(" ");
  const education = snapshot.education || [];
  const experience = snapshot.experience || [];
  const requirements = snapshot.job.required_documents || [];
  const uploaded = new Set(documents.map((doc) => doc.document_type));
  const extraDocs = documents
    .filter(doc => doc.document_type !== "photo" && doc.document_type !== "payment")
    .filter(doc => !requirements.some(r => r.key === doc.document_type));
  const number = application.application_number;
  const reviewStatus = application.status === "eligible" ? "ผ่านการตรวจคุณสมบัติ"
    : application.status === "ineligible" ? "ไม่ผ่านคุณสมบัติ"
    : application.status === "needs_correction" ? "รอแก้ไขเอกสาร"
    : application.status === "under_review" ? "อยู่ระหว่างตรวจสอบ"
    : "รอการตรวจสอบของเจ้าหน้าที่";

  return (
    <article className="print-sheet official-application">
      <div className="official-heading">
        <div className="official-title">
          <h1>ใบสมัครเข้ารับการสอบคัดเลือกเป็นบุคลากร</h1>
          <h2>มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น</h2>
          <p>ตำแหน่ง {snapshot.job.title}</p>
          <p>{snapshot.job.departments?.name || "หน่วยงานตามประกาศรับสมัคร"}</p>
        </div>
        <div className="official-photo-slot">
          {photo ? <img src={photo} alt="รูปถ่ายผู้สมัคร" /> :
            <span>ติดรูปถ่าย<br />ขนาดตามประกาศ</span>}
        </div>
      </div>
      <div className="official-reference">
        <p><strong>เลขผู้สมัคร:</strong> {number || "รอ Admin กำหนดเลขผู้สมัคร"}</p>
        <p><strong>รอบรับสมัคร:</strong> {snapshot.round.name} (พ.ศ. {snapshot.round.year_be})</p>
        <p><strong>สถานะใบสมัคร:</strong> {reviewStatus}</p>
      </div>

      <p className="official-intro"><strong>เรียน รองอธิการบดีประจำวิทยาเขตขอนแก่น</strong></p>
      <p className="official-intro">
        ข้าพเจ้า <strong>{fullName}</strong> มีความประสงค์สมัครเข้ารับการสอบคัดเลือกในตำแหน่ง
        {" "}<strong>{snapshot.job.title}</strong> และขอแสดงรายละเอียดประกอบการพิจารณาดังต่อไปนี้
      </p>

      <section className="official-section">
        <h3>1. ข้อมูลส่วนบุคคล</h3>
        <table className="official-table official-info-table"><tbody>
          <Row label="ชื่อ–นามสกุล" value={fullName}/>
          <Row label="ชื่อภาษาอังกฤษ" value={optional(person,"english_name","name_en")} />
          <Row label="เพศ" value={optional(person,"gender","sex")} />
          <Row label="วันเดือนปีเกิด (พ.ศ.)" value={dateTH(person.birth_date)} />
          <Row label="สัญชาติ / เชื้อชาติ" value={optional(person,"nationality") + " / " + optional(person,"ethnicity","race")} />
          <Row label="ศาสนา" value={optional(person,"religion")} />
          <Row label="เลขประจำตัวประชาชน" value={person.national_id} />
          <Row label="สถานภาพ" value={optional(person,"marital_status")} />
          <Row label="โทรศัพท์" value={person.phone} />
          <Row label="อีเมล" value={snapshot.email} />
          <Row label="LINE ID" value={optional(person,"line_id","lineId")} />
          <Row label="ที่อยู่ตามทะเบียนบ้าน" value={optional(person,"registered_address")} />
          <Row label="ที่อยู่ปัจจุบัน" value={person.address} />
          <Row label="สถานะการเกณฑ์ทหาร (ถ้ามี)" value={optional(person,"military_status")} />
        </tbody></table>
      </section>

      <section className="official-section">
        <h3>2. ประวัติการศึกษา</h3>
        <table className="official-table"><thead><tr>
          <th>คุณวุฒิที่ได้รับ</th><th>สาขา / วิชาเอก</th><th>ชื่อสถานศึกษา</th><th>ปี พ.ศ.</th><th>GPA</th>
        </tr></thead><tbody>
          {education.length ? education.map((item,index) => <tr key={index}>
            <td>{dash(item.degree)}</td><td>{dash(item.major)}</td><td>{dash(item.institution)}</td>
            <td>{dash(item.graduation_year)}</td><td>{dash(item.gpa)}</td>
          </tr>) : <tr><td colSpan={5}>ไม่ได้ระบุข้อมูลการศึกษา</td></tr>}
        </tbody></table>
      </section>

      <section className="official-section">
        <h3>3. ประวัติการทำงาน / การฝึกงาน</h3>
        <table className="official-table official-work-table"><thead><tr>
          <th>สถานที่ทำงาน / สถานที่ฝึกงาน</th>
          <th>ตำแหน่ง / ลักษณะงาน</th>
          <th>เริ่มงาน (พ.ศ.)</th><th>สิ้นสุด (พ.ศ.)</th>
        </tr></thead><tbody>
          {experience.length ? experience.map((item,index) => <tr key={index}>
            <td>{dash(item.employer)}</td>
            <td><strong>{dash(item.position)}</strong>{item.details &&
              <div className="official-details">{item.details}</div>}</td>
            <td>{dateTH(item.start_date)}</td>
            <td>{item.end_date ? dateTH(item.end_date) : "ปัจจุบัน"}</td>
          </tr>) : <tr><td colSpan={4}>ไม่ได้ระบุข้อมูลประสบการณ์</td></tr>}
        </tbody></table>
      </section>

      <section className="official-section">
        <h3>4. ความรู้ความสามารถพิเศษ</h3>
        <p className="official-details">
          {optional(person,"skills","special_skills","abilities") === "—"
            ? "ไม่ปรากฏข้อมูลในแบบฟอร์มสมัครงาน"
            : optional(person,"skills","special_skills","abilities")}
        </p>
      </section>

      <section className="official-section official-documents">
        <h3>5. เอกสารและหลักฐานที่ใช้ยื่นพร้อมใบสมัคร</h3>
        <p className="official-small">เครื่องหมาย ☑ แสดงว่ามีการอัปโหลดไฟล์เข้าระบบ ไม่ใช่ผลรับรองความถูกต้องของเอกสาร</p>
        <ul>
          {requirements.map(item => <li key={item.key}>
            <span className="official-check">{uploaded.has(item.key) ? "☑" : "☐"}</span>
            <span>{item.label}{!item.required && " (ถ้ามี)"}</span>
          </li>)}
          {extraDocs.map(item => <li key={item.id}>
            <span className="official-check">☑</span><span>เอกสารเพิ่มเติม: {item.file_name}</span>
          </li>)}
          {documents.some(doc => doc.document_type === "payment") && (
            <li><span className="official-check">☑</span><span>หลักฐานการชำระค่าธรรมเนียม (อัปโหลดแล้ว; โปรดตรวจสถานะชำระเงิน)</span></li>
          )}
          {!requirements.length && !extraDocs.length && !documents.some(doc => doc.document_type === "payment") && (
            <li>ไม่พบรายการเอกสารในรอบรับสมัครนี้</li>
          )}
        </ul>
        <p><strong>ผลตรวจเอกสาร:</strong> {reviewStatus}</p>
        <div className="official-signatures">
          <div>
            <h4>สำหรับผู้สมัคร</h4>
            <p className="official-signature-line">(ลงชื่อ) ...................................................</p>
            <p>({fullName})</p><p>วันที่ ........../........../............</p>
          </div>
          <div>
            <h4>สำหรับเจ้าหน้าที่รับสมัคร</h4>
            <p><strong>ผู้ตรวจรับรอง: {signature?.signer_name || "รอผู้ตรวจลงนาม"}</strong></p>
            {signature && signature.application_number_at_signing === application.application_number ? <>
              <img className="official-admin-signed-image" src={signature.signature_png} alt="ลายเซ็น Admin ผู้ตรวจรับรองใบสมัคร"/>
              <p>({signature.signer_name}) เจ้าหน้าที่รับสมัคร</p>
              <p>วันที่ลงนาม {dateTH(signature.signed_at, true)}</p>
            </> : <>
              <p className="official-signature-line">(ลงชื่อ) ...................................................</p>
              <p>เจ้าหน้าที่รับสมัคร — ยังไม่ลงนาม</p>
              <p>วันที่ ........../........../............</p>
            </>}
          </div>
        </div>
      </section>

      <section className="official-section official-declaration">
        <h3>คำรับรองของผู้สมัคร</h3>
        <p>
          ข้าพเจ้าขอรับรองว่าข้อมูลที่ระบุและเอกสารที่ส่งผ่านระบบเป็นความจริง
          หากตรวจพบภายหลังว่าไม่ถูกต้อง ข้าพเจ้ายินยอมให้มหาวิทยาลัยดำเนินการ
          ตามประกาศและระเบียบที่เกี่ยวข้อง
        </p>
        <p><strong>ส่งใบสมัครผ่านระบบเมื่อ:</strong> {dateTH(application.submitted_at, true)}</p>
        {!number && <p className="official-pending">เอกสารสำหรับนำมายื่น — อยู่ระหว่างรอแอดมินกำหนดเลขผู้สมัคร</p>}
      </section>

      <footer className="official-footer">
        แผนกงานบริหารงานบุคคล • มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น
        <div>เอกสารสร้างจากข้อมูลใบสมัครของผู้สมัคร • กรุณาตรวจสอบความถูกต้องก่อนลงนามและนำมายื่น</div>
      </footer>
    </article>
  );
}
