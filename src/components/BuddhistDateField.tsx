import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

// Keep Buddhist Era years visible even when the browser uses Gregorian date inputs.
const pad = (n: number) => String(n).padStart(2, "0");
const normalizeThaiDigits = (s: string) => s.replace(/[๐-๙]/g, d => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d)));
const thaiMonths = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function buddhistToISO(value: string): string | null {
  if (!value.trim()) return "";
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalizeThaiDigits(value.trim()));
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearBE = Number(match[3]);
  const year = yearBE - 543;
  if (yearBE < 2400 || yearBE > 2800 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return String(year) + "-" + pad(month) + "-" + pad(day);
}

export function BuddhistDateField({
  label, value, onChange, invalid, required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  required?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const selected = buddhistToISO(value);
  useEffect(() => { inputRef.current?.setCustomValidity(invalid ? "กรุณากรอกวันที่ พ.ศ. ให้ถูกต้อง" : ""); }, [invalid]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const changeMonth = (delta: number) => {
    const date = new Date(year, month + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
  };
  const choose = (day: number) => {
    onChange(pad(day) + "/" + pad(month + 1) + "/" + String(year + 543));
    setOpen(false);
  };
  const offset = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  const arrowStyle = {
    border: "1px solid #dfe5ef", borderRadius: 8, background: "#fff",
    padding: "5px 7px", display: "grid", placeItems: "center", color: "#102d55",
  } as const;

  return (
    <div className="field" ref={root}>
      <label htmlFor={id}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(event) => { event.currentTarget.setCustomValidity(""); onChange(event.target.value); }}
          required={required}
          pattern="[0-9๐-๙]{1,2}/[0-9๐-๙]{1,2}/[0-9๐-๙]{4}"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder="วว/ดด/พ.ศ."
          aria-invalid={invalid || undefined}
          style={{ paddingRight: 44, borderColor: invalid ? "#b42318" : undefined }}
        />
        <button
          type="button"
          aria-label={"เปิดปฏิทิน" + label}
          aria-expanded={open}
          onClick={() => {
            if (!open && selected) {
              const [selectedYear, selectedMonth] = selected.split("-").map(Number);
              setYear(selectedYear);
              setMonth(selectedMonth - 1);
            }
            setOpen((current) => !current);
          }}
          style={{
            position: "absolute", right: 7, top: "50%",
            transform: "translateY(-50%)", ...arrowStyle,
          }}
        >
          <CalendarDays size={18} />
        </button>
        {open && (
          <div
            role="dialog"
            aria-label={"ปฏิทิน" + label}
            style={{
              position: "absolute", right: 0, top: "calc(100% + 6px)",
              zIndex: 60, width: "min(300px, calc(100vw - 50px))",
              padding: 12, background: "#fff", border: "1px solid #dfe5ef",
              borderRadius: 12, boxShadow: "0 12px 34px #102d5530",
            }}
          >
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between", marginBottom: 9,
            }}>
              <button type="button" aria-label="เดือนก่อนหน้า" onClick={() => changeMonth(-1)} style={arrowStyle}>
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontWeight: 700 }}>{thaiMonths[month]}</span>
              <select aria-label="ปี พ.ศ." value={year + 543} onChange={e => setYear(Number(e.target.value) - 543)} style={{ width: 84, padding: 4, fontSize: 13, border: "1px solid #dfe5ef", borderRadius: 6 }}>
                {Array.from({length:401},(_,i)=>2800-i).map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button type="button" aria-label="เดือนถัดไป" onClick={() => changeMonth(1)} style={arrowStyle}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 3, textAlign: "center",
            }}>
              {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((day, index) => (
                <span key={index} style={{ color: "#64748b", fontSize: 12 }}>{day}</span>
              ))}
              {cells.map((day, index) => {
                if (!day) return <span key={index} />;
                const iso = String(year) + "-" + pad(month + 1) + "-" + pad(day);
                const active = selected === iso;
                return (
                  <button
                    key={index}
                    type="button"
                    aria-label={String(day) + " " + thaiMonths[month] + " " + String(year + 543)}
                    aria-pressed={active}
                    onClick={() => choose(day)}
                    style={{
                      border: 0, borderRadius: 8, minHeight: 34,
                      background: active ? "#f47721" : "transparent",
                      color: active ? "#fff" : "#102d55",
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div style={{
              marginTop: 10, display: "flex",
              justifyContent: "space-between", alignItems: "center",
            }}>
              <small style={{ color: "#64748b" }}>ปีพุทธศักราช (พ.ศ.)</small>
              <button
                type="button"
                className="btn outline small"
                onClick={() => { onChange(""); setOpen(false); }}
              >
                ล้างวันที่
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
