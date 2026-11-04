import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

// Formatted here, once per build, so the sidebar shows the time this version was built
// on Vercel in Calgary time, whatever the viewer's timezone. See EVENT_TIME_ZONE in
// lib/events/format.ts for why this is a fixed zone.
const uploadedAt = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Etc/GMT+6",
}).format(new Date());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keeps Next's dev-only badge from covering the version stamp in the sidebar.
  devIndicators: { position: "bottom-right" },
  env: {
    NEXT_PUBLIC_APP_VERSION: `v${version} (${commit})`,
    NEXT_PUBLIC_APP_UPLOADED_AT: `${uploadedAt} ABT`,
  },
};

export default nextConfig;
