/** Remounts on every navigation, which replays the page's short entrance. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
