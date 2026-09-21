import type { Browser } from "playwright-core";

/**
 * Launches a serverless-compatible headless Chromium for scraping JS-rendered sites
 * from a Vercel function. Uses @sparticuz/chromium's trimmed binary — a plain
 * `playwright` install bundles a full browser download and blows past Vercel's
 * function size limit.
 *
 * Local dev: @sparticuz/chromium ships a Linux binary meant for AWS Lambda/Vercel's
 * runtime, so this won't launch on macOS/Windows as-is. Set PLAYWRIGHT_EXECUTABLE_PATH
 * to a local Chromium/Chrome install (e.g. from `npx playwright install chromium`) to
 * test adapters locally; leave it unset in Vercel.
 *
 * Version note: @sparticuz/chromium's Chromium build and playwright-core's bundled
 * protocol driver need to stay roughly in step (see package README) — when bumping
 * either dependency, bump both and re-test a real adapter before deploying.
 */
export async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright-core");

  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    return chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      headless: true,
    });
  }

  const sparticuzChromium = (await import("@sparticuz/chromium")).default;
  return chromium.launch({
    args: sparticuzChromium.args,
    executablePath: await sparticuzChromium.executablePath(),
    headless: true,
  });
}
