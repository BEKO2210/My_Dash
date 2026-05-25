import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme";
import { LangSync } from "@/lib/i18n";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Public site (GitHub Pages). Used for canonical + absolute social-card URLs.
const SITE_URL = "https://beko2210.github.io/My_Dash";
const DESCRIPTION =
  "A local, read-only observability dashboard for Claude Code — live event stream, session kanban, token/cost charts and a 3D tool-call graph.";
const OG_IMAGE = `${SITE_URL}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Claude Mission Control", template: "%s · Claude Mission Control" },
  description: DESCRIPTION,
  applicationName: "Claude Mission Control",
  authors: [{ name: "Belkis Aslani" }],
  creator: "Belkis Aslani",
  keywords: [
    "Claude Code", "observability", "dashboard", "developer tools", "AI", "Anthropic",
    "token usage", "cost tracking", "telemetry", "3D tool graph", "local-first",
  ],
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Claude Mission Control",
    title: "Claude Mission Control — live observability for Claude Code",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "de_DE",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Claude Mission Control — live observability for Claude Code" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Claude Mission Control — live observability for Claude Code",
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#06070b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <LangSync />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
