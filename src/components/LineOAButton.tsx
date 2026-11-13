import { useQuery } from "@tanstack/react-query";
import { ExternalLink, MessageCircle } from "lucide-react";
import { rows } from "../services/api";
import { getLineOAUrl } from "../lib/line-oa";

type Variant = "hero" | "footer" | "guide";

/** Public, settings-driven outbound link. Hidden until the URL is configured. */
export function LineOAButton({ variant = "hero" }: { variant?: Variant }) {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => rows("app_settings", "*", "key"),
    staleTime: 60_000,
  });
  const contact = settings.data?.find((item) => item.key === "contact")?.value;
  const url = getLineOAUrl(contact?.line_oa_url);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`line-oa-button line-oa-${variant}`}
      aria-label="เพิ่มเพื่อน LINE Official Account งานรับสมัครบุคลากร มทร.อีสาน วิทยาเขตขอนแก่น (เปิดหน้าต่างใหม่)">
      <MessageCircle size={19} aria-hidden="true" />
      <span>เพิ่มเพื่อน LINE OA</span>
      <ExternalLink size={15} aria-hidden="true" />
    </a>
  );
}
