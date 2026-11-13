import { Field } from "./UI";
import { militaryStatusIssue } from "../validation/forms";

const CHOICES = ["ผ่านการเกณฑ์ทหาร", "ได้รับการยกเว้น"] as const;

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
      <p className="military-status-help">ผู้สมัครชายต้องผ่านการเกณฑ์ทหารแล้ว หรือได้รับการยกเว้นตามกฎหมาย โดยต้องเป็นไปตามคุณสมบัติในประกาศรับสมัครของมหาวิทยาลัย</p>
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
          <span>กรณีอื่นตามประกาศ (ต้องเป็นผู้ผ่านเกณฑ์หรือได้รับยกเว้น กรุณาระบุ)</span>
        </label>
      </div>
      {custom && (
        <Field label="รายละเอียดสถานะการเกณฑ์ทหาร (บังคับ)" required maxLength={190}
          value={details} onChange={e=>onChange("อื่น ๆ: " + e.target.value)}
          placeholder="ระบุหลักฐานการผ่านเกณฑ์หรือการได้รับยกเว้นตามประกาศ" />
      )}
      {militaryStatusIssue("ชาย",value) && (
        <p className="military-status-error" role="alert">{militaryStatusIssue("ชาย",value)}</p>
      )}
    </fieldset>
  );
}
