import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Save, Trash2 } from "lucide-react";
import { rows, rpc } from "../../services/api";
import { useCatalog } from "../../hooks/useCatalog";
import { bangkokInput, bangkokISO, dateTH, safeUrl } from "../../lib/format";
import { errorTH } from "../../lib/errors";
import {
  Field,
  Select,
  Textarea,
  Title,
  Notice,
  State,
  Submit,
} from "../../components/UI";
import type { DocRequirement } from "../../types/models";
import { ThaiDateField } from "../../components/ThaiDateField";
import { useAuth } from "../../hooks/useAuth";
type Table =
  | "departments"
  | "recruitment_rounds"
  | "job_positions"
  | "announcements"
  | "exam_schedules";
type FormField = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: [string, string][];
  min?: number;
  max?: number;
};
const title: Record<Table, string> = {
  departments: "หน่วยงาน",
  recruitment_rounds: "รอบรับสมัคร",
  job_positions: "ตำแหน่งรับสมัคร",
  announcements: "ข่าวและประกาศ",
  exam_schedules: "กำหนดการสอบ",
};
const documentOptions: [string,string][] = [
  ["degree","หนังสือรับรองคุณวุฒิ / ปริญญาบัตร"],
  ["transcript","ใบรายงานผลการศึกษา (Transcript)"],
  ["photo","รูปถ่ายหน้าตรง 3 × 4 ซม."],
  ["house_registration","สำเนาทะเบียนบ้าน"],
  ["id_card","สำเนาบัตรประจำตัวประชาชน"],
  ["military","สด.8 / สด.43 / เอกสารเกี่ยวกับการเป็นทหาร (ถ้ามี)"],
  ["name_change","หลักฐานสมรส / เปลี่ยนชื่อ-สกุล (ถ้ามี)"],
  ["other","เอกสารอื่น ๆ"],
  ["certificates","ใบรับรองกิจกรรม / ใบรับรองประสบการณ์ (ถ้ามี)"],
  ["experience","หลักฐานประสบการณ์"],
];
const defaultDocs: DocRequirement[] = documentOptions.slice(0,9).map(([key,label],i)=>({
  key,label,required:i<=4,
}));
export default function Catalog({ table }: { table: Table }) {
  const auth = useAuth();
  const qc = useQueryClient(),
    catalog = useCatalog();
  const q = useQuery({
    queryKey: ["catalog", table],
    queryFn: () => rows(table, "*", "id", 1000),
  });
  const [data, setData] = useState<Record<string, any>>({}),
    [editing, setEditing] = useState(false),
    [docs, setDocs] = useState<DocRequirement[]>(defaultDocs),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState<string | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const defaults = {
    year_be: new Date().getFullYear() + 543,
    max_per_user: 1,
    vacancies: 1,
    category: "support",
    fee_amount: 0,
    max_file_mb: 10,
    published: false,
    archived: false,
    require_national_id: false,
  };
  const fields: Record<Table, FormField[]> = {
    departments: [
      { key: "name", label: "ชื่อหน่วยงาน", required: true },
      { key: "archived", label: "เก็บถาวร", type: "checkbox" },
    ],
    recruitment_rounds: [
      { key: "name", label: "ชื่อรอบรับสมัคร", required: true },
      {
        key: "year_be",
        label: "ปี พ.ศ.",
        type: "number",
        min: 2500,
        max: 2800,
        required: true,
      },
      {
        key: "opens_at",
        label: "วันเวลาเปิดรับ (พ.ศ. เวลาไทย)",
        type: "datetime-local",
        required: true,
      },
      {
        key: "closes_at",
        label: "วันเวลาปิดรับ (พ.ศ. เวลาไทย)",
        type: "datetime-local",
        required: true,
      },
      {
        key: "max_per_user",
        label: "จำนวนตำแหน่งสูงสุดต่อคนในรอบ",
        type: "number",
        min: 1,
        max: 20,
        required: true,
      },
      { key: "published", label: "เผยแพร่รอบรับสมัคร", type: "checkbox" },
      { key: "archived", label: "เก็บถาวร", type: "checkbox" },
    ],
    job_positions: [
      { key: "title", label: "ชื่อตำแหน่ง", required: true },
      {
        key: "round_id",
        label: "รอบรับสมัคร",
        required: true,
        options: catalog.rounds.data?.map((x) => [x.id, x.name]),
      },
      {
        key: "department_id",
        label: "หน่วยงาน",
        required: true,
        options: catalog.departments.data?.map((x) => [x.id, x.name]),
      },
      {
        key: "category",
        label: "สายงาน",
        options: [
          ["academic", "สายวิชาการ"],
          ["support", "สายสนับสนุน"],
        ],
      },
      { key: "employment_type", label: "ประเภทการจ้าง", required: true },
      {
        key: "vacancies",
        label: "จำนวนอัตรา",
        type: "number",
        min: 1,
        required: true,
      },
      {
        key: "qualifications",
        label: "คุณสมบัติ / วุฒิ / สาขา / เงื่อนไข",
        type: "textarea",
        required: true,
      },
      {
        key: "fee_amount",
        label: "ค่าธรรมเนียม (0 = ไม่เรียกเก็บ)",
        type: "number",
        min: 0,
        required: true,
      },
      {
        key: "payment_instructions",
        label: "วิธีชำระ / บัญชีรับชำระ / ลิงก์ QR",
        type: "textarea",
      },
      {
        key: "announcement_url",
        label: "ลิงก์ประกาศหรือเอกสารแนบ HTTPS",
        type: "url",
      },
      {
        key: "max_file_mb",
        label: "ขนาดไฟล์สูงสุดต่อไฟล์ (MB)",
        type: "number",
        min: 1,
        max: 10,
        required: true,
      },
      {
        key: "require_national_id",
        label: "ประกาศนี้จำเป็นต้องเก็บเลขบัตรประชาชน",
        type: "checkbox",
      },
      { key: "published", label: "เผยแพร่ตำแหน่ง", type: "checkbox" },
      { key: "archived", label: "เก็บถาวรตำแหน่ง", type: "checkbox" },
    ],
    announcements: [
      { key: "title", label: "หัวข้อประกาศ", required: true },
      {
        key: "content",
        label: "เนื้อหาประกาศ",
        type: "textarea",
        required: true,
      },
      { key: "attachment_url", label: "ลิงก์ไฟล์ประกาศ HTTPS", type: "url" },
      { key: "published", label: "เผยแพร่ประกาศ", type: "checkbox" },
    ],
    exam_schedules: [
      {
        key: "job_id",
        label: "ตำแหน่ง",
        required: true,
        options: catalog.jobs.data?.map((x) => [x.id, x.title]),
      },
      { key: "title", label: "ชื่อการสอบ", required: true },
      {
        key: "exam_at",
        label: "วันเวลาสอบ (พ.ศ. เวลาไทย)",
        type: "datetime-local",
        required: true,
      },
      { key: "venue", label: "สถานที่สอบ", required: true },
      {
        key: "instructions",
        label: "ข้อปฏิบัติ / เอกสารที่ต้องนำมา",
        type: "textarea",
      },
      {
        key: "published",
        label: "เผยแพร่กำหนดสอบและเปิดบัตรสอบ",
        type: "checkbox",
      },
    ],
  };
  const removeRecord = async (row: Record<string, any>) => {
    if (auth.role !== "admin") return;
    const titleToConfirm = String(row.title || row.name || "");
    const confirmed = window.prompt("ต้องการลบรายการนี้ถาวร\nพิมพ์ชื่อรายการเพื่อยืนยัน:\n" + titleToConfirm);
    if (confirmed === null) return;
    if (confirmed !== titleToConfirm) { setError("ชื่อรายการที่ยืนยันไม่ตรงกัน"); return; }
    if (!window.confirm(table === "job_positions" ? "ยืนยันลบถาวรทั้งตำแหน่งและใบสมัครทุกคน รวมถึงเอกสารและประวัติที่เกี่ยวข้อง?\\n\\nกู้คืนไม่ได้: " + titleToConfirm : "ยืนยันลบ " + titleToConfirm + " ถาวร?")) return;
    setDeleting(row.id);
    setError("");
    setSuccess("");
    try {
      if (table === "job_positions") {
        await rpc("admin_force_delete_job", { p_id: row.id, p_expected_title: titleToConfirm });
        // Database deletion is committed before file cleanup; failures remain in
        // durable queue for retry and do not restore already deleted records.
        const { error: cleanupError } = await (await import("../../lib/supabase")).supabase.functions.invoke("admin-cleanup-files", { body: {} });
        if (cleanupError) setSuccess("ลบตำแหน่งและใบสมัครถาวรแล้ว แต่การลบไฟล์แนบบางส่วนอาจยังอยู่ในคิว");
      } else {
        await rpc("admin_delete_record", { p_table: table, p_id: row.id, p_expected_title: titleToConfirm });
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["catalog", table] }),
        qc.invalidateQueries({ queryKey: ["jobs"] }),
        qc.invalidateQueries({ queryKey: ["rounds"] }),
        qc.invalidateQueries({ queryKey: ["departments"] }),
        qc.invalidateQueries({ queryKey: ["announcements"] }),
        qc.invalidateQueries({ queryKey: ["exam-schedules"] }),
        qc.invalidateQueries({ queryKey: ["published-results"] })
      ]);
      setEditing(false);
      setSuccess((prev) => prev || (table === "job_positions" ? "ลบตำแหน่งและใบสมัครที่เกี่ยวข้องทั้งหมดถาวรสำเร็จ" : "ลบรายการสำเร็จ"));
    } catch (e) {
      const msg = String((e as Error)?.message || "");
      if (msg.includes("DELETE_BLOCKED_HAS_APPLICATIONS"))
        setError("ตำแหน่งนี้มีผู้สมัครแล้ว จึงลบถาวรไม่ได้ กรุณาใช้ปุ่มเก็บถาวรแทน เพื่อรักษาข้อมูลผู้สมัคร");
      else setError(errorTH(e));
    }
    finally { setDeleting(null); }
  };
  const archivePosition = async (row: Record<string, any>) => {
    if (auth.role !== "admin" || table !== "job_positions") return;
    const name = String(row.title || "");
    if (!window.confirm("หยุดเผยแพร่และเก็บตำแหน่งนี้ถาวร?\\n" + name + "\\n\\nข้อมูลใบสมัครและเอกสารทั้งหมดจะยังอยู่")) return;
    setDeleting(row.id);
    setError("");
    setSuccess("");
    try {
      await rpc("admin_save", { p_table: "job_positions", p_data: { ...row, archived: true, published: false } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["catalog", table] }),
        qc.invalidateQueries({ queryKey: ["jobs"] }),
        qc.invalidateQueries({ queryKey: ["staff-list"] }),
        qc.invalidateQueries({ queryKey: ["staff-dashboard"] }),
      ]);
      setSuccess("เก็บถาวรและหยุดเผยแพร่ตำแหน่งสำเร็จ โดยคงข้อมูลผู้สมัครเดิมครบถ้วน");
    } catch (e) { setError(errorTH(e)); }
    finally { setDeleting(null); }
  };
  const start = (row?: Record<string, any>) => {
    const d = { ...defaults, ...row };
    for (const f of fields[table])
      if (f.type === "datetime-local" && d[f.key as keyof typeof d])
        d[f.key as keyof typeof d] = bangkokInput(
          String(d[f.key as keyof typeof d]),
        ) as never;
    setData(d);
    setDocs(row?.required_documents || defaultDocs);
    setEditing(true);
    setError("");
    setSuccess("");
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = { ...data };
      for (const f of fields[table]) {
        if (f.type === "datetime-local")
          payload[f.key] = bangkokISO(data[f.key]);
        if (f.type === "number") payload[f.key] = Number(data[f.key]);
        if (f.type === "url" && data[f.key] && !safeUrl(data[f.key]))
          throw new Error("กรุณาใช้ลิงก์ HTTPS ที่ถูกต้อง");
      }
      if (table === "job_positions") payload.required_documents = docs;
      await rpc("admin_save", { p_table: table, p_data: payload });
      await qc.invalidateQueries({ queryKey: ["catalog", table] });
      for (const key of [
        "jobs",
        "rounds",
        "departments",
        "announcements",
        "exam-schedules",
      ])
        await qc.invalidateQueries({ queryKey: [key] });
      setEditing(false);
      setSuccess("บันทึกข้อมูลสำเร็จ");
    } catch (e) {
      setError(
        (e as Error).message.startsWith("กรุณา")
          ? (e as Error).message
          : errorTH(e),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Title
        title={`จัดการ${title[table]}`}
        description="ใช้ข้อมูลตามประกาศจริง และเก็บถาวรเมื่อต้องการหยุดใช้งาน"
        action={
          <button className="btn primary" onClick={() => start()}>
            <Plus size={18} /> เพิ่ม{title[table]}
          </button>
        }
      />
      {error && <Notice kind="error">{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}
      {editing && (
        <form onSubmit={submit} className="panel stack">
          <h2>
            {data.id ? "แก้ไข" : "เพิ่ม"}
            {title[table]}
          </h2>
          <div className="form-grid">
            {fields[table].map((f) =>
              f.type === "checkbox" ? (
                <label className="checkbox" key={f.key}>
                  <input
                    type="checkbox"
                    checked={Boolean(data[f.key])}
                    onChange={(e) =>
                      setData({ ...data, [f.key]: e.target.checked })
                    }
                  />
                  {f.label}
                </label>
              ) : f.type === "datetime-local" ? (
                <ThaiDateField key={f.key} label={f.label} withTime required={f.required} value={data[f.key] || ""} onChange={next=>setData({...data,[f.key]:next})}/>
              ) : f.type === "textarea" ? (
                <div className="col-span-full" key={f.key}>
                  <Textarea
                    label={f.label}
                    value={data[f.key] || ""}
                    onChange={(e) =>
                      setData({ ...data, [f.key]: e.target.value })
                    }
                    required={f.required}
                  />
                </div>
              ) : f.options || f.key.endsWith("_id") ? (
                <Select
                  key={f.key}
                  label={f.label}
                  value={data[f.key] || ""}
                  onChange={(e) =>
                    setData({ ...data, [f.key]: e.target.value })
                  }
                  required={f.required}
                >
                  <option value="">เลือก</option>
                  {f.options?.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              ) : (
                <Field
                  key={f.key}
                  label={f.label}
                  type={f.type || "text"}
                  value={data[f.key] ?? ""}
                  onChange={(e) =>
                    setData({ ...data, [f.key]: e.target.value })
                  }
                  required={f.required}
                  min={f.min}
                  max={f.max}
                  step={f.key === "fee_amount" ? 0.01 : undefined}
                />
              ),
            )}
          </div>
          {table === "job_positions" && (
            <div className="subpanel">
              <h3>เอกสารที่ต้องแนบ</h3>
              {docs.map((d, i) => (
                <div key={i} className="document-config">
                  <Select
                    label="ประเภทเอกสาร"
                    value={d.key}
                    onChange={(e) =>
                      setDocs(
                        docs.map((v, x) =>
                          x === i ? { ...v, key: e.target.value } : v,
                        ),
                      )
                    }
                  >
                    {documentOptions.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                  <Field
                    label="ชื่อที่แสดงให้ผู้สมัคร"
                    value={d.label}
                    onChange={(e) =>
                      setDocs(
                        docs.map((v, x) =>
                          x === i ? { ...v, label: e.target.value } : v,
                        ),
                      )
                    }
                    required
                  />
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={d.required}
                      onChange={(e) =>
                        setDocs(
                          docs.map((v, x) =>
                            x === i ? { ...v, required: e.target.checked } : v,
                          ),
                        )
                      }
                    />
                    บังคับแนบ
                  </label>
                  <button
                    type="button"
                    className="btn small outline"
                    onClick={() => setDocs(docs.filter((_, x) => x !== i))}
                  >
                    นำออก
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn small outline mt-3"
                onClick={() =>
                  setDocs([
                    ...docs,
                    { key: "other", label: "เอกสารอื่น", required: false },
                  ])
                }
              >
                <Plus size={15} /> เพิ่มประเภทเอกสาร
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Submit busy={busy}>
              <Save size={18} /> บันทึก
            </Submit>
            <button
              className="btn outline"
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              ยกเลิก
            </button>
          </div>
        </form>
      )}
      <section className="panel">
        <State loading={q.isPending} error={q.error} empty={!q.data?.length}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{title[table]}</th>
                  <th>รายละเอียด</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {q.data?.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.title || row.name}</strong>
                    </td>
                    <td>
                      {row.year_be && `พ.ศ. ${row.year_be}`}
                      {row.closes_at && (
                        <small>ปิดรับ {dateTH(row.closes_at, true)}</small>
                      )}
                      {row.vacancies && `${row.vacancies} อัตรา`}
                      {row.exam_at && dateTH(row.exam_at, true)}
                    </td>
                    <td>
                      {row.archived
                        ? "เก็บถาวร"
                        : table === "departments"
                          ? "ใช้งาน"
                          : row.published
                            ? "เผยแพร่แล้ว"
                            : "แบบร่าง"}
                    </td>
                    <td>
                      <div className="flex gap-2 flex-wrap">
                        <button className="btn small outline" onClick={() => start(row)}>
                          <Pencil size={15} /> แก้ไข
                        </button>
                        {auth.role === "admin" && table === "job_positions" && !row.archived && (
                          <button type="button" className="btn small outline"
                            disabled={deleting !== null}
                            onClick={() => void archivePosition(row)}>
                            <Trash2 size={15}/> {deleting === row.id ? "กำลังเก็บ…" : "เก็บถาวร"}
                          </button>
                        )}
                        {auth.role === "admin" && (
                          <button type="button" className="btn small danger"
                            disabled={deleting !== null}
                            onClick={() => void removeRecord(row)}>
                            <Trash2 size={15}/> {deleting === row.id ? "กำลังลบ…" : "ลบ"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </State>
      </section>
    </>
  );
}
