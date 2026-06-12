import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import Header from "@/components/header";
import { InstallPrompt } from "@/components/install-prompt";
import Providers from "@/components/providers";
import { PwaRegistration } from "@/lib/pwa/pwa-registration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rox — P2P File Sharing",
  description: "Peer-to-peer file sharing and streaming over WebRTC",
  manifest: "/manifest",
  appleWebApp: {
    capable: true,
    title: "Rox",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="grid h-svh grid-rows-[auto_1fr]">
            <Header />
            {children}
          </div>
          <PwaRegistration />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
