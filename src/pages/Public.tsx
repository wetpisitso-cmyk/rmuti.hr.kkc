import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  UserRound,
  FileCheck2,
  BriefcaseBusiness,
  CalendarDays,
  Building2,
  ChevronRight,
  FileText,
  GraduationCap,
  Users,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { rows } from "../services/api";
import { useCatalog } from "../hooks/useCatalog";
import { dateTH, money, numberTH, safeUrl } from "../lib/format";
import { State, Title, Select, Notice } from "../components/UI";
import type { Announcement, Job, PublishedResult } from "../types/models";
import { outcomeLabels } from "../types/models";
export function jobState(j: Job) {
  if (
    !j.recruitment_rounds ||
    j.archived ||
    j.recruitment_rounds.archived ||
    !j.published ||
    !j.recruitment_rounds.published
  )
    return "closed";
  const now = Date.now();
  return now < new Date(j.recruitment_rounds.opens_at).getTime()
    ? "upcoming"
    : now > new Date(j.recruitment_rounds.closes_at).getTime()
      ? "closed"
      : "open";
}
function JobCard({ job: j }: { job: Job }) {
  const s = jobState(j);
  return (
    <article className="job-card">
      <div className="card-top">
        <span className={`category ${j.category}`}>
          {j.category === "academic" ? (
            <GraduationCap size={15} />
          ) : (
            <BriefcaseBusiness size={15} />
          )}{" "}
          {j.category === "academic" ? "สายวิชาการ" : "สายสนับสนุน"}
        </span>
        <span className={`badge ${s}`}>
          {s === "open"
            ? "เปิดรับสมัคร"
            : s === "upcoming"
              ? "เตรียมเปิดรับ"
              : "ปิดรับสมัคร"}
        </span>
      </div>
      <small className="job-type">{j.employment_type}</small>
      <h3>{j.title}</h3>
      <p>
        <Building2 size={16} />
        {j.departments?.name}
      </p>
      <p>
        <CalendarDays size={16} />
        {dateTH(j.recruitment_rounds.opens_at)} –{" "}
        {dateTH(j.recruitment_rounds.closes_at)}
      </p>
      <div className="job-card-bottom">
        <span>
          <strong>{j.vacancies}</strong> อัตรา
        </span>
        <Link to={`/jobs/${j.id}`}>
          ดูรายละเอียด <ArrowRight size={17} />
        </Link>
      </div>
    </article>
  );
}
export function Home() {
  const { jobs, departments } = useCatalog();
  const [category, setCategory] = useState("all"),
    [department, setDepartment] = useState(""),
    [employment, setEmployment] = useState(""),
    [state, setState] = useState("all");
  const list = (jobs.data || []).filter(
    (j) =>
      j.published &&
      !j.archived &&
      j.recruitment_rounds?.published &&
      !j.recruitment_rounds.archived &&
      (!department || j.department_id === department) &&
      (!employment || j.employment_type === employment) &&
      (category === "all" || j.category === category) &&
      (state === "all" || jobState(j) === state),
  );
  const news = useQuery({
    queryKey: ["announcements", "home"],
    queryFn: () => rows<Announcement>("announcements", "*", "created_at", 3),
  });
  const open = (jobs.data || []).filter(
    (j) =>
      j.published && j.recruitment_rounds?.published && jobState(j) === "open",
  );
  return (
    <div className="rmuti-apple-home">
      <div className="hero">
        <div className="container hero-inner">
          <div>
            <div className="hero-tag">
              <span /> RMUTI KHON KAEN · RECRUITMENT
            </div>
            <h1>
              โอกาสใหม่
              <br />
              <span>เริ่มต้นที่นี่</span>
            </h1>
            <h2 className="hero-subtitle">ระบบรับสมัครบุคลากรออนไลน์</h2>
            <p>มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น</p>
            <p className="hero-support-copy">ร่วมเป็นส่วนหนึ่งในการขับเคลื่อนการศึกษา นวัตกรรม และพัฒนาสังคม ไปกับ มทร.อีสาน วิทยาเขตขอนแก่น</p>
            <div className="hero-actions">
              <a href="#positions" className="btn primary">
                <BriefcaseBusiness size={18} /> ดูตำแหน่งที่เปิดรับ <ArrowRight size={18} />
              </a>
              <Link className="btn hero-outline" to="/login">
                <UserRound size={18}/> เข้าสู่ระบบ
              </Link>
            </div>
            <div className="hero-caption">
              <ShieldCheck size={15}/> สมัครสมาชิก · กรอกข้อมูล · ติดตามผลได้ในที่เดียว
            </div>
          </div>
          <div className="campus-visual">
            <div className="campus-photo-frame">
              <img
                src={`${import.meta.env.BASE_URL}rmuti-building.webp`}
                alt="อาคารมหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น"
                loading="eager"
                decoding="async"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <div className="campus-photo-quote" aria-hidden="true">สร้างคน<br/>สร้างเทคโนโลยี<br/>สร้างสังคมที่ยั่งยืน</div>
              <div className="campus-photo-caption">
                <span className="campus-photo-dot" />
                <div><strong>RMUTI KHON KAEN</strong><small>มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน</small></div>
              </div>
            </div>
            <div className="campus-floating-stats" aria-label="สถิติการเปิดรับสมัคร">
              <div><BriefcaseBusiness size={19}/><span><strong>{numberTH(open.length)}</strong><small>ตำแหน่งเปิดรับ</small></span></div>
              <div><Users size={19}/><span><strong>{numberTH(open.reduce((n, j) => n + j.vacancies, 0))}</strong><small>อัตราที่เปิดรับ</small></span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="container home-stats-strip" aria-label="สรุปตำแหน่งเปิดรับสมัคร">
        <div className="home-stat-pill"><span className="home-stat-icon orange"><BriefcaseBusiness size={22}/></span><div><strong>{numberTH(open.length)}</strong><small>ตำแหน่งที่เปิดรับ</small></div><ChevronRight size={16}/></div>
        <div className="home-stat-pill"><span className="home-stat-icon navy"><Users size={22}/></span><div><strong>{numberTH(open.reduce((sum, j) => sum + j.vacancies, 0))}</strong><small>อัตราที่เปิดรับ</small></div><ChevronRight size={16}/></div>
        <div className="home-stat-pill"><span className="home-stat-icon green"><CalendarDays size={22}/></span><div><strong>{open.length ? "เปิดรับสมัครอยู่" : "ตรวจสอบรอบรับสมัคร"}</strong><small>{open.length ? "สมัครได้ตามช่วงเวลาที่ประกาศ" : "ติดตามประกาศใหม่"}</small></div></div>
      </div>
      <div className="home-feature-strip">
        <div className="container home-feature-grid">
          <div className="home-feature">
            <span className="home-feature-icon"><Users size={22} /></span>
            <div><h3>สมัครสมาชิกและยื่นใบสมัคร</h3><p>กรอกข้อมูลและแนบเอกสารผ่านระบบออนไลน์</p></div>
          </div>
          <div className="home-feature">
            <span className="home-feature-icon"><FileText size={22} /></span>
            <div><h3>ติดตามสถานะใบสมัคร</h3><p>ตรวจความคืบหน้าและเลขผู้สมัครจากบัญชีของคุณ</p></div>
          </div>
          <div className="home-feature">
            <span className="home-feature-icon"><CalendarDays size={22} /></span>
            <div><h3>ประกาศและผลคัดเลือก</h3><p>อ่านกำหนดการและผลประกาศจากมหาวิทยาลัย</p></div>
          </div>
        </div>
      </div>
      <div className="container section home-content-sections" id="positions">
        <section className="home-content-frame home-openings-frame" aria-label="ค้นหาตำแหน่งที่เปิดรับสมัคร">
        <Title
          eyebrow="OPEN POSITIONS"
          title="ตำแหน่งที่เปิดรับสมัคร"
          description="ตรวจคุณสมบัติและกำหนดการตามประกาศแต่ละตำแหน่ง"
        />
        <div className="filter-card home-filter-card">
          <div className="tabs">
            {[
              ["all", "ทั้งหมด"],
              ["academic", "สายวิชาการ"],
              ["support", "สายสนับสนุน"],
            ].map(([v, l]) => (
              <button
                key={v}
                className={category === v ? "active" : ""}
                onClick={() => setCategory(v)}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="filter-grid">
            <Select
              label="หน่วยงาน"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">ทุกหน่วยงาน</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Select
              label="ประเภทการจ้าง"
              value={employment}
              onChange={(e) => setEmployment(e.target.value)}
            >
              <option value="">ทุกประเภท</option>
              {[...new Set(jobs.data?.map((j) => j.employment_type))].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </Select>
            <Select
              label="สถานะรับสมัคร"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="all">ทุกสถานะ</option>
              <option value="open">เปิดรับสมัคร</option>
              <option value="upcoming">เตรียมเปิดรับ</option>
              <option value="closed">ปิดรับสมัคร</option>
            </Select>
          </div>
        </div>
        </section>
        <section className="home-content-frame home-results-frame" aria-label="รายการตำแหน่งรับสมัคร">
          <div className="home-results-heading">
            <div><span className="eyebrow">AVAILABLE JOBS</span><h2>รายการตำแหน่งรับสมัคร</h2></div>
            <span className="section-count" aria-live="polite">พบ {list.length} ตำแหน่ง</span>
          </div>
        <State loading={jobs.isPending} error={jobs.error} empty={!list.length}>
          <div className="job-grid">
            {list.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        </State>
        </section>
        <section className="home-content-frame home-news-frame" aria-label="ประกาศและข่าวสาร">
        <Title
          eyebrow="LATEST NEWS"
          title="ประกาศและข่าวสาร"
          action={
            <Link className="text-link" to="/announcements">
              ดูทั้งหมด <ChevronRight size={18} />
            </Link>
          }
        />
        <State
          loading={news.isPending}
          error={news.error}
          empty={!news.data?.length}
        >
          <div className="news-grid">
            {news.data
              ?.filter((n) => n.published)
              .map((n) => (
                <article className="news-card" key={n.id}>
                  <FileText />
                  <small>{dateTH(n.created_at)}</small>
                  <h3>{n.title}</h3>
                  <p>{n.content.slice(0, 150)}</p>
                  {safeUrl(n.attachment_url) && (
                    <a
                      className="text-link"
                      href={safeUrl(n.attachment_url)!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      อ่านเอกสาร <ArrowRight size={16} />
                    </a>
                  )}
                </article>
              ))}
          </div>
        </State>
        </section>
      </div>
      <section className="container home-steps-section home-content-frame home-howto-frame">
        <div className="home-steps-heading">
          <div><span className="eyebrow">HOW TO APPLY</span><h2>ขั้นตอนการสมัคร</h2><p>สมัครออนไลน์และติดตามสถานะได้ง่ายในบัญชีของคุณ</p></div>
          <Link className="text-link" to="/guide">ดูรายละเอียดขั้นตอน <ArrowRight size={16}/></Link>
        </div>
        <div className="home-steps-grid">
          {[
            { icon: UserRound, title:"สมัครสมาชิก", info:"สร้างบัญชีด้วยอีเมลและรหัสผ่าน" },
            { icon: FileText, title:"กรอกใบสมัคร", info:"บันทึกข้อมูลและแนบเอกสารตามประกาศ" },
            { icon: FileCheck2, title:"ติดตามสถานะ", info:"Admin ตรวจใบสมัครและกำหนดเลขผู้สมัคร" },
            { icon: CheckCircle2, title:"เข้าสอบ / สัมภาษณ์", info:"ติดตามประกาศวันเวลาและผลการคัดเลือก" },
          ].map((step, index) => {
            const StepIcon=step.icon;
            return <div className="home-step" key={step.title}>
              <span className="home-step-number">{index+1}</span>
              <StepIcon size={23}/>
              <div><h3>{step.title}</h3><p>{step.info}</p></div>
            </div>;
          })}
        </div>
      </section>
    </div>
  );
}
export function JobDetail() {
  const { id } = useParams();
  const { jobs } = useCatalog();
  const j = jobs.data?.find((j) => j.id === id);
  return (
    <div className="container section">
      <Link className="breadcrumb" to="/">
        ตำแหน่งเปิดรับ <ChevronRight size={16} /> รายละเอียดตำแหน่ง
      </Link>
      <State
        loading={jobs.isPending}
        error={
          jobs.error || (!jobs.isPending && !j ? new Error("NOT_FOUND") : null)
        }
      >
        {j && (
          <>
            <Title
              eyebrow={j.category === "academic" ? "สายวิชาการ" : "สายสนับสนุน"}
              title={j.title}
              description={j.departments?.name}
            />
            <div className="detail-grid">
              <div>
                <section className="panel">
                  <h2>คุณสมบัติและเงื่อนไข</h2>
                  <p className="pre-wrap">{j.qualifications}</p>
                </section>
                <section className="panel">
                  <h2>เอกสารประกอบการสมัคร</h2>
                  <ul className="document-list">
                    {j.required_documents.map((d) => (
                      <li key={d.key}>
                        <FileText size={18} />
                        {d.label}
                        <span>{d.required ? "จำเป็น" : "ถ้ามี"}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="muted">
                    PDF / JPG / PNG ไม่เกิน {j.max_file_mb} MB ต่อไฟล์
                  </p>
                </section>
                {j.fee_amount > 0 && (
                  <section className="panel">
                    <h2>ค่าธรรมเนียม {money(j.fee_amount)}</h2>
                    <p className="pre-wrap">{j.payment_instructions}</p>
                  </section>
                )}
              </div>
              <aside>
                <div className="panel sticky-summary">
                  <span className={`badge ${jobState(j)}`}>
                    {jobState(j) === "open"
                      ? "เปิดรับสมัคร"
                      : jobState(j) === "upcoming"
                        ? "เตรียมเปิดรับ"
                        : "ปิดรับสมัคร"}
                  </span>
                  <h2>รายละเอียดการรับสมัคร</h2>
                  <dl className="summary-list">
                    <dt>จำนวน</dt>
                    <dd>{j.vacancies} อัตรา</dd>
                    <dt>ประเภทการจ้าง</dt>
                    <dd>{j.employment_type}</dd>
                    <dt>เปิดรับสมัคร</dt>
                    <dd>{dateTH(j.recruitment_rounds.opens_at, true)}</dd>
                    <dt>ปิดรับสมัคร</dt>
                    <dd>{dateTH(j.recruitment_rounds.closes_at, true)}</dd>
                    <dt>ค่าธรรมเนียม</dt>
                    <dd>
                      {j.fee_amount > 0 ? money(j.fee_amount) : "ไม่เรียกเก็บ"}
                    </dd>
                  </dl>
                  {jobState(j) === "open" && (
                    <Link className="btn primary w-full" to={`/apply/${j.id}`}>
                      สมัครตำแหน่งนี้ <ArrowRight size={18} />
                    </Link>
                  )}
                  {safeUrl(j.announcement_url) && (
                    <a
                      className="btn outline w-full mt-3"
                      href={safeUrl(j.announcement_url)!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={18} /> ดาวน์โหลดประกาศ
                    </a>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </State>
    </div>
  );
}
export function Announcements() {
  const q = useQuery({
    queryKey: ["announcements"],
    queryFn: () => rows<Announcement>("announcements"),
  });
  return (
    <div className="container section">
      <Title eyebrow="ANNOUNCEMENTS" title="ข่าวและประกาศ" />
      <State loading={q.isPending} error={q.error} empty={!q.data?.length}>
        <div className="stack">
          {q.data
            ?.filter((a) => a.published)
            .map((a) => (
              <article className="panel" key={a.id}>
                <small className="muted">{dateTH(a.created_at)}</small>
                <h2>{a.title}</h2>
                <p className="pre-wrap">{a.content}</p>
                {safeUrl(a.attachment_url) && (
                  <a
                    className="btn outline small"
                    target="_blank"
                    rel="noreferrer"
                    href={safeUrl(a.attachment_url)!}
                  >
                    ดาวน์โหลดเอกสาร
                  </a>
                )}
              </article>
            ))}
        </div>
      </State>
    </div>
  );
}
export function Results() {
  const q = useQuery({
    queryKey: ["published-results"],
    queryFn: () =>
      rows<PublishedResult>("published_results", "*", "published_at"),
  });
  return (
    <div className="container section">
      <Title
        eyebrow="PUBLISHED RESULTS"
        title="ประกาศผลการคัดเลือก"
        description="รายชื่อที่ผ่านการอนุมัติให้เผยแพร่โดยเจ้าหน้าที่"
      />
      <State loading={q.isPending} error={q.error} empty={!q.data?.length}>
        {q.data?.map((r) => (
          <section className="panel" key={r.id}>
            <h2>{r.title}</h2>
            <p className="muted">เผยแพร่ {dateTH(r.published_at, true)}</p>
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
                  {r.rows.map((row) => (
                    <tr key={row.number}>
                      <td>{row.number}</td>
                      <td>{row.name}</td>
                      <td>{outcomeLabels[row.outcome] || row.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </State>
    </div>
  );
}
export function Guide() {
  const q = useQuery({
    queryKey: ["settings"],
    queryFn: () => rows("app_settings", "*", "key"),
  });
  const c = q.data?.find((x) => x.key === "contact")?.value;
  return (
    <div className="container section">
      <Title eyebrow="APPLICANT GUIDE" title="เริ่มสมัครได้ใน 5 ขั้นตอน" />
      <div className="steps-guide">
        {[
          ["01", "สร้างบัญชี", "ใช้อีเมลและรหัสผ่านอย่างน้อย 8 ตัวอักษร"],
          ["02", "กรอกข้อมูล", "ข้อมูลส่วนตัว การศึกษา และประสบการณ์"],
          ["03", "แนบเอกสาร", "อัปโหลดเอกสารบังคับให้ครบตามประกาศ"],
          ["04", "ยืนยันใบสมัคร", "ตรวจทานและส่งใบสมัคร รอ Admin ตรวจและออกเลขผู้สมัคร"],
          ["05", "ติดตามผล", "ดูสถานะ แก้ไขเอกสาร และดาวน์โหลดบัตรสอบ"],
        ].map(([n, t, d]) => (
          <div className="panel" key={n}>
            <strong className="step-number">{n}</strong>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </div>
      <div className="detail-grid">
        <section className="panel">
          <h2>คำถามที่พบบ่อย</h2>
          {[
            [
              "ลืมรหัสผ่านทำอย่างไร?",
              "เลือก “ลืมรหัสผ่าน” กรอกอีเมล แล้วเปิดลิงก์ตั้งรหัสผ่านใหม่ในอีเมล",
            ],
            [
              "แก้ใบสมัครหลังส่งได้ไหม?",
              "แก้ได้เมื่อเจ้าหน้าที่แจ้งให้แก้ไข และอยู่ภายในกำหนดเวลาที่แจ้ง",
            ],
            [
              "ไม่พบอีเมลรับใบสมัครต้องส่งใหม่ไหม?",
              "ไม่ต้องส่งใหม่ หากมีเลขผู้สมัครแล้ว ให้ติดตามสถานะจากใบสมัครของฉัน",
            ],
            [
              "ใช้มือถือสมัครได้ไหม?",
              "ใช้ได้ทั้งมือถือ แท็บเล็ต และคอมพิวเตอร์ โดยเตรียมไฟล์เอกสารให้พร้อม",
            ],
            [
              "สลิปอัปโหลดแล้วถือว่าชำระสำเร็จไหม?",
              "สถานะจะเป็นรอตรวจจนกว่าเจ้าหน้าที่ตรวจและยืนยัน",
            ],
          ].map(([a, b]) => (
            <details key={a}>
              <summary>{a}</summary>
              <p>{b}</p>
            </details>
          ))}
        </section>
        <section className="panel">
          <h2>ติดต่อหน่วยงาน</h2>
          <State loading={q.isPending} error={q.error}>
            <p>
              <Users size={18} /> {c?.department}
            </p>
            <p>
              <MapPin size={18} /> {c?.address}
            </p>
            <p>
              <CalendarDays size={18} /> {c?.hours}
            </p>
            {c?.phone && (
              <p>
                <Phone size={18} /> {c.phone}
              </p>
            )}
            {c?.email && (
              <p>
                <Mail size={18} /> {c.email}
              </p>
            )}
            {!c?.phone && !c?.email && (
              <Notice>ช่องทางโทรศัพท์และอีเมลจะประกาศโดยผู้ดูแลระบบ</Notice>
            )}
          </State>
        </section>
      </div>
    </div>
  );
}
