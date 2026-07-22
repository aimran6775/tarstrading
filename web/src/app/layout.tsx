import type { Metadata } from "next";
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
  title: "Tars Trading — a flight simulator for markets",
  description:
    "Learn to trade before you trade. $100,000 in simulated capital, real market data, an academy that starts at zero, and trading agents you program yourself.",
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
