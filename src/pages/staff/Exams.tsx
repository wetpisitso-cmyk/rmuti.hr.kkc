import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { rpc, rows } from "../../services/api";
import { errorTH } from "../../lib/errors";
import {
  Field,
  Select,
  Textarea,
  Submit,
  Notice,
  State,
  Title,
} from "../../components/UI";
import { outcomeLabels } from "../../types/models";
import Catalog from "./Catalog";
export default function Exams() {
  const [tab, setTab] = useState("schedule"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [selectedApp, setSelectedApp] = useState("");
  const qc = useQueryClient();
  const eligible = useQuery({
    queryKey: ["eligible-applications"],
    queryFn: async () => {
      const r = await supabase
        .from("applications")
        .select("id,job_id,application_number,personal_data")
        .eq("status", "eligible")
        .limit(1000);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const schedules = useQuery({
    queryKey: ["exam-schedules"],
    queryFn: () => rows("exam_schedules", "*", "exam_at", 1000),
  });
  const existing = useQuery({
    queryKey: ["exam-records", tab],
    queryFn: () =>
      rows(
        tab === "assign" ? "exam_assignments" : "selection_results",
        "*",
        "id",
        1000,
      ),
    enabled: tab !== "schedule",
  });
  const score = existing.data?.find((x) => x.application_id === selectedApp);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form));
    try {
      await rpc("admin_save", {
        p_table: tab === "assign" ? "exam_assignments" : "selection_results",
        p_data: d,
      });
      await qc.invalidateQueries({ queryKey: ["exam-records"] });
      setSuccess("บันทึกข้อมูลแล้ว ผลคะแนนยังเป็นร่างจนกว่าจะเผยแพร่");
      form.reset();
      setSelectedApp("");
    } catch (e) {
      setError(errorTH(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Title title="การสอบและผลคัดเลือก" />
      <div className="tabs mb-4">
        {[
          ["schedule", "กำหนดการสอบ"],
          ["assign", "เลขประจำตัวสอบ"],
          ["score", "คะแนน / ผลร่าง"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={tab === v ? "active" : ""}
            onClick={() => {
              setTab(v);
              setError("");
              setSuccess("");
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "schedule" ? (
        <Catalog table="exam_schedules" />
      ) : (
        <>
          {error && <Notice kind="error">{error}</Notice>}
          {success && <Notice kind="success">{success}</Notice>}
          <State
            loading={eligible.isPending || schedules.isPending}
            error={eligible.error || schedules.error}
          >
            <form className="panel stack" onSubmit={submit}>
              <Select
                label="ผู้สมัครที่ผ่านคุณสมบัติ"
                name="application_id"
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                required
              >
                <option value="">เลือกผู้สมัคร</option>
                {eligible.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.application_number} — {a.personal_data.first_name}{" "}
                    {a.personal_data.last_name}
                  </option>
                ))}
              </Select>
              {tab === "assign" ? (
                <>
                  <Select label="กำหนดสอบ" name="schedule_id" required>
                    <option value="">เลือกกำหนดสอบ</option>
                    {schedules.data
                      ?.filter(
                        (s) =>
                          s.job_id ===
                          eligible.data?.find((a) => a.id === selectedApp)
                            ?.job_id,
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} · {s.venue}
                        </option>
                      ))}
                  </Select>
                  <Field
                    label="เลขประจำตัวสอบ"
                    name="exam_number"
                    required
                    maxLength={50}
                  />
                </>
              ) : (
                <div key={selectedApp} className="stack">
                  <Field
                    label="คะแนน (0–100)"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    name="score"
                    defaultValue={score?.score ?? ""}
                  />
                  <Select
                    label="ผลคัดเลือก"
                    name="outcome"
                    defaultValue={score?.outcome || "not_selected"}
                    required
                  >
                    {["selected", "reserve", "not_selected"].map((x) => (
                      <option key={x} value={x}>
                        {outcomeLabels[x]}
                      </option>
                    ))}
                  </Select>
                  <Textarea
                    label="หมายเหตุผลที่ผู้สมัครเห็นเมื่อเผยแพร่"
                    name="remark"
                    defaultValue={score?.remark || ""}
                  />
                </div>
              )}
              <Submit busy={busy}>บันทึก</Submit>
            </form>
            <section className="panel">
              <h2>
                {tab === "assign" ? "รายการเลขประจำตัวสอบ" : "ผลคัดเลือกร่าง"}
              </h2>
              <State
                loading={existing.isPending}
                error={existing.error}
                empty={!existing.data?.length}
              >
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>เลขผู้สมัคร</th>
                        <th>
                          {tab === "assign" ? "เลขประจำตัวสอบ" : "ผลคัดเลือก"}
                        </th>
                        <th>คะแนน / สถานะเผยแพร่</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existing.data?.map((r) => (
                        <tr key={r.id}>
                          <td>
                            {
                              eligible.data?.find(
                                (a) => a.id === r.application_id,
                              )?.application_number
                            }
                          </td>
                          <td>
                            {tab === "assign"
                              ? r.exam_number
                              : outcomeLabels[r.outcome]}
                          </td>
                          <td>
                            {tab === "score"
                              ? `${r.score ?? "—"} · ${r.published ? "เผยแพร่แล้ว" : "ร่าง"}`
                              : "กำหนดตามรอบสอบ"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </State>
            </section>
          </State>
        </>
      )}
    </>
  );
}
