import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Printer,
  ArrowRight,
  Files,
  Clock3,
  FileWarning,
  CheckCircle2,
  UserX,
  Trash2,
} from "lucide-react";
import { useCatalog } from "../../hooks/useCatalog";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuth } from "../../hooks/useAuth";
import { rpc, staffList } from "../../services/api";
import { dateTH, bangkokISO, downloadCSV, printPage } from "../../lib/format";
import { errorTH } from "../../lib/errors";
import {
  Field,
  Select,
  State,
  Title,
  Badge,
  Notice,
} from "../../components/UI";
import { statuses, type Filters } from "../../types/models";
import { supabase } from "../../lib/supabase";
import { ThaiDateField } from "../../components/ThaiDateField";
import ApplicantDocumentsDownload from "../../components/ApplicantDocumentsDownload";

const initial: Filters = {
  year: "",
  round: "",
  job: "",
  department: "",
  status: "",
  from: "",
  to: "",
  search: "",
};
export default function StaffDashboard({
  listOnly = false,
}: {
  listOnly?: boolean;
}) {
  const a = useAuth(),
    catalog = useCatalog(),
    [filters, setFilters] = useState(initial),
    [page, setPage] = useState(0),
    [sort, setSort] = useState("created"),
    [exporting, setExporting] = useState(false),
    [deletingId, setDeletingId] = useState<string | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const search = useDebounce(filters.search);
  const applied = {
    ...filters,
    search,
    from: filters.from ? bangkokISO(filters.from) : "",
    to: filters.to
      ? new Date(new Date(bangkokISO(filters.to)).getTime() + 86400000 - 1).toISOString()
      : "",
  };
  const q = useQuery({
    queryKey: ["staff-list", applied, page, sort],
    queryFn: () => staffList(applied, page, 20, sort),

  });
  const dashboard = useQuery({
    queryKey: ["staff-dashboard", applied],
    queryFn: () => rpc("staff_dashboard", { p_filters: applied }),
    enabled: !listOnly,
  });
  const set = (k: keyof Filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(0);
  };
  const exportAll = async () => {
    setExporting(true);
    setError("");
    try {
      const all = [];
      let p = 0,
        total = 0;
      do {
        const r = await staffList(applied, p++, 100, sort);
        total = r.count;
        all.push(...r.rows);
      } while (all.length < total);
      downloadCSV(
        all.map((x) => ({
          ลำดับสมัครตามตำแหน่ง: (x.display_position_order ?? x.position_order) ? `(${x.display_position_order ?? x.position_order})` : "",
          เลขผู้สมัคร: x.application_number,
          ชื่อ: x.personal_data.first_name,
          นามสกุล: x.personal_data.last_name,
          ตำแหน่ง: x.job_title,
          หน่วยงาน: x.department_name,
          "ปี พ.ศ.": x.year_be,
          สถานะ: statuses[x.status],
          สถานะชำระ: x.payment_status,
          เวลาส่ง: dateTH(x.submitted_at, true),
        })),
        "rmuti-applications.csv",
      );
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setExporting(false);
    }
  };
  const [showArchive,setShowArchive] = useState(false);
  const archived = useQuery({
    queryKey:["archived-applications"],
    enabled:showArchive && a.role==="admin",
    queryFn:async()=>{
      const {data,error}=await supabase.from("applications")
        .select("id,application_number,personal_data,archived_at,job_positions(title)")
        .not("archived_at","is",null).order("archived_at",{ascending:false}).limit(100);
      if(error)throw error;
      return data;
    },
  });
  const deleteApplication = async (id:string,number:string|null)=>{
    if(a.role!=="admin")return;
    const expected=number||"ย้ายไปสำรอง";
    if(!window.confirm("ย้ายใบสมัครออกจากรายการหลักและสำรองข้อมูลทั้งหมดไว้ก่อน?\nสามารถกู้คืนได้ในคลังสำรอง"))return;
    setDeletingId(id);setError("");setSuccess("");
    try {
      await rpc("admin_archive_application",{p_id:id,p_confirmation:expected});
      setSuccess("ย้ายใบสมัครไปคลังสำรองสำเร็จแล้ว สามารถกู้คืนได้");
      await Promise.all([q.refetch(),...(listOnly?[]:[dashboard.refetch()]),archived.refetch()]);
    }catch(e){setError(errorTH(e));}
    finally{setDeletingId(null);}
  };
  const editDisplayOrder=async(id:string, previous:number|null|undefined)=>{
    if(a.role!=="admin")return;
    const input=window.prompt("แก้เลขลำดับในตำแหน่ง (1, 2, 3...) ห้ามเลขซ้ำ",String(previous??1));
    if(input===null)return;
    const value=Number(input.trim());
    if(!/^[1-9][0-9]*$/.test(input.trim())||!Number.isSafeInteger(value)||value>1000000){
      setError("กรุณากรอกเลขลำดับจำนวนเต็ม 1 ถึง 1,000,000");return;
    }
    if(!window.confirm("ยืนยันเปลี่ยนเลขลำดับเป็น ("+value+") โดยไม่แก้เลขผู้สมัครทางราชการ?"))return;
    setDeletingId(id);setError("");setSuccess("");
    try{
      await rpc("admin_set_display_position_order",{p_id:id,p_number:value});
      setSuccess("บันทึกเลขลำดับ ("+value+") เรียบร้อย");
      await Promise.all([q.refetch(),...(listOnly?[]:[dashboard.refetch()])]);
    }catch(e){setError(errorTH(e));}finally{setDeletingId(null);}
  };
  const rejectExpiredCorrection=async (row:{id:string;personal_data:{first_name:string;last_name:string};correction_deadline?:string|null})=>{
    if(!a.can("review")||!row.correction_deadline||Date.now()<=new Date(row.correction_deadline).getTime())return;
    const name=[row.personal_data.first_name,row.personal_data.last_name].filter(Boolean).join(" ");
    const suggested="ไม่ผ่านคุณสมบัติ เนื่องจากไม่ดำเนินการแก้ไขเอกสารประกอบการสมัครให้ครบถ้วนภายในระยะเวลาที่กำหนด";
    const reason=window.prompt("เหตุผลการพิจารณาไม่ผ่านคุณสมบัติของ "+name+"\nข้อความนี้จะแสดงต่อผู้สมัครและบันทึกในประวัติ",suggested);
    if(reason===null)return;
    if(reason.trim().length<12){setError("กรุณาระบุเหตุผลอย่างน้อย 12 ตัวอักษร");return;}
    if(!window.confirm("ยืนยันบันทึกผล ไม่ผ่านคุณสมบัติ ให้ "+name+"?\nตรวจสอบว่าผู้สมัครไม่ได้ส่งเอกสารแก้ไขแล้ว ระบบจะบันทึกประวัติและแจ้งผู้สมัคร"))return;
    setDeletingId(row.id);setError("");setSuccess("");
    try{
      await rpc("staff_reject_expired_correction",{p_id:row.id,p_reason:reason.trim()});
      setSuccess("บันทึกผลไม่ผ่านคุณสมบัติของ "+name+" และแจ้งผู้สมัครเรียบร้อยแล้ว");
      await Promise.all([q.refetch(),...(listOnly?[]:[dashboard.refetch()])]);
    }catch(e){setError(errorTH(e));}finally{setDeletingId(null);}
  };
  const restoreApplication=async(id:string)=>{
    if(!window.confirm("กู้คืนใบสมัครนี้กลับสู่รายการหลัก?"))return;
    setDeletingId(id);setError("");setSuccess("");
    try{
      await rpc("admin_restore_application",{p_id:id});
      setSuccess("กู้คืนใบสมัครสำเร็จแล้ว");
      await Promise.all([q.refetch(),...(listOnly?[]:[dashboard.refetch()]),archived.refetch()]);
    }catch(e){setError(errorTH(e));}
    finally{setDeletingId(null);}
  };
  const counts = dashboard.data?.statuses || {};
  return (
    <>
      <Title
        eyebrow="RECRUITMENT OVERVIEW"
        title={listOnly ? "รายการใบสมัคร" : "ภาพรวมการรับสมัคร"}
        description="แสดงเฉพาะใบสมัครที่ยืนยันส่งแล้ว โดยสถิติและรายการปรับตามตัวกรองที่เลือก"
        action={
          <div className="flex gap-2 no-print">
            {a.can("reports") && (
              <button
                className="btn outline small"
                disabled={exporting}
                onClick={exportAll}
              >
                <Download size={16} />
                {exporting ? "กำลังส่งออก…" : "CSV ทั้งหมด"}
              </button>
            )}
            <button className="btn outline small" onClick={printPage}>
              <Printer size={16} /> PDF หน้านี้
            </button>
          </div>
        }
      />
      {error && <Notice kind="error">{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}
      <section className="filter-card no-print">
        <div className="filter-grid staff-filters">
          <Select
            label="ปี พ.ศ."
            value={filters.year}
            onChange={(e) => set("year", e.target.value)}
          >
            <option value="">ทุกปี</option>
            {[...new Set(catalog.rounds.data?.map((r) => r.year_be))].map(
              (y) => (
                <option key={y}>{y}</option>
              ),
            )}
          </Select>
          <Select
            label="รอบรับสมัคร"
            value={filters.round}
            onChange={(e) => set("round", e.target.value)}
          >
            <option value="">ทุกรอบ</option>
            {catalog.rounds.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Select
            label="ตำแหน่ง"
            value={filters.job}
            onChange={(e) => set("job", e.target.value)}
          >
            <option value="">ทุกตำแหน่ง</option>
            {catalog.jobs.data?.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </Select>
          <Select
            label="หน่วยงาน"
            value={filters.department}
            onChange={(e) => set("department", e.target.value)}
          >
            <option value="">ทุกหน่วยงาน</option>
            {catalog.departments.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select
            label="สถานะ"
            value={filters.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="">ทุกสถานะที่ส่งแล้ว</option>
            {Object.entries(statuses).filter(([k]) => k !== "draft").map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
          <ThaiDateField label="วันที่เริ่ม (พ.ศ.)" value={filters.from} onChange={v=>set("from",v)} />
          <ThaiDateField label="วันที่สิ้นสุด (พ.ศ.)" value={filters.to} onChange={v=>set("to",v)} />
          <Field
            label="ค้นหาชื่อ / เลขผู้สมัคร"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="พิมพ์เพื่อค้นหา…"
          />
        </div>
      </section>
      {!listOnly && (
        <State loading={dashboard.isPending} error={dashboard.error}>
          <div className="kpi-grid">
            {[
              ["ใบสมัครที่ส่งแล้ว", dashboard.data?.total || 0, Files],
              [
                "รอตรวจ",
                (counts.submitted || 0) + (counts.under_review || 0),
                Clock3,
              ],
              ["ต้องแก้ไข", counts.needs_correction || 0, FileWarning],
              ["ผ่านคุณสมบัติ", counts.eligible || 0, CheckCircle2],
            ].map(([label, n, Icon], i) => {
              const C = Icon as typeof Files;
              return (
                <div key={i} className={`kpi ${i === 2 ? "orange" : ""}`}>
                  <span>{String(label)}</span>
                  <strong>{String(n)}</strong>
                  <C size={25} />
                </div>
              );
            })}
          </div>
          <div className="chart-grid">
            <BarChart
              title="ใบสมัครตามตำแหน่ง"
              data={dashboard.data?.jobs || []}
            />
            <BarChart
              title="ใบสมัครตามหน่วยงาน"
              data={dashboard.data?.departments || []}
            />
          </div>
          <section className="panel">
            <h3>คุณสมบัติและการชำระเงิน</h3>
            <div className="flex gap-4 flex-wrap">
              <span>
                ไม่ผ่านคุณสมบัติ <b>{counts.ineligible || 0}</b>
              </span>
              {Object.entries(dashboard.data?.payments || {}).map(
                ([status, count]) => (
                  <span key={status}>
                    <Badge status={status} payment /> <b>{String(count)}</b>
                  </span>
                ),
              )}
            </div>
          </section>
        </State>
      )}
      {a.role === "admin" && (
        <section className="panel no-print">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2>คลังสำรองใบสมัคร</h2>
              <p className="muted">ใบสมัครที่ลบออกจากรายการหลักยังเก็บข้อมูล เอกสาร และหลักฐานการเงินไว้ กู้คืนได้</p>
            </div>
            <button className="btn outline" type="button" onClick={() => setShowArchive(v => !v)}>
              {showArchive ? "ปิดคลังสำรอง" : "เปิดคลังสำรอง / กู้คืน"}
            </button>
          </div>
          {showArchive && (
            <State loading={archived.isPending} error={archived.error} empty={!archived.data?.length}>
              <div className="stack mt-3">
                {archived.data?.map(item => (
                  <div className="subpanel flex justify-between items-center flex-wrap gap-3" key={item.id}>
                    <div>
                      <strong>{item.application_number || "ไม่มีเลขผู้สมัคร"}</strong>
                      <small>{item.personal_data?.first_name} {item.personal_data?.last_name}</small>
                      <small>ย้ายไปสำรองเมื่อ {dateTH(item.archived_at, true)}</small>
                    </div>
                    <button type="button" className="btn outline small" disabled={deletingId !== null}
                      onClick={() => void restoreApplication(item.id)}>กู้คืนใบสมัคร</button>
                  </div>
                ))}
              </div>
            </State>
          )}
        </section>
      )}
      <section className="panel">
        <div className="flex justify-between items-center mb-3 flex-wrap gap-3">
          <h2>ใบสมัคร {q.data?.count || 0} รายการ</h2>
          <Select
            label="เรียงลำดับ"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            <option value="created">รายการใหม่ก่อน</option>
            <option value="submission_order">ลำดับส่งใบสมัครตามตำแหน่ง (1), (2), ...</option>
            <option value="number">เลขผู้สมัครทางการ</option>
            <option value="status">สถานะ</option>
            <option value="ineligible_first">ไม่ผ่านคุณสมบัติก่อน</option>
          </Select>
        </div>
        <State
          loading={q.isPending}
          error={q.error}
          empty={!q.data?.rows.length}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>เลข / ชื่อผู้สมัคร</th>
                  <th>ตำแหน่ง / หน่วยงาน</th>
                  <th>สถานะ</th>
                  <th>ชำระเงิน</th>
                  <th>ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {q.data?.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.application_number || (r.submitted_at ? "รอออกเลขผู้สมัคร" : "แบบร่าง")}</strong>
                      {(r.display_position_order ?? r.position_order) != null && <small>ลำดับในตำแหน่ง ({r.display_position_order ?? r.position_order}) · {dateTH(r.submitted_at, true)}</small>}
                      <small>
                        {r.personal_data.first_name} {r.personal_data.last_name}
                      </small>
                      {r.status==="needs_correction" && r.correction_deadline && (
                        <small>กำหนดแก้ไข: {dateTH(r.correction_deadline,true)}
                          {Date.now()>new Date(r.correction_deadline).getTime()?" · พ้นกำหนดแล้ว":""}
                        </small>
                      )}
                    </td>
                    <td>
                      {r.job_title}
                      <small>{r.department_name}</small>
                    </td>
                    <td>
                      <Badge status={r.status} />
                    </td>
                    <td>
                      <Badge status={r.payment_status} payment />
                    </td>
                    <td>
                      <div className="flex gap-2 flex-wrap">
                        <Link
                          className="btn small outline"
                          to={`/staff/applications/${r.id}`}
                        >
                          ตรวจใบสมัคร <ArrowRight size={14} />
                        </Link>
                        {a.can("review") && r.status==="needs_correction" && r.correction_deadline &&
                          Date.now()>new Date(r.correction_deadline).getTime() && (
                          <button type="button" className="btn small danger" disabled={deletingId!==null}
                            onClick={()=>void rejectExpiredCorrection(r)}>
                            <UserX size={15}/> ไม่ผ่านคุณสมบัติ (พ้นกำหนดแก้ไข)
                          </button>
                        )}
                        {a.role === "admin" && <ApplicantDocumentsDownload applicationId={r.id} compact />}
                        {a.role === "admin" && <button type="button" className="btn small outline" disabled={deletingId !== null} onClick={() => void editDisplayOrder(r.id,r.display_position_order ?? r.position_order)}>แก้ลำดับ ({r.display_position_order ?? r.position_order ?? "–"})</button>}
                        {a.role === "admin" && (
                          <button
                            type="button"
                            className="btn small danger"
                            disabled={deletingId !== null}
                            onClick={() => void deleteApplication(r.id, r.application_number)}
                          >
                            <Trash2 size={14} /> {deletingId === r.id ? "กำลังสำรอง…" : "ลบ (สำรอง)"}
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
        <div className="pagination no-print">
          <button
            className="btn small outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ก่อนหน้า
          </button>
          <span>
            หน้า {page + 1} /{" "}
            {Math.max(1, Math.ceil((q.data?.count || 0) / 20))}
          </span>
          <button
            className="btn small outline"
            disabled={(page + 1) * 20 >= (q.data?.count || 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            ถัดไป
          </button>
        </div>
      </section>
    </>
  );
}
function BarChart({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  const max = Math.max(...data.map((x) => x.value), 1);
  return (
    <section className="panel chart">
      <h2>{title}</h2>
      {data.length ? (
        data.map((x, i) => (
          <div className="bar-row" key={i}>
            <div>
              <span>{x.name}</span>
              <b>{x.value}</b>
            </div>
            <div className="bar-track">
              <div style={{ width: `${(x.value / max) * 100}%` }} />
            </div>
          </div>
        ))
      ) : (
        <p className="muted">ยังไม่มีข้อมูลตามตัวกรอง</p>
      )}
    </section>
  );
}
