export function Wordmark({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return <span role="img" aria-label="Catapult" className="text-lg font-bold italic tracking-tight text-white">C</span>;
  }
  return (
    <span className="block leading-none">
      <img src="/catapult-logo-white.png" alt="Catapult" width={128} height={20} className="block h-5 w-32" />
      <span className="mt-1.5 block text-[10px] font-medium tracking-[0.22em] text-ink-200">OPERATIONS</span>
    </span>
  );
}

export function VersionStamp() {
  return (
    <div className="text-[11px] leading-snug text-white">
      <p>{process.env.NEXT_PUBLIC_APP_VERSION}</p>
      <p>Uploaded {process.env.NEXT_PUBLIC_APP_UPLOADED_AT}</p>
    </div>
  );
}
