import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Catapult",
  description: "Catapult's CRM for identifying and closing new Calgary business.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
