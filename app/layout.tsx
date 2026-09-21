import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = {
  title: "Calgary Lead Engine",
  description: "Lead generation CRM for identifying new and growing Calgary businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
