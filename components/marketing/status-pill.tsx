import { POST_STATUS_META } from "@/lib/marketing/constants";
import type { SocialPostStatus } from "@/lib/supabase/types";

export function PostStatusPill({ status, size = "md" }: { status: SocialPostStatus; size?: "sm" | "md" }) {
  const meta = POST_STATUS_META[status];
  return (
    <span
      title={meta.hint}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ${meta.pill} ${size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs"}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
