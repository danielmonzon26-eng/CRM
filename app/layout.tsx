import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Calgary Lead Engine",
  description: "Lead generation CRM for identifying new and growing Calgary businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-slate-900 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
