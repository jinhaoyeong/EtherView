import Link from "next/link";
export function EtherMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 36"
      aria-hidden="true"
      fill="none"
      className={className}
    >
      <path d="m14 2 11 17-11 6L3 19 14 2Z" fill="currentColor" />
      <path d="M14 2v23l11-6L14 2Z" fill="currentColor" opacity=".65" />
      <path d="m3 22 11 12 11-12-11 6-11-6Z" fill="currentColor" opacity=".8" />
    </svg>
  );
}
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="EtherView home">
      <span className="brand-mark-box">
        <EtherMark />
      </span>
      <span>EtherView</span>
    </Link>
  );
}
