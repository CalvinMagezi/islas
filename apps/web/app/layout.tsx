import type { Metadata, Viewport } from "next";
import { DM_Sans, Space_Mono, Crimson_Text, JetBrains_Mono } from "next/font/google";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { NotificationSoundListener } from "@/components/notifications/notification-sound-listener";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const crimsonText = Crimson_Text({
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  subsets: ["latin"],
});

import { activeConfig } from "../../../../config";

export const metadata: Metadata = {
  title: activeConfig.brand.name,
  description: "Personal AI agent orchestration hub",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${dmSans.variable} ${spaceMono.variable} ${jetbrainsMono.variable} ${crimsonText.variable} antialiased`}
      >
        <ConvexClientProvider>
          <NotificationSoundListener />
          {children}
        </ConvexClientProvider>
      </body>
    </html>
  );
}
