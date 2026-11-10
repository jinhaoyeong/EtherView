"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { ArrowLeftRight, ArrowUpRight, BookOpen, LayoutDashboard, Menu, Newspaper, Settings2, ShieldCheck, Waves, X } from "lucide-react";
import { Brand, EtherMark } from "./brand";
import { Header } from "./header";
import { DarkModeToggle } from "@/components/shared/dark-mode-toggle";
import { DocumentationModal } from "@/components/features/landing/documentation-modal";
import { useSettings } from "@/hooks/use-settings";
const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Activity", href: "/transactions", icon: ArrowLeftRight },
  { label: "Whales", href: "/whale", icon: Waves },
  { label: "Token risk", href: "/scam", icon: ShieldCheck },
  { label: "Insights", href: "/news", icon: Newspaper },
];
export function DashboardLayout({ children, walletAddress, onDisconnect }: {
  children: React.ReactNode; walletAddress: string; onDisconnect: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { settings } = useSettings();
  const animate = settings?.appearance.animationsEnabled !== false && settings?.data.enableAnimations !== false;
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>("a[href],button") ?? []).filter(el => el.offsetParent !== null);
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
      if (e.key !== "Tab") return;
      const items = focusable(), first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", key); };
  }, [open]);
  const current = navigation.find(item => item.href === pathname)?.label || ({ "/settings": "Settings", "/privacy": "Data & privacy" } as Record<string,string>)[pathname] || "Workspace";
  return (
    <MotionConfig reducedMotion={animate ? "user" : "always"}>
      <div className="ev-shell">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="ev-masthead">
          <div className="ev-masthead-inner">
            <Brand />
            <nav aria-label="Main navigation" className="ev-desktop-nav">
              {navigation.map(({label,href}) => <Link key={href} href={href} className={`ev-nav-link ${pathname === href ? "is-active" : ""}`} aria-current={pathname === href ? "page" : undefined}>
                {pathname === href && <motion.span className="ev-nav-indicator" layoutId="workspace-active" transition={{type:"spring",stiffness:380,damping:34}} />}
                <span>{label}</span>
              </Link>)}
            </nav>
            <div className="ev-masthead-actions">
              <DarkModeToggle />
              <Link className={`icon-button ev-settings-link ${pathname === "/settings" ? "is-active" : ""}`} href="/settings" aria-label="Settings"><Settings2 size={18}/></Link>
              <button ref={triggerRef} className="icon-button ev-menu-trigger" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={21}/></button>
            </div>
          </div>
        </header>
        {open && <div className="ev-drawer-layer">
          <button className="ev-drawer-scrim" aria-label="Close navigation" onClick={() => {setOpen(false);triggerRef.current?.focus();}}/>
          <aside ref={sidebarRef} className="ev-drawer" role="dialog" aria-modal="true" aria-label="Workspace navigation">
            <div className="ev-drawer-heading"><Brand/><button className="icon-button" aria-label="Close navigation" onClick={() => {setOpen(false);triggerRef.current?.focus();}}><X size={21}/></button></div>
            <span className="eyebrow">YOUR VIEW ON ETHEREUM</span>
            <nav aria-label="Mobile navigation">{navigation.map(({label,href,icon:Icon},index)=><Link key={href} href={href} onClick={()=>setOpen(false)} aria-current={pathname === href ? "page" : undefined}><span className="ev-drawer-index">0{index+1}</span><Icon size={19}/><span>{label}</span><ArrowUpRight size={16}/></Link>)}</nav>
            <Link className="ev-drawer-settings" href="/settings" onClick={()=>setOpen(false)}><Settings2 size={18}/>Settings</Link>
            <p className="ev-drawer-note"><ShieldCheck size={16}/>Public addresses. No wallet permissions.</p>
          </aside>
        </div>}
        <div className="ev-content">
          <Header walletAddress={walletAddress} onDisconnect={onDisconnect} currentPage={current}/>
          <main id="main-content" className="terminal-main"><div className="ev-route-content" key={pathname}>{children}</div></main>
          <footer className="ev-footer">
            <div className="ev-footer-brand"><EtherMark/><span>EtherView</span><span className="ev-footer-tagline">A clearer view of Ethereum.</span></div>
            <div className="ev-footer-links"><DocumentationModal trigger={<button><BookOpen size={14}/>Guide</button>}/><Link href="/privacy">Data & privacy<ArrowUpRight size={13}/></Link><span className="ev-chain-caption"><span/>Ethereum mainnet</span></div>
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
}
export { Brand as EtherViewLogo } from "./brand";
export { EtherMark as EtherViewLogoIcon } from "./brand";
