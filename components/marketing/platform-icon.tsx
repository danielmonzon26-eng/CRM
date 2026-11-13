import { useId } from "react";
import type { SocialPlatform } from "@/lib/supabase/types";
import { PLATFORM_META } from "@/lib/marketing/constants";

/** A small mark for each platform in its own colour, so channels are recognisable at a glance. */
export function PlatformIcon({ platform, className = "h-4 w-4", title }: { platform: SocialPlatform; className?: string; title?: string }) {
  const label = title ?? PLATFORM_META[platform].label;
  // Each Instagram mark needs its own gradient id, or every copy on the page shares the first.
  const gradientId = `ig-${useId().replace(/:/g, "")}`;
  if (platform === "linkedin") {
    return (
      <svg viewBox="0 0 24 24" className={className} role="img" aria-label={label}>
        <rect width="24" height="24" rx="5" fill="#0A66C2" />
        <rect x="5.2" y="9.6" width="3" height="9" fill="#fff" />
        <circle cx="6.7" cy="6.6" r="1.75" fill="#fff" />
        <path d="M10.6 9.6h2.9v1.3c.5-.9 1.6-1.5 3-1.5 2.4 0 3.3 1.5 3.3 4v4.8h-3v-4.3c0-1.1-.3-1.9-1.4-1.9s-1.8.8-1.8 1.9v4.3h-3z" fill="#fff" />
      </svg>
    );
  }
  if (platform === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className={className} role="img" aria-label={label}>
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path d="M13.3 24v-8.4h2.8l.4-3.3h-3.2v-2.1c0-.9.3-1.6 1.6-1.6h1.7V5.7c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.1v3.3h2.8V24z" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={label}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FEDA75" />
          <stop offset="0.35" stopColor="#FA7E1E" />
          <stop offset="0.6" stopColor="#D62976" />
          <stop offset="1" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill={`url(#${gradientId})`} />
      <rect x="5.5" y="5.5" width="13" height="13" rx="3.8" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.1" cy="7.9" r="1" fill="#fff" />
    </svg>
  );
}

export function PlatformIcons({ platforms, className = "h-4 w-4" }: { platforms: SocialPlatform[]; className?: string }) {
  if (platforms.length === 0) return <span className="text-xs text-slate-400">No channels</span>;
  return (
    <span className="inline-flex items-center gap-1">
      {platforms.map((p) => (
        <PlatformIcon key={p} platform={p} className={className} />
      ))}
    </span>
  );
}
