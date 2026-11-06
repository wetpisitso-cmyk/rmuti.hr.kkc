import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight,
  Clock3, MapPin, Users, Timer, CheckCircle2,
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
  const activeDay = chosenDay !== null && chosenDay <= new Date(Date.UTC(displayed.year,displayed.month,0)).getUTCDate()
    ? chosenDay : null;
  const dayKey = activeDay === null ? null : calendarDateKey(displayed.year, displayed.month, activeDay);
  const dayJobs = dayKey ? jobsOnCalendarDay(monthJobs, dayKey) : [];
  const listedJobs = dayKey ? dayJobs : monthJobs;
  const currentTime = Date.now();
  const openCount = monthJobs.filter(j => ["open","closing"].includes(recruitmentPhase(j,currentTime))).length;
  const closingCount = monthJobs.filter(j => recruitmentPhase(j,currentTime)==="closing").length;
  const monthVacancies = monthJobs.reduce((sum,j)=>sum+j.vacancies,0);
  const monthName = monthNames[displayed.month-1];

  const goMonth = (delta: number) => {
    setMonthOffset(value => Math.max(-36,Math.min(36,value + delta)));
    setChosenDay(null);
  };

  return (
    <section className="recruitment-calendar-section recruitment-calendar-style-b container" id="recruitment-calendar"
      aria-label="ปฏิทินรับสมัครงานรายเดือน">
      <header className="recruitment-calendar-b-hero">
        <div className="recruitment-calendar-b-hero-content">
          <span className="recruitment-calendar-heading-icon"><CalendarDays size={32} aria-hidden="true" /></span>
          <div className="recruitment-calendar-heading-text">
            <span className="recruitment-calendar-kicker">RMUTI KKC · RECRUITMENT CALENDAR</span>
            <h2>ปฏิทิน<span className="recruitment-calendar-title-accent">รับสมัครงาน</span></h2>
            <p>ตรวจสอบช่วงเวลารับสมัคร เลือกวันที่ และดูรายละเอียดตำแหน่งงานได้ทันที</p>
          </div>
        </div>
        <CalendarDays className="recruitment-calendar-b-hero-art" size={116} strokeWidth={1.4} aria-hidden="true" />
      </header>
      <div className="recruitment-calendar-b-overview" aria-label={`สถิติรับสมัครเดือน${monthName} ${displayed.year+543}`}>
        <div className="recruitment-calendar-b-stat is-primary">
          <span className="recruitment-calendar-b-stat-icon"><BriefcaseBusiness size={25} /></span>
          <span><small>ตำแหน่งในเดือนนี้</small><strong>{monthJobs.length} <em>ตำแหน่ง</em></strong></span>
        </div>
        <div className="recruitment-calendar-b-stat">
          <span className="recruitment-calendar-b-stat-icon"><Users size={25} /></span>
          <span><small>รวมจำนวนอัตรา</small><strong>{monthVacancies} <em>อัตรา</em></strong></span>
        </div>
        <div className="recruitment-calendar-b-stat">
          <span className="recruitment-calendar-b-stat-icon is-green"><CheckCircle2 size={25} /></span>
          <span><small>กำลังเปิดรับ</small><strong>{openCount} <em>ตำแหน่ง</em></strong></span>
        </div>
        <div className="recruitment-calendar-b-stat">
          <span className="recruitment-calendar-b-stat-icon is-orange"><Timer size={25} /></span>
          <span><small>ใกล้ปิดรับสมัคร</small><strong>{closingCount} <em>ตำแหน่ง</em></strong></span>
        </div>
      </div>
      <div className="recruitment-calendar-layout">
        <div className="recruitment-month-panel">
          <div className="recruitment-month-header">
            <div>
              <small>ปฏิทินการรับสมัคร · เดือนที่เลือก</small>
              <h3><CalendarDays size={21} aria-hidden="true" /> {monthName} {displayed.year+543}</h3>
            </div>
            <div className="recruitment-month-controls" role="group" aria-label="เลื่อนเดือน">
              <button type="button" onClick={() => goMonth(-1)} disabled={monthOffset<=-36}
                aria-label="เดือนก่อนหน้า"><ChevronLeft size={21} /></button>
              <button type="button" onClick={() => {setMonthOffset(0);setChosenDay(null);}}
                className="recruitment-month-today">กลับเดือนเริ่มต้น</button>
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
          <div className="recruitment-calendar-b-day-hint">
            <CalendarDays size={16} aria-hidden="true" />
            แตะวันที่เพื่อดูรายการรับสมัคร · แตะวันที่เดิมอีกครั้งเพื่อดูทั้งเดือน
          </div>
        </div>

        <div className="recruitment-calendar-detail" aria-live="polite">
          <div className="recruitment-calendar-detail-head">
            <span className="recruitment-calendar-detail-head-icon"><CalendarDays size={26} aria-hidden="true" /></span>
            <div>
              <span>รายการเปิดรับสมัคร</span>
              <h3>{dayKey
                ? `วันที่ ${activeDay} ${monthName} ${displayed.year+543}`
                : `ประจำเดือน${monthName} ${displayed.year+543}`}</h3>
              <p>{dayKey
                ? `พบ ${listedJobs.length} ตำแหน่งในวันที่เลือก`
                : `รวม ${listedJobs.length} ตำแหน่ง · เลือกวันที่เพื่อดูเฉพาะวัน`}</p>
            </div>
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
                  <div className="recruitment-calendar-job-title">
                    <span className="recruitment-calendar-job-icon"><BriefcaseBusiness size={20} aria-hidden="true" /></span>
                    <h4>{job.title}</h4>
                  </div>
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
            โปรดตรวจสอบคุณสมบัติและวันปิดรับสมัครจากประกาศของแต่ละตำแหน่ง
          </div>
        </div>
      </div>
      <footer className="recruitment-calendar-b-footer">
        <strong className="recruitment-calendar-b-footer-title">สัญลักษณ์สถานะ</strong>
        <div className="recruitment-calendar-key" aria-label="คำอธิบายสีสถานะ">
          <span><i className="phase-open" /> เปิดรับสมัคร</span>
          <span><i className="phase-closing" /> ใกล้ปิดรับ</span>
          <span><i className="phase-upcoming" /> เตรียมเปิด</span>
          <span><i className="phase-closed" /> ปิดรับแล้ว</span>
        </div>
        <p className="recruitment-calendar-footnote">แสดงตามเวลาประเทศไทยและข้อมูลประกาศรับสมัครจริง (พ.ศ.)</p>
      </footer>
    </section>
  );
}
