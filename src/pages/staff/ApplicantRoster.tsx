import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useCatalog } from "../../hooks/useCatalog";
import { staffList } from "../../services/api";
import { State, Notice, Select, Title } from "../../components/UI";
import { dateTH } from "../../lib/format";
import { errorTH } from "../../lib/errors";
import {
  rosterLines, buildRosterXlsx, rosterFilename, saveRosterFile,
  type RosterMeta,
} from "../../lib/roster-export";
import { buildRosterPdf } from "../../lib/roster-pdf";
import type { StaffRow } from "../../types/models";

const PAGE_SIZE = 25;
const MAX_ROWS = 5000;
async function allForJob(job: string): Promise<StaffRow[]> {
  const rows: StaffRow[] = [];
  let page = 0;
  let total = 0;
  do {
    const result = await staffList({ job }, page++, 100, "number");
    if (!Number.isSafeInteger(result.count) || result.count > MAX_ROWS) {
      throw new Error("รายชื่อเกิน 5,000 รายการ กรุณาติดต่อผู้ดูแลระบบเพื่อจัดทำรายงานขนาดใหญ่");
    }
    if (!Array.isArray(result.rows)) throw new Error("ไม่สามารถอ่านรายชื่อจากฐานข้อมูล");
    total = result.count;
    rows.push(...result.rows);
    if (rows.length > total) throw new Error("จำนวนรายชื่อที่ส่งกลับไม่สอดคล้องกับฐานข้อมูล");
    if (rows.length < total && !result.rows.length) throw new Error("ข้อมูลรายชื่อไม่ครบ กรุณาลองอีกครั้ง");
  } while (rows.length < total);
  if (rows.length !== total) throw new Error("จำนวนรายชื่อที่ส่งออกไม่ครบ");
  return rows;
}
export default function ApplicantRoster() {
  const auth = useAuth();
  const catalog = useCatalog();
  const [year, setYear] = useState("");
  const [round, setRound] = useState("");
  const [jobId, setJobId] = useState("");
  const [page, setPage] = useState(0);
  const [working, setWorking] = useState<"pdf" | "xlsx" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const rounds = useMemo(() => catalog.rounds.data?.filter(r => !year || String(r.year_be) === year) || [],
    [catalog.rounds.data, year]);
  const jobs = useMemo(() => catalog.jobs.data?.filter(j => (!year || String(j.recruitment_rounds?.year_be) === year) &&
    (!round || j.round_id === round)) || [], [catalog.jobs.data, year, round]);
  const selectedJob = jobs.find(j => j.id === jobId);
  const canExport = auth.can("reports");
  const roster = useQuery({
    queryKey: ["applicant-roster", jobId, page],
    queryFn: () => staffList({ job: jobId }, page, PAGE_SIZE, "number"),
    enabled: canExport && !!jobId,
  });
  const createMeta = (): RosterMeta => ({
    jobTitle: selectedJob!.title,
    department: selectedJob!.departments?.name || "ไม่ระบุหน่วยงาน",
    round: selectedJob!.recruitment_rounds?.name || "ไม่ระบุรอบ",
    yearBE: selectedJob!.recruitment_rounds?.year_be || Number(year) || new Date().getFullYear() + 543,
    generatedAt: new Date().toISOString(),
  });
  async function exportList(format: "pdf" | "xlsx") {
    if (!selectedJob || !canExport || working) return;
    setWorking(format); setError(""); setSuccess("");
    try {
      // Retrieve the complete list through the RLS-aware staff_list RPC,
      // rather than exporting only the currently visible page.
      const rows = await allForJob(selectedJob.id);
      const lines = rosterLines(rows);
      const meta = createMeta();
      const blob = format === "xlsx" ? buildRosterXlsx(lines, meta) : await buildRosterPdf(lines, meta);
      saveRosterFile(blob, rosterFilename(meta, format));
      setSuccess("สร้างไฟล์รายชื่อ " + lines.length + " รายการแล้ว");
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith("รายชื่อเกิน") ? e.message : errorTH(e));
    } finally {
      setWorking(null);
    }
  }
  if (!canExport) return <div className="container section">
    <Notice kind="error">บัญชีนี้ไม่มีสิทธิ์ส่งออกรายชื่อผู้สมัคร</Notice>
  </div>;
  return <div className="container section">
    <Title eyebrow="RECRUITMENT REPORTS" title="พิมพ์รายชื่อผู้สมัครตามตำแหน่ง"
      description="เลือกปี รอบรับสมัคร และตำแหน่งเพื่อดูรายชื่อที่ยืนยันส่งแล้ว และส่งออก PDF หรือ Excel" />
    <div className="panel stack">
      <div className="form-grid">
        <Select label="ปี พ.ศ." value={year} onChange={e => {
          setYear(e.target.value); setRound(""); setJobId(""); setPage(0);
        }}>
          <option value="">ทุกปี</option>
          {Array.from(new Set(catalog.rounds.data?.map(r => r.year_be) || [])).sort((a,b) => b-a).map(y =>
            <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select label="รอบรับสมัคร" value={round} onChange={e => {
          setRound(e.target.value); setJobId(""); setPage(0);
        }}>
          <option value="">ทุกรอบ</option>
          {rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Select label="ตำแหน่งที่ต้องการพิมพ์" value={jobId} onChange={e => {
          setJobId(e.target.value); setPage(0); setError(""); setSuccess("");
        }}>
          <option value="">กรุณาเลือกตำแหน่ง</option>
          {jobs.map(j => <option key={j.id} value={j.id}>
            {j.title} — {j.departments?.name} — {j.recruitment_rounds?.name}
          </option>)}
        </Select>
      </div>
      <p className="muted">รายงานแสดงเฉพาะใบสมัครที่ยืนยันส่งแล้ว ไม่รวมฉบับร่างหรือใบสมัครที่ย้ายเข้าคลังสำรอง
        ข้อมูลนี้สำหรับการใช้งานภายในเท่านั้น</p>
    </div>
    {error && <Notice kind="error">{error}</Notice>}
    {success && <Notice kind="success">{success}</Notice>}
    {selectedJob && <>
      <section className="panel stack">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h2>{selectedJob.title}</h2>
            <p>{selectedJob.departments?.name}</p>
            <p className="muted">{selectedJob.recruitment_rounds?.name} · จำนวนผู้สมัครที่ส่งแล้ว {roster.data?.count ?? "…"} รายการ</p>
          </div>
          <div className="flex gap-2 flex-wrap no-print">
            <button type="button" className="btn primary" disabled={!!working || roster.isPending || !!roster.error}
              onClick={() => void exportList("pdf")}>
              <FileText size={18} /> {working === "pdf" ? "กำลังสร้าง PDF…" : "ดาวน์โหลด PDF"}
            </button>
            <button type="button" className="btn outline" disabled={!!working || roster.isPending || !!roster.error}
              onClick={() => void exportList("xlsx")}>
              <FileSpreadsheet size={18} /> {working === "xlsx" ? "กำลังสร้าง Excel…" : "ดาวน์โหลด Excel (.xlsx)"}
            </button>
          </div>
        </div>
        <State loading={roster.isPending} error={roster.error} empty={!roster.data?.rows?.length}>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>ลำดับ</th><th>เลขผู้สมัคร</th><th>ชื่อ–นามสกุล</th>
                <th>สถานะ</th><th>ชำระเงิน</th><th>วันที่ส่ง</th>
              </tr></thead>
              <tbody>{rosterLines(roster.data?.rows || []).map((r, i) =>
                <tr key={roster.data?.rows[i]?.id || i}>
                  <td>{page * PAGE_SIZE + r.order}</td>
                  <td>{r.applicationNumber}</td>
                  <td>{r.name}</td>
                  <td>{r.status}</td>
                  <td>{r.payment}</td>
                  <td>{r.submitted}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </State>
        <div className="pagination no-print">
          <button type="button" className="btn small outline" disabled={page === 0 || roster.isPending}
            onClick={() => setPage(p => Math.max(0, p-1))}>ก่อนหน้า</button>
          <span>หน้า {page+1} / {Math.max(1, Math.ceil((roster.data?.count || 0)/PAGE_SIZE))}</span>
          <button type="button" className="btn small outline"
            disabled={roster.isPending || (page+1)*PAGE_SIZE >= (roster.data?.count || 0)}
            onClick={() => setPage(p => p+1)}>ถัดไป</button>
        </div>
        <p className="muted">รายชื่อจะเรียงตามเลขผู้สมัคร โดยผู้ที่ยังไม่ออกเลขแสดงว่า “รอออกเลข” และไม่ถูกรวมกับรายการฉบับร่าง</p>
      </section>
    </>}
    <Link className="btn outline small" to="/staff/applications"><Download size={16} /> กลับรายการใบสมัคร</Link>
    <p className="muted">อัปเดตข้อมูลเมื่อเปิดหรือเปลี่ยนตัวกรอง · {dateTH(new Date().toISOString(), true)}</p>
  </div>;
}
