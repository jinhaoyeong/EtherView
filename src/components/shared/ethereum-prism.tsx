import { useId } from "react";

/** Faceted Ethereum mark, drawn as a mineral object rather than a flat badge. */
export function EthereumPrism({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={`ev-ethereum-prism ${className}`} viewBox="0 0 420 460" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-silver`} x1="102" y1="70" x2="295" y2="270" gradientUnits="userSpaceOnUse"><stop stopColor="#F7F9FE" /><stop offset=".48" stopColor="#CBD3E0" /><stop offset="1" stopColor="#8794A9" /></linearGradient>
        <linearGradient id={`${id}-ink`} x1="210" y1="60" x2="330" y2="265" gradientUnits="userSpaceOnUse"><stop stopColor="#787A85" /><stop offset=".47" stopColor="#414650" /><stop offset="1" stopColor="#292F37" /></linearGradient>
        <linearGradient id={`${id}-blue`} x1="94" y1="234" x2="212" y2="296" gradientUnits="userSpaceOnUse"><stop stopColor="#A7B9DC" /><stop offset="1" stopColor="#E2EAFE" /></linearGradient>
        <linearGradient id={`${id}-lower`} x1="97" y1="288" x2="214" y2="409" gradientUnits="userSpaceOnUse"><stop stopColor="#DEE5F0" /><stop offset=".55" stopColor="#ABB9CD" /><stop offset="1" stopColor="#F7FAFF" /></linearGradient>
        <linearGradient id={`${id}-edge`} x1="210" y1="80" x2="210" y2="280" gradientUnits="userSpaceOnUse"><stop stopColor="#F9FBFF" /><stop offset="1" stopColor="#F9FBFF" stopOpacity="0" /></linearGradient>
        <radialGradient id={`${id}-shadow`}><stop stopColor="#253146" stopOpacity=".3" /><stop offset="1" stopColor="#253146" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse className="ev-prism-shadow" cx="211" cy="415" rx="116" ry="19" fill={`url(#${id}-shadow)`} />
      <g className="ev-prism-object">
        <path d="M210 36 84 242 210 181Z" fill={`url(#${id}-silver)`} />
        <path d="M210 36 337 242 210 181Z" fill={`url(#${id}-ink)`} />
        <path d="M84 242 210 181 210 315Z" fill={`url(#${id}-blue)`} />
        <path d="M337 242 210 181 210 315Z" fill="#5A616A" />
        <path d="M84 242 210 36 144 214Z" fill="#FFF" fillOpacity=".16" />
        <path d="M210 36 210 181 273 213Z" fill="#B6B8C7" fillOpacity=".15" />
        <path d="M84 242 210 315 144 214Z" fill="#F1F5FF" fillOpacity=".17" />
        <path d="M337 242 210 315 273 213Z" fill="#222936" fillOpacity=".2" />
        <path d="M93 280 210 350 210 425Z" fill={`url(#${id}-lower)`} />
        <path d="M328 280 210 350 210 425Z" fill="#4E5660" />
        <path d="M93 280 210 425 147 313Z" fill="#F2F7FF" fillOpacity=".24" />
        <path d="M210 36 84 242 210 315 337 242 210 36Z" stroke="#EDF3FF" strokeOpacity=".35" strokeWidth=".8" />
        <path d="M210 36V315M84 242 210 181 337 242M93 280 210 350 328 280M210 350V425" stroke={`url(#${id}-edge)`} strokeWidth="1" />
      </g>
    </svg>
  );
}
