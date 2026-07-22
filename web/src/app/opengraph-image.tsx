import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";
import { markDataUri } from "./_brand/mark";

/*
  The social share card. Rendered by Satori (next/og), so it lives outside the
  app's CSS: literal colors, and the wordmark is set in a bundled static cut of
  the brand face (Archivo Black). Every container is display:flex — Satori
  requires it on any element with more than one child.
*/
export const alt = "Tars Trading — a flight simulator for markets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const archivo = await readFile(join(process.cwd(), "src/app/_brand/ArchivoBlack.ttf"));

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", background: "#14121c", padding: "76px 84px",
        fontFamily: "Archivo Black", color: "#ecebf0" }}>

        {/* lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img width={80} height={80} src={markDataUri(80)} alt="" />
          <span style={{ fontSize: 38, letterSpacing: 6 }}>TARS TRADING</span>
        </div>

        {/* thesis */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 96, lineHeight: 1.0, letterSpacing: -1 }}>Learn to trade</span>
          <span style={{ fontSize: 96, lineHeight: 1.0, letterSpacing: -1, color: "#e9c47c" }}>before you trade.</span>
        </div>

        {/* footer line */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 25, letterSpacing: 8, color: "#e9c47c" }}>A FLIGHT SIMULATOR FOR MARKETS</span>
          <span style={{ fontSize: 22, letterSpacing: 3, color: "#807d8e" }}>$100,000 · SIMULATED</span>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Archivo Black", data: archivo, style: "normal", weight: 400 }] },
  );
}
