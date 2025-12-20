"use client";

import { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  FileText,
  Fish,
  AlertTriangle,
  Newspaper,
  User,
  Settings
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Header } from "./header";
import { useTranslation } from "@/hooks/use-translation";

interface DashboardLayoutProps {
  children: React.ReactNode;
  walletAddress: string;
  onDisconnect: () => void;
}

export function DashboardLayout({ children, walletAddress, onDisconnect }: DashboardLayoutProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const links = [
    {
      label: t('nav.overview'),
      href: "/",
      icon: (
        <LayoutDashboard className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t('nav.transactions'),
      href: "/transactions",
      icon: (
        <FileText className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t('nav.whale_movement'),
      href: "/whale",
      icon: (
        <Fish className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t('nav.scam_alert'),
      href: "/scam",
      icon: (
        <AlertTriangle className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t('nav.news_sentiment'),
      href: "/news",
      icon: (
        <Newspaper className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: t('nav.settings'),
      href: "/settings",
      icon: (
        <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex h-screen">
        <Sidebar open={open} setOpen={setOpen} animate={true}>
          <SidebarBody className="justify-between gap-10 bg-sidebar border-r border-border">
            <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
              {open ? <EtherViewLogo /> : <EtherViewLogoIcon />}
              <div className="mt-8 flex flex-col gap-2">
                {links.map((link, idx) => (
                  <SidebarLink
                    key={idx}
                    link={link}
                    className="text-sidebar-foreground hover:text-sidebar-primary hover:bg-sidebar-accent rounded-md transition-colors"
                  />
                ))}
              </div>
            </div>
            <div>
              <SidebarLink
                link={{
                  label: t('nav.user'),
                  href: "#",
                  icon: (
                    <div className="h-7 w-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  ),
                }}
                className="text-sidebar-foreground hover:text-sidebar-primary"
              />
            </div>
          </SidebarBody>
        </Sidebar>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header walletAddress={walletAddress} onDisconnect={onDisconnect} />
          <main className="flex-1 overflow-y-auto p-6 bg-background">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export const EtherViewLogo = () => {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm text-sidebar-foreground py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-primary rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-sidebar-foreground whitespace-pre"
      >
        EtherView
      </motion.span>
    </Link>
  );
};

export const EtherViewLogoIcon = () => {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm text-sidebar-foreground py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-primary rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </Link>
  );
};