import type { Metadata } from "next";
import { Oxanium, Fira_Code } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const oxanium = Oxanium({
  variable: "--font-oxanium",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-fira-code",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "EtherView - Ethereum Intelligence Dashboard",
  description: "Real-time wallet analytics, scam detection, whale tracking, and sentiment analysis for Ethereum wallets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${oxanium.variable} ${firaCode.variable} font-sans antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
