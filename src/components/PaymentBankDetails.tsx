import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseUrl } from "../lib/supabase";

export type PaymentSettings = {
  bank_name: string;
  account_name: string;
  account_number: string;
  qr_path?: string;
  note?: string;
};

export const paymentQrUrl = (path?: string) =>
  path && /^qr\/[a-f0-9-]{36}\.(png|jpg|jpeg)$/.test(path)
    ? `${supabaseUrl}/storage/v1/object/public/recruitment-payment-qr/${path}`
    : "";

export function usePaymentSettings() {
  return useQuery({
    queryKey: ["payment-bank-settings"],
    queryFn: async (): Promise<PaymentSettings | null> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "payment")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as PaymentSettings | undefined) || null;
    },
  });
}

export default function PaymentBankDetails() {
  const { data, error, isPending } = usePaymentSettings();
  if (isPending) return <p className="muted">กำลังโหลดข้อมูลบัญชีรับชำระเงิน…</p>;
  if (error) return <p className="error-text">ไม่สามารถโหลดข้อมูลบัญชีธนาคารได้ กรุณาลองใหม่</p>;
  if (!data?.bank_name || !data.account_name || !data.account_number)
    return <div className="notice">ยังไม่มีข้อมูลบัญชีธนาคารที่หน่วยงานยืนยัน กรุณาติดต่อเจ้าหน้าที่ก่อนชำระเงิน</div>;
  const qr = paymentQrUrl(data.qr_path);
  return (
    <section className="payment-bank-card" aria-label="ข้อมูลชำระค่าธรรมเนียม">
      <div className="payment-bank-info">
        <strong>บัญชีธนาคารสำหรับชำระค่าธรรมเนียม</strong>
        <dl>
          <dt>ธนาคาร</dt><dd>{data.bank_name}</dd>
          <dt>ชื่อบัญชี</dt><dd>{data.account_name}</dd>
          <dt>เลขบัญชี</dt><dd className="payment-bank-number">{data.account_number}</dd>
        </dl>
        {data.note && <p>{data.note}</p>}
      </div>
      {qr && (
        <div className="payment-bank-qr">
          <a
            className="payment-bank-qr-link"
            href={qr}
            target="_blank"
            rel="noopener noreferrer"
            title="เปิดภาพ QR Code ขนาดเต็มในแท็บใหม่"
            aria-label="เปิดภาพ QR Code ชำระค่าธรรมเนียมขนาดเต็ม"
          >
            <img
              src={qr}
              alt="QR Code สำหรับชำระค่าธรรมเนียมตามบัญชีที่มหาวิทยาลัยกำหนด"
              loading="eager"
              decoding="async"
            />
          </a>
          <strong>สแกนเพื่อชำระเงิน</strong>
          <a className="payment-bank-qr-open" href={qr} target="_blank" rel="noopener noreferrer">
            เปิดรูป QR ขนาดเต็ม ↗
          </a>
          <span>ใช้มือถือเครื่องเดียวกัน? เปิดรูปเต็ม แล้วบันทึกรูปเพื่อสแกนผ่านแอปธนาคาร</span>
        </div>
      )}
      <small className="payment-bank-disclaimer">ตรวจสอบชื่อบัญชีและยอดเงินให้ถูกต้องก่อนโอน และแนบสลิปให้เจ้าหน้าที่ตรวจสอบ การโอนเงินไม่ถือเป็นการอนุมัติใบสมัครโดยอัตโนมัติ</small>
    </section>
  );
}
