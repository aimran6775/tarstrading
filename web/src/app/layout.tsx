import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

/*
  Type system: departure-board display (Archivo, wide + heavy), terminal
  numerals (IBM Plex Mono — the face with actual terminal heritage), and a
  quiet humanist body (Instrument Sans).
*/

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tarstrading.com"),
  title: {
    default: "Tars Trading — a flight simulator for markets",
    template: "%s · Tars Trading",
  },
  description:
    "Learn to trade before you trade. $100,000 in simulated capital, real market data, an academy that starts at zero, and trading agents you program yourself.",
  applicationName: "Tars Trading",
  openGraph: {
    title: "Tars Trading — a flight simulator for markets",
    description:
      "$100,000 in simulated capital, real market data, an academy from zero to Greeks, and trading agents you program yourself. Every fill is practice.",
    type: "website",
    siteName: "Tars Trading",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tars Trading — learn to trade before you trade",
    description: "Simulated $100k. Real data. An academy from zero to fund manager. Agents you program.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1a1726" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7fa" },
  ],
  width: "device-width",
  initialScale: 1,
};

/** Applies the saved theme before first paint — no flash of wrong theme. */
const themeScript = `
try {
  var t = localStorage.getItem('tars-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${plexMono.variable} ${instrument.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
