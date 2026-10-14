import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "../../hooks/useDebounce";
import { rpc } from "../../services/api";
import { errorTH } from "../../lib/errors";
import { Field, Select, State, Title, Notice } from "../../components/UI";
const permissions = [
  ["review", "ตรวจคุณสมบัติ / บันทึกภายใน"],
  ["payments", "ตรวจการชำระเงิน"],
  ["manage_jobs", "จัดการหน่วยงาน รอบ และตำแหน่ง"],
  ["exams", "กำหนดสอบ / คะแนน"],
  ["publish", "เผยแพร่ประกาศและผล"],
  ["reports", "ส่งออกรายงาน"],
] as const;
export default function Users() {
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [role, setRole] = useState("applicant"),
    [perms, setPerms] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const debounced = useDebounce(search),
    qc = useQueryClient();
  const q = useQuery({
    queryKey: ["accounts", debounced],
    queryFn: () => rpc<any[]>("list_accounts", { p_search: debounced }),
  });
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await rpc("set_role", {
        p_user: selected.id,
        p_role: role,
        p_permissions: perms,
      });
      await qc.invalidateQueries({ queryKey: ["accounts"] });
      setSelected(null);
      setSuccess("ปรับสิทธิ์แล้ว มีผลกับการตรวจสิทธิ์ในฐานข้อมูลทันที");
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Title
        title="บัญชีและสิทธิ์เจ้าหน้าที่"
        description="ผู้ใช้สมัครสมาชิกเองจะได้สิทธิ์ผู้สมัคร ผู้ดูแลมอบสิทธิ์เป็นรายบุคคล"
      />
      {error && <Notice kind="error">{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}
      <Field
        label="ค้นหาอีเมลหรือชื่อ (แสดงสูงสุด 100 บัญชีต่อการค้นหา)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {selected && (
        <section className="panel mt-4">
          <h2>
            {selected.first_name} {selected.last_name} · {selected.email}
          </h2>
          <Select
            label="บทบาท"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="applicant">ผู้สมัคร</option>
            <option value="hr">เจ้าหน้าที่ HR</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </Select>
          {role === "hr" && (
            <div className="stack mt-4">
              {permissions.map(([v, l]) => (
                <label className="checkbox" key={v}>
                  <input
                    type="checkbox"
                    checked={perms.includes(v)}
                    onChange={(e) =>
                      setPerms(
                        e.target.checked
                          ? [...perms, v]
                          : perms.filter((x) => x !== v),
                      )
                    }
                  />
                  {l}
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button className="btn primary" disabled={busy} onClick={save}>
              บันทึกสิทธิ์
            </button>
            <button className="btn outline" onClick={() => setSelected(null)}>
              ยกเลิก
            </button>
          </div>
        </section>
      )}
      <section className="panel mt-4">
        <State loading={q.isPending} error={q.error} empty={!q.data?.length}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ชื่อ–นามสกุล</th>
                  <th>อีเมล</th>
                  <th>บทบาท</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {q.data?.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.first_name} {u.last_name}
                    </td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>
                      <button
                        className="btn small outline"
                        onClick={() => {
                          setSelected(u);
                          setRole(u.role);
                          setPerms(u.permissions);
                        }}
                      >
                        แก้ไขสิทธิ์
                      </button>
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
