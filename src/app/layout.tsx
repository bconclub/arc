import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ARC",
  description: "GTM Command Center",
  // Favicon comes from src/app/icon.svg (App Router file convention), it is
  // theme-aware, so the mark stays visible on both light and dark browser chrome.
  // The manifest (src/app/manifest.ts) and the apple icon make ARC installable on a phone.
  manifest: "/manifest.webmanifest",
  icons: { apple: "/pwa-apple-180.png" },
  appleWebApp: { capable: true, title: "ARC", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0B0C0E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before paint to avoid a flash of the wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('arc:theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
