/** Re-mounts on every navigation, so each page settles in gently. Pure CSS, so it works before JavaScript loads. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
