/** Text stand-in until the white logo file is supplied. */
export function Wordmark({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return <span className="text-lg font-bold italic tracking-tight text-white">C</span>;
  }
  return (
    <span className="block leading-none">
      <span className="block text-[17px] font-bold italic tracking-wide text-white">CATAPULT</span>
      <span className="mt-1 block text-[10px] font-medium tracking-[0.22em] text-ink-200">OPERATIONS</span>
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
