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
    [error, setError] = useState("");
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
  const deleteApplication = async (id: string, number: string | null) => {
    if (a.role !== "admin") return;
    if (!number) { setError("ใบสมัครต้องมีเลขผู้สมัครก่อนจึงจะลบได้"); return; }
    const typed = window.prompt("ลบใบสมัครถาวร: พิมพ์เลขใบสมัครเพื่อยืนยัน\n" + number);
    if (typed === null) return;
    if (typed.trim() !== number) { setError("เลขยืนยันไม่ตรงกับใบสมัคร"); return; }
    if (!window.confirm("ยืนยันลบใบสมัคร " + number + " และข้อมูล/เอกสารที่เกี่ยวข้องอย่างถาวร?")) return;
    setDeletingId(id);
    setError("");
    try {
      await rpc("admin_delete_application", { p_id: id, p_confirm_number: number });
      await Promise.all([
        q.refetch(), dashboard.refetch(),
      ]);
      const { data: cleanup, error: cleanupError } = await supabase.functions.invoke("admin-cleanup-files", { body: {} });
      if (cleanupError || Number(cleanup?.failed || 0) > 0) {
        setError("ลบใบสมัครเรียบร้อยแล้ว แต่ไฟล์แนบบางรายการยังรอการลบจาก Storage โปรดติดต่อผู้ดูแลระบบ");
      }
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setDeletingId(null);
    }
  };
  const counts = dashboard.data?.statuses || {};
  return (
    <>
      <Title
        eyebrow="RECRUITMENT OVERVIEW"
        title={listOnly ? "รายการใบสมัคร" : "ภาพรวมการรับสมัคร"}
        description="การ์ด กราฟ และรายการปรับตามตัวกรองที่เลือก"
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
            <option value="">ทุกสถานะ</option>
            {Object.entries(statuses).map(([k, l]) => (
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
              ["ใบสมัครทั้งหมด", dashboard.data?.total || 0, Files],
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
            <option value="number">เลขผู้สมัคร</option>
            <option value="status">สถานะ</option>
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
                      <strong>{r.application_number || "แบบร่าง"}</strong>
                      <small>
                        {r.personal_data.first_name} {r.personal_data.last_name}
                      </small>
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
                        {a.role === "admin" && r.application_number && (
                          <button
                            type="button"
                            className="btn small danger"
                            disabled={deletingId !== null}
                            onClick={() => void deleteApplication(r.id, r.application_number)}
                          >
                            <Trash2 size={14} /> {deletingId === r.id ? "กำลังลบ…" : "ลบ"}
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
