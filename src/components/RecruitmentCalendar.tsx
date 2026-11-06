import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight,
  Clock3, MapPin, Sparkles,
} from "lucide-react";
import type { Job } from "../types/models";
import { dateTH } from "../lib/format";
import {
  addCalendarMonths, bangkokDateKey, calendarDateKey, calendarMonthGrid,
  jobsInCalendarMonth, jobsOnCalendarDay, publishedRecruitmentJobs, recruitmentPhase,
} from "../lib/recruitment-calendar";

const monthNames = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const phaseLabels = {
  open: "เปิดรับสมัคร",
  closing: "ใกล้ปิดรับสมัคร",
  upcoming: "เตรียมเปิดรับ",
  closed: "ปิดรับสมัครแล้ว",
} as const;

function initialMonth(jobs: readonly Job[]) {
  const today = bangkokDateKey(new Date());
  const [year, month] = today.split("-").map(Number);
  const available = publishedRecruitmentJobs(jobs);
  const currentlyRelevant = available.filter(j =>
    bangkokDateKey(j.recruitment_rounds.closes_at) >= today);
  const first = currentlyRelevant.sort((a,b) =>
    a.recruitment_rounds.opens_at.localeCompare(b.recruitment_rounds.opens_at))[0];
  if (!first) return { year, month };
  const firstStart = bangkokDateKey(first.recruitment_rounds.opens_at);
  const choice = firstStart <= today ? today : firstStart;
  const [y,m] = choice.split("-").map(Number);
  return { year:y, month:m };
}

export default function RecruitmentCalendar({ jobs }: { jobs: readonly Job[] }) {
  const allJobs = useMemo(() => publishedRecruitmentJobs(jobs), [jobs]);
  const initial = useMemo(() => initialMonth(allJobs), [allJobs]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [chosenDay, setChosenDay] = useState<number | null>(null);
  const displayed = addCalendarMonths(initial.year, initial.month, monthOffset);
  const monthJobs = useMemo(
    () => jobsInCalendarMonth(allJobs, displayed.year, displayed.month),
    [allJobs, displayed.year, displayed.month],
  );
  const days = useMemo(
    () => calendarMonthGrid(displayed.year, displayed.month),
    [displayed.year, displayed.month],
  );
  const todayKey = bangkokDateKey(new Date());
  const today = todayKey.startsWith(calendarDateKey(displayed.year,displayed.month,1).slice(0,7))
    ? Number(todayKey.slice(-2)) : null;
  const activeDay = chosenDay !== null && chosenDay <= new Date(Date.UTC(displayed.year,displayed.month,0)).getUTCDate()
    ? chosenDay : today;
  const dayKey = activeDay === null ? null : calendarDateKey(displayed.year, displayed.month, activeDay);
  const dayJobs = dayKey ? jobsOnCalendarDay(monthJobs, dayKey) : [];
  const listedJobs = dayKey ? dayJobs : monthJobs;
  const currentTime = Date.now();
  const openCount = monthJobs.filter(j => ["open","closing"].includes(recruitmentPhase(j,currentTime))).length;

  const goMonth = (delta: number) => {
    setMonthOffset(value => Math.max(-36,Math.min(36,value + delta)));
    setChosenDay(null);
  };

  return (
    <section className="recruitment-calendar-section container" id="recruitment-calendar"
      aria-label="ปฏิทินรับสมัครงานรายเดือน">
      <header className="recruitment-calendar-heading">
        <div className="recruitment-calendar-heading-icon"><CalendarDays size={30} aria-hidden="true" /></div>
        <div className="recruitment-calendar-heading-text">
          <span className="recruitment-calendar-kicker">RMUTI KKC · RECRUITMENT CALENDAR</span>
          <h2>ปฏิทินเปิดรับสมัครงาน</h2>
          <p>เลือกวันที่เพื่อดูตำแหน่งที่รับสมัคร พร้อมกำหนดเปิด–ปิดจากประกาศในระบบจริง</p>
        </div>
        <span className="recruitment-calendar-summary"><Sparkles size={16} aria-hidden="true" />
          {openCount} ตำแหน่งที่ยังเปิดรับในเดือนนี้
        </span>
      </header>
      <div className="recruitment-calendar-layout">
        <div className="recruitment-month-panel">
          <div className="recruitment-month-header">
            <div>
              <small>ปฏิทินประจำเดือน</small>
              <h3>{monthNames[displayed.month-1]} {displayed.year+543}</h3>
            </div>
            <div className="recruitment-month-controls" role="group" aria-label="เลื่อนเดือน">
              <button type="button" onClick={() => goMonth(-1)} disabled={monthOffset<=-36}
                aria-label="เดือนก่อนหน้า"><ChevronLeft size={21} /></button>
              <button type="button" onClick={() => {setMonthOffset(0);setChosenDay(null);}}
                className="recruitment-month-today">เดือนปัจจุบัน</button>
              <button type="button" onClick={() => goMonth(1)} disabled={monthOffset>=36}
                aria-label="เดือนถัดไป"><ChevronRight size={21} /></button>
            </div>
          </div>
          <div className="recruitment-calendar-grid" role="group" aria-label={`วันที่ในเดือน${monthNames[displayed.month-1]}`}>
            {weekdays.map((name,i) => (
              <span key={name} className={i===0?"recruitment-weekday is-sunday":"recruitment-weekday"}>{name}</span>
            ))}
            {days.map((day,i) => {
              if (day === null) return <span key={`blank-${i}`} className="recruitment-day-empty" aria-hidden="true" />;
              const key = calendarDateKey(displayed.year,displayed.month,day);
              const related = jobsOnCalendarDay(monthJobs,key);
              const isActive = day === activeDay;
              const isToday = key === todayKey;
              const stillAccepting = related.some(j=>["open","closing"].includes(recruitmentPhase(j,currentTime)));
              const hasUpcoming = related.some(j=>recruitmentPhase(j,currentTime)==="upcoming");
              return (
                <button type="button" key={day}
                  className={["recruitment-day",related.length?"has-jobs":"",isActive?"is-selected":"",isToday?"is-today":"",stillAccepting?"is-open":"",!stillAccepting&&hasUpcoming?"is-upcoming":""].filter(Boolean).join(" ")}
                  aria-pressed={isActive}
                  aria-label={`วันที่ ${day} ${monthNames[displayed.month-1]} ${displayed.year+543} ${related.length} ตำแหน่ง`}
                  onClick={() => setChosenDay(isActive ? null : day)}>
                  <span className="recruitment-day-number">{day}</span>
                  {related.length > 0 && <span className="recruitment-day-count">{related.length}</span>}
                  <span className="recruitment-day-indicators" aria-hidden="true">
                    {related.slice(0,3).map(j => (
                      <i key={j.id} className={`phase-${recruitmentPhase(j,currentTime)}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="recruitment-calendar-key">
            <span><i className="phase-open" /> เปิดรับ</span>
            <span><i className="phase-closing" /> ใกล้ปิด</span>
            <span><i className="phase-upcoming" /> เตรียมเปิด</span>
            <span><i className="phase-closed" /> ปิดแล้ว</span>
          </div>
          <p className="recruitment-calendar-footnote">วันที่แสดงตามเวลาประเทศไทย (พ.ศ.) และข้อมูลประกาศที่เผยแพร่ในระบบ</p>
        </div>

        <div className="recruitment-calendar-detail" aria-live="polite">
          <div className="recruitment-calendar-detail-head">
            <span>รายการรับสมัคร</span>
            <h3>{dayKey
              ? `วันที่ ${activeDay} ${monthNames[displayed.month-1]} ${displayed.year+543}`
              : `ตลอดเดือน${monthNames[displayed.month-1]}`}</h3>
            <p>{dayKey ? "ตำแหน่งที่อยู่ในช่วงรับสมัครของวันที่เลือก" : "เลือกช่องวันที่ในปฏิทินเพื่อดูตำแหน่งเฉพาะวัน"}</p>
          </div>
          <div className="recruitment-calendar-items">
            {listedJobs.length===0 && (
              <div className="recruitment-calendar-empty">
                <CalendarDays size={36} aria-hidden="true" />
                <strong>{dayKey?"ไม่มีตำแหน่งรับสมัครในวันที่เลือก":"ไม่มีประกาศรับสมัครในเดือนนี้"}</strong>
                <span>สามารถเลื่อนเดือนเพื่อดูประกาศอื่น ๆ ได้</span>
              </div>
            )}
            {listedJobs.map(job=>{
              const phase=recruitmentPhase(job,currentTime);
              return (
                <article key={job.id} className={`recruitment-calendar-job phase-${phase}`}>
                  <div className="recruitment-calendar-job-meta">
                    <span className={`recruitment-calendar-job-state phase-${phase}`}>{phaseLabels[phase]}</span>
                    <span className="recruitment-calendar-vacancies"><BriefcaseBusiness size={14}/> {job.vacancies} อัตรา</span>
                  </div>
                  <h4>{job.title}</h4>
                  {job.departments?.name && <p><MapPin size={14} aria-hidden="true" />{job.departments.name}</p>}
                  <div className="recruitment-calendar-job-bottom">
                    <small><Clock3 size={14} aria-hidden="true" />{dateTH(job.recruitment_rounds.opens_at)} – {dateTH(job.recruitment_rounds.closes_at)}</small>
                    <Link to={`/jobs/${job.id}`}>รายละเอียด <ArrowRight size={15}/></Link>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="recruitment-calendar-detail-note">
            โปรดอ่านคุณสมบัติ วิธีสมัคร และวันสิ้นสุดตามประกาศของแต่ละตำแหน่งก่อนสมัคร
          </div>
        </div>
      </div>
    </section>
  );
}
