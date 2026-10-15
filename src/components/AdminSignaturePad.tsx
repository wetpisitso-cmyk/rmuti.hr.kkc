import { useRef, useState, type PointerEvent } from "react";
import { rpc } from "../services/api";
import { dateTH } from "../lib/format";
import { errorTH } from "../lib/errors";
import { Notice } from "./UI";

export type AdminSignature = {
  application_id: string;
  signer_id: string;
  signed_at: string;
  signature_png: string;
  application_number_at_signing: string;
  signed_snapshot_md5: string;
};
export function AdminSignaturePad({ applicationId, existing, eligible, refresh }: {
  applicationId: string; existing: AdminSignature | null; eligible: boolean; refresh: () => Promise<unknown>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [revision, setRevision] = useState(0);
  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - box.left) * 600 / box.width, y: (e.clientY - box.top) * 220 / box.height };
  };
  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!eligible || existing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.strokeStyle = "#102d55";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasInk.current = true;
  };
  const stop = () => { drawing.current = false; };
  const clear = () => {
    canvas.current?.getContext("2d")?.clearRect(0, 0, 600, 220);
    hasInk.current = false;
    setRevision(x => x + 1);
    setError("");
  };
  const sign = async () => {
    if (!eligible || !confirm || !hasInk.current || !canvas.current || existing) return;
    setBusy(true); setError("");
    try {
      const image = canvas.current.toDataURL("image/png");
      await rpc("admin_sign_application", { p_id: applicationId, p_signature_png: image, p_confirm: true });
      await refresh();
    } catch (e) { setError(errorTH(e)); }
    finally { setBusy(false); }
  };
  return <section className="panel stack no-print" id="admin-signature">
    <h2>ลายเซ็นรับรองใบสมัคร (เฉพาะ Admin)</h2>
    <p className="muted">ลายเซ็นนี้ใช้รับรองการตรวจใบสมัครในระบบ ไม่ใช่ลายเซ็นดิจิทัลแบบใบรับรอง PKI</p>
    {error && <Notice kind="error">{error}</Notice>}
    {existing ? <div className="admin-signature-approved">
      <img src={existing.signature_png} alt="ลายเซ็นที่ Admin ลงไว้" />
      <strong>รับรองแล้วโดยแอดมิน</strong>
      <span>ลงนามเมื่อ {dateTH(existing.signed_at, true)} · ไม่สามารถลงนามซ้ำได้</span>
    </div> : !eligible ? <Notice>ต้องผ่านคุณสมบัติ มีเลขผู้สมัคร และยืนยันค่าธรรมเนียม (ถ้ามี) ก่อนเซ็นรับรอง</Notice> :
      <>
        <canvas key={revision} className="admin-signature-canvas" ref={canvas} width={600} height={220} style={{touchAction:"none"}}
          onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}
          aria-label="วาดลายเซ็นแอดมินด้วยเมาส์ นิ้ว หรือปากกา"/>
        <button type="button" className="btn outline small" onClick={clear} disabled={busy}>ล้างลายเซ็น</button>
        <label className="flex gap-2"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>
          <span>ข้าพเจ้าเป็น Admin และยืนยันว่าได้ตรวจใบสมัครนี้แล้ว การลงนามจะบันทึกประวัติถาวร</span>
        </label>
        <button type="button" className="btn primary" disabled={busy || !confirm} onClick={()=>void sign()}>
          {busy ? "กำลังบันทึก…" : "ยืนยันเซ็นรับรองใบสมัคร"}
        </button>
      </>}
  </section>;
}
