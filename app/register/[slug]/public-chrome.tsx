import { ArrowUpRight } from "lucide-react";

// Header and footer for the public event pages, styled after catapultready.com: white,
// the black wordmark, and quiet links back to the main site.
const SITE_URL = "https://www.catapultready.com";
const EVENTS_URL = `${SITE_URL}/events-page/`;

function Wordmark({ className }: { className?: string }) {
  // The only logo file is white; inverting it gives the black wordmark the main site uses.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/catapult-logo-white.png" alt="Catapult" className={`invert ${className ?? ""}`} />;
}

export function PublicHeader() {
  return (
    <header className="border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href={SITE_URL} aria-label="Catapult home">
          <Wordmark className="h-5 w-auto sm:h-6" />
        </a>
        <a
          href={EVENTS_URL}
          className="inline-flex items-center gap-1 text-sm font-light text-slate-700 transition-colors hover:text-brand-600"
        >
          All events
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
        </a>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm font-light text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Wordmark className="h-4 w-auto opacity-80" />
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <a href={EVENTS_URL} className="hover:text-slate-900">Upcoming events</a>
          <a href={`${SITE_URL}/apex-forums/`} className="hover:text-slate-900">Apex Forums</a>
          <a href={SITE_URL} className="hover:text-slate-900">catapultready.com</a>
        </nav>
      </div>
    </footer>
  );
}
