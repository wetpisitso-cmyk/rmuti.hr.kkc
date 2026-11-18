import { useEffect, useRef, useState } from "react";
import { ExternalLink, MapPinned, Maximize2, Minus, Plus, X } from "lucide-react";

const CAMPUS_MAP_URL = `${import.meta.env.BASE_URL}campus-map-kkc.png`;
const SOURCE_URL = "https://drive.google.com/file/d/1xXPtBOuDNaiIxtbHWZPnlgcq-CSW8Fbc/view?usp=sharing";
const MAP_ALT = "แผนผังอาคารมหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น พร้อมหมายเลขอาคาร";

export default function CampusMap() {
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mapViewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      openButtonRef.current?.focus();
    };
  }, [expanded]);

  const changeZoom = (direction: 1 | -1) => {
    setZoom(previous => Math.min(2.5, Math.max(0.75, Math.round((previous + direction * 0.25) * 100) / 100)));
  };

  const openMap = () => {
    setZoom(1);
    setExpanded(true);
  };

  return (
    <section className="container campus-map-section" aria-labelledby="campus-map-title">
      <div className="campus-map-card">
        <div className="campus-map-heading">
          <div className="campus-map-label">
            <span className="campus-map-kicker"><MapPinned size={16} aria-hidden="true" /> RMUTI KHON KAEN · CAMPUS MAP</span>
            <h2 id="campus-map-title">แผนผังมหาวิทยาลัย วิทยาเขตขอนแก่น</h2>
            <p>ดูตำแหน่งอาคารและจุดสำคัญภายในมหาวิทยาลัย กดที่ภาพเพื่อขยายและดูรายละเอียดได้อย่างชัดเจน</p>
          </div>
          <button ref={openButtonRef} type="button" className="campus-map-action" onClick={openMap}>
            <Maximize2 size={18} aria-hidden="true" /> ดูแผนผังขนาดใหญ่
          </button>
        </div>
        <button type="button" className="campus-map-preview" onClick={openMap} aria-label="กดเพื่อเปิดภาพแผนผังมหาวิทยาลัยขนาดใหญ่">
          <img src={CAMPUS_MAP_URL} alt={MAP_ALT} loading="lazy" decoding="async" />
          <span className="campus-map-preview-hint"><Maximize2 size={17} aria-hidden="true" /> กดเพื่อขยายภาพ</span>
        </button>
        <div className="campus-map-caption">
          <span>แผนผังอาคารมหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น</span>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">ดูไฟล์ต้นฉบับ <ExternalLink size={14} aria-hidden="true" /></a>
        </div>
      </div>

      {expanded && (
        <div className="campus-map-modal" role="presentation">
          <div className="campus-map-overlay" onClick={() => setExpanded(false)} aria-hidden="true" />
          <div className="campus-map-dialog" role="dialog" aria-modal="true" aria-labelledby="campus-map-dialog-title">
            <header className="campus-map-dialog-header">
              <div>
                <strong id="campus-map-dialog-title">แผนผังมหาวิทยาลัย วิทยาเขตขอนแก่น</strong>
                <small>เลื่อนภาพเพื่ออ่านหมายเลขอาคาร ใช้ปุ่ม + และ − เพื่อขยายหรือย่อ</small>
              </div>
              <button ref={closeButtonRef} type="button" className="campus-map-icon-btn campus-map-close" onClick={() => setExpanded(false)} aria-label="ปิดภาพแผนผัง">
                <X size={22} aria-hidden="true" />
              </button>
            </header>
            <div className="campus-map-toolbar" role="group" aria-label="เครื่องมือดูภาพแผนผัง">
              <button type="button" className="campus-map-icon-btn" onClick={() => changeZoom(-1)} disabled={zoom <= 0.75} aria-label="ย่อภาพ">
                <Minus size={18} aria-hidden="true" />
              </button>
              <output aria-live="polite">{Math.round(zoom * 100)}%</output>
              <button type="button" className="campus-map-icon-btn" onClick={() => changeZoom(1)} disabled={zoom >= 2.5} aria-label="ขยายภาพ">
                <Plus size={18} aria-hidden="true" />
              </button>
              <button type="button" className="campus-map-reset-btn" onClick={() => { setZoom(1); mapViewerRef.current?.scrollTo({top:0,left:0}); }}>
                คืนค่าขนาด
              </button>
              <a className="campus-map-open-original" href={CAMPUS_MAP_URL} target="_blank" rel="noopener noreferrer">
                เปิดภาพเต็ม <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>
            <div ref={mapViewerRef} className="campus-map-viewer" role="region" aria-label="ภาพแผนผังขนาดใหญ่ที่สามารถเลื่อนดูได้" tabIndex={0}>
              <img
                src={CAMPUS_MAP_URL}
                alt={MAP_ALT}
                style={{ width: `${Math.round(1333 * zoom)}px` }}
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
