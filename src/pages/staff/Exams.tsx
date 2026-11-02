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
    [selectedApp, setSelectedApp] = useState(""),
    [applicantSearch, setApplicantSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false);
  const qc = useQueryClient();
  const eligible = useQuery({
    queryKey: ["eligible-applications"],
    queryFn: async () => {
      const r = await supabase
        .from("applications")
        .select("id,job_id,application_number,personal_data,job_positions(title)")
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
  const applicantLabel = (item: NonNullable<typeof eligible.data>[number]) =>
    [item.application_number || "รอออกเลข", "—",
      item.personal_data?.prefix || "", item.personal_data?.first_name || "",
      item.personal_data?.last_name || ""].filter(Boolean).join(" ").trim();
  const normalizedSearch = applicantSearch.toLocaleLowerCase("th-TH").replace(/\\s+/g, " ").trim();
  const matchingApplicants = (eligible.data || []).filter(item => {
    const name = [
      item.personal_data?.prefix || "", item.personal_data?.first_name || "",
      item.personal_data?.last_name || "",
    ].join(" ");
    const title = item.job_positions?.title || "";
    const value = [name, item.application_number || "", title].join(" ")
      .toLocaleLowerCase("th-TH").replace(/\\s+/g, " ");
    return normalizedSearch === "" || normalizedSearch.split(" ").every(word => value.includes(word));
  });
  const selectApplicant = (item: NonNullable<typeof eligible.data>[number]) => {
    setSelectedApp(item.id);
    setApplicantSearch(applicantLabel(item));
    setSearchOpen(false);
  };
  const score = existing.data?.find((x) => x.application_id === selectedApp);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedApp || !eligible.data?.some(item => item.id === selectedApp)) {
      setError("กรุณาพิมพ์ค้นหาและเลือกรายชื่อผู้สมัครจากผลการค้นหาก่อนบันทึก");
      setSearchOpen(true);
      return;
    }
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
      setApplicantSearch("");
      setSearchOpen(false);
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
              <div className="field" style={{ position: "relative" }}>
                <label htmlFor="exam-applicant-search">
                  ผู้สมัครที่ผ่านคุณสมบัติ <b className="text-orange-500">*</b>
                </label>
                <input
                  id="exam-applicant-search"
                  type="search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={searchOpen}
                  aria-controls="exam-applicant-matches"
                  autoComplete="off"
                  placeholder="พิมพ์ชื่อ–สกุล เลขผู้สมัคร หรือตำแหน่ง..."
                  value={applicantSearch}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(e) => {
                    setApplicantSearch(e.target.value);
                    setSelectedApp("");
                    setSearchOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setSearchOpen(false);
                    if (e.key === "Enter" && searchOpen && matchingApplicants.length === 1) {
                      e.preventDefault();
                      selectApplicant(matchingApplicants[0]);
                    } else if (e.key === "Enter" && searchOpen && !selectedApp) {
                      e.preventDefault();
                    }
                  }}
                  onBlur={(e) => {
                    if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) {
                      setSearchOpen(false);
                    }
                  }}
                />
                <input type="hidden" name="application_id" value={selectedApp} />
                {selectedApp && <small style={{ color: "var(--success, #16783f)" }}>
                  เลือกผู้สมัครแล้ว ✓ — สามารถบันทึกเลขประจำตัวสอบได้
                </small>}
                {searchOpen && <div
                  id="exam-applicant-matches"
                  role="listbox"
                  aria-label="ผลการค้นหาผู้สมัคร"
                  style={{
                    background: "var(--surface, #fff)",
                    border: "1px solid #cad6e5",
                    borderRadius: 10,
                    maxHeight: 280,
                    overflowY: "auto",
                    marginTop: 6,
                    boxShadow: "0 8px 22px rgba(0,0,0,.1)",
                  }}
                >
                  {matchingApplicants.slice(0, 40).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={item.id === selectedApp}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "10px 12px",
                        border: 0,
                        borderBottom: "1px solid #edf0f4",
                        textAlign: "left",
                        background: item.id === selectedApp ? "#e8f2ff" : "transparent",
                        color: "inherit",
                        cursor: "pointer",
                      }}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => selectApplicant(item)}
                    >
                      <strong>{applicantLabel(item)}</strong>
                      <small style={{ display: "block", opacity: .75 }}>
                        {item.job_positions?.title || "ไม่ระบุตำแหน่ง"}
                      </small>
                    </button>
                  ))}
                  {matchingApplicants.length === 0 && <p className="muted" style={{ padding: 12 }}>
                    ไม่พบผู้สมัครที่ตรงกับคำค้นหา
                  </p>}
                  {matchingApplicants.length > 40 && <p className="muted" style={{ padding: 10 }}>
                    พบ {matchingApplicants.length} รายชื่อ แสดง 40 รายการแรก กรุณาพิมพ์ให้เจาะจงขึ้น
                  </p>}
                </div>}
              </div>
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
