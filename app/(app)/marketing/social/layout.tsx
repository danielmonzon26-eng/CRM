import { SocialTabs } from "@/components/marketing/social-tabs";

/** Social is one part of marketing: its post calendar, approvals and channels. */
export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <SocialTabs />
      {children}
    </div>
  );
}
