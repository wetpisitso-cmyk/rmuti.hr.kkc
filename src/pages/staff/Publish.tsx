import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCatalog } from "../../hooks/useCatalog";
import { supabase } from "../../lib/supabase";
import { rpc } from "../../services/api";
import { errorTH } from "../../lib/errors";
import { Field, Select, Title, Notice, State } from "../../components/UI";
import { outcomeLabels } from "../../types/models";
import Catalog from "./Catalog";
export default function Publish() {
  const [tab, setTab] = useState("news"),
    [job, setJob] = useState(""),
    [kind, setKind] = useState("eligibility"),
    [title, setTitle] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const catalog = useCatalog(),
    qc = useQueryClient();
  const q = useQuery({
    queryKey: ["preview-results", job, kind],
    enabled: !!job && tab === "results",
    queryFn: async () => {
      const r = await supabase
        .from("applications")
        .select(
          "id,application_number,status,snapshot,selection_results(outcome)",
        )
        .eq("job_id", job)
        .in("status", ["eligible", "ineligible"])
        .order("application_number");
      if (r.error) throw r.error;
      return r.data
        .map((x) => ({
          ...x,
          result: Array.isArray(x.selection_results)
            ? x.selection_results[0]
            : (x.selection_results as any),
        }))
        .filter((x) => kind === "eligibility" || x.result)
        .map((x) => ({
          number: x.application_number,
          name: `${x.snapshot?.personal.first_name || ""} ${x.snapshot?.personal.last_name || ""}`,
          outcome: kind === "eligibility" ? x.status : x.result.outcome,
        }));
    },
  });
  const publish = async () => {
    setBusy(true);
    setError("");
    try {
      await rpc("publish_results", {
        p_job: job,
        p_kind: kind,
        p_title: title,
      });
      await qc.invalidateQueries({ queryKey: ["published-results"] });
      setSuccess("เผยแพร่ประกาศผลแล้ว ผู้เยี่ยมชมสามารถดูได้จากหน้าผลคัดเลือก");
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Title title="ประกาศและการเผยแพร่" />
      <div className="tabs mb-4">
        <button
          className={tab === "news" ? "active" : ""}
          onClick={() => setTab("news")}
        >
          ข่าว / เอกสารประกาศ
        </button>
        <button
          className={tab === "results" ? "active" : ""}
          onClick={() => setTab("results")}
        >
          ตรวจร่าง / เผยแพร่รายชื่อ
        </button>
      </div>
      {tab === "news" ? (
        <Catalog table="announcements" />
      ) : (
        <>
          {error && <Notice kind="error">{error}</Notice>}
          {success && <Notice kind="success">{success}</Notice>}
          <section className="panel stack">
            <Select
              label="ตำแหน่ง"
              value={job}
              onChange={(e) => setJob(e.target.value)}
            >
              <option value="">เลือกตำแหน่ง</option>
              {catalog.jobs.data?.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </Select>
            <Select
              label="ประเภทประกาศ"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="eligibility">
                รายชื่อผู้มีสิทธิสอบ / ไม่มีสิทธิสอบ
              </option>
              <option value="selection">ผลคัดเลือก</option>
            </Select>
            <Field
              label="ชื่อประกาศผล"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Notice>
              ตรวจรายชื่อด้านล่างก่อนเผยแพร่ ข้อมูลสาธารณะประกอบด้วยเลขผู้สมัคร
              ชื่อ และผลเท่านั้น
            </Notice>
            {job && (
              <State
                loading={q.isPending}
                error={q.error}
                empty={!q.data?.length}
              >
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>เลขผู้สมัคร</th>
                        <th>ชื่อ–นามสกุล</th>
                        <th>ผล</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.data?.map((r) => (
                        <tr key={r.number}>
                          <td>{r.number}</td>
                          <td>{r.name}</td>
                          <td>{outcomeLabels[r.outcome]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </State>
            )}
            <button
              className="btn primary"
              disabled={busy || !job || !title || !q.data?.length}
              onClick={publish}
            >
              {busy ? "กำลังเผยแพร่…" : "ตรวจร่างแล้ว — เผยแพร่ผล"}
            </button>
          </section>
        </>
      )}
    </>
  );
}
