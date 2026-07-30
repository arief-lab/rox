// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import { ImpeccableLiveLoader } from "@/components/impeccable-live-loader";
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="h-svh">{children}</div>
          <PwaRegistration />
          <InstallPrompt />
        </Providers>
      {/* impeccable-live-start */}
      <ImpeccableLiveLoader
        port={8400}
        token="5377ad1f-244f-4d0c-aefd-5d82de3ff866"
      />
      {/* impeccable-live-end */}
</body>
    </html>
  );
}
