import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { dateTH, money, printPage } from "../lib/format";
import { State, Notice } from "../components/UI";
import { ArrowLeft, Printer } from "lucide-react";

type Receipt = {
  id: string;
  application_id: string;
  receipt_number: string;
  amount: number;
  paid_at: string;
  issued_at: string;
  details: {
    issuer?: string;
    payer?: string;
    job_title?: string;
    department?: string;
    application_number?: string;
    payment_reference?: string;
    bank_name?: string;
    account_name?: string;
    account_number?: string;
  };
};

export default function PaymentReceipt() {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["payment-receipt", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_receipts")
        .select("id,application_id,receipt_number,amount,paid_at,issued_at,details")
        .eq("application_id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Receipt | null;
    },
  });
  const r = q.data;
  return (
    <div className="container section receipt-page">
      <div className="no-print flex gap-2 flex-wrap mb-4">
        <Link to={`/application/${id}`} className="btn outline"><ArrowLeft size={16} /> กลับใบสมัคร</Link>
        <button type="button" className="btn primary" disabled={!r} onClick={() => void printPage()}>
          <Printer size={17} /> ดาวน์โหลด / บันทึกเป็น PDF
        </button>
      </div>
      <State loading={q.isPending} error={q.error}>
        {!r ? <Notice>ยังไม่มีใบรับชำระเงินสำหรับใบสมัครนี้ กรุณารอเจ้าหน้าที่ตรวจสอบและยืนยันการชำระเงิน</Notice> :
        <article className="receipt-paper">
          <div className="receipt-heading">
            <div className="receipt-org">{r.details.issuer || "มหาวิทยาลัยเทคโนโลยีราชมงคลอีสาน วิทยาเขตขอนแก่น"}</div>
            <h1>ใบรับชำระเงินค่าธรรมเนียมสมัครงาน</h1>
            <p>เอกสารยืนยันการรับชำระเงินผ่านระบบรับสมัครบุคลากรออนไลน์</p>
          </div>
          <div className="receipt-ref">
            <div><span>เลขที่เอกสาร</span><strong>{r.receipt_number}</strong></div>
            <div><span>วันที่ออกเอกสาร</span><strong>{dateTH(r.issued_at,true)}</strong></div>
          </div>
          <dl className="receipt-details">
            <dt>ได้รับเงินจาก</dt><dd>{r.details.payer || "—"}</dd>
            <dt>ค่าธรรมเนียม</dt><dd>สมัครตำแหน่ง {r.details.job_title || "—"}</dd>
            <dt>หน่วยงาน</dt><dd>{r.details.department || "—"}</dd>
            <dt>เลขผู้สมัคร</dt><dd>{r.details.application_number || "รอเจ้าหน้าที่กำหนด"}</dd>
            <dt>วันที่ชำระเงิน</dt><dd>{dateTH(r.paid_at, true)}</dd>
            <dt>ธนาคารผู้รับ</dt><dd>{r.details.bank_name || "—"}</dd>
            <dt>บัญชีผู้รับ</dt><dd>{r.details.account_name || "—"}</dd>
            <dt>เลขอ้างอิงธุรกรรม</dt><dd>{r.details.payment_reference || "ไม่ระบุ"}</dd>
          </dl>
          <div className="receipt-total"><span>จำนวนเงินที่ได้รับ</span><strong>{money(Number(r.amount))}</strong></div>
          <p className="receipt-confirmation">เจ้าหน้าที่ผู้มีสิทธิ์ได้ตรวจสอบหลักฐานและยืนยันการรับชำระเงินในระบบแล้ว</p>
          <footer className="receipt-footer">เอกสารออกจากระบบอิเล็กทรอนิกส์ ตรวจสอบรายละเอียดได้จากบัญชีผู้สมัครของคุณ<br/>โปรดเก็บเอกสารนี้ไว้เป็นหลักฐานการชำระค่าธรรมเนียม</footer>
        </article>}
      </State>
    </div>
  );
}
