import { Field } from "./UI";
import { militaryStatusIssue } from "../validation/forms";

const CHOICES = ["ผ่านการเกณฑ์ทหาร", "ได้รับการยกเว้น", "อยู่ระหว่างดำเนินการ"] as const;

export function MilitaryStatusQuestion({ value, onChange }: {
  value: string;
  onChange: (next: string) => void;
}) {
  const status = value.trim();
  const custom = !!status && !CHOICES.some(choice => choice === status);
  const details = status.startsWith("อื่น ๆ:") ? status.slice("อื่น ๆ:".length).trimStart() : custom ? status : "";
  return (
    <fieldset className="military-status-applicant-field col-span-full">
      <legend>สถานะการเกณฑ์ทหาร <span className="military-required">*</span></legend>
      <p className="military-status-help">เฉพาะผู้สมัครชาย กรุณาเลือกให้ตรงกับเอกสารและประกาศของมหาวิทยาลัย</p>
      <div className="military-status-choices">
        {CHOICES.map(choice => (
          <label className="military-status-choice" key={choice}>
            <input type="radio" name="military_status_choice" checked={status === choice}
              onChange={() => onChange(choice)} />
            <span>{choice}</span>
          </label>
        ))}
        <label className="military-status-choice">
          <input type="radio" name="military_status_choice" checked={custom}
            onChange={() => onChange("อื่น ๆ: ")} />
          <span>อื่น ๆ ตามประกาศ (ระบุรายละเอียด)</span>
        </label>
      </div>
      {custom && (
        <Field label="รายละเอียดสถานะการเกณฑ์ทหาร (บังคับ)" required maxLength={190}
          value={details} onChange={e=>onChange("อื่น ๆ: " + e.target.value)}
          placeholder="เช่น ผ่อนผันตามประกาศ" />
      )}
      {militaryStatusIssue("ชาย",value) && (
        <p className="military-status-error" role="alert">{militaryStatusIssue("ชาย",value)}</p>
      )}
    </fieldset>
  );
}
