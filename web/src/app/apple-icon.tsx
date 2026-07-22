import { ImageResponse } from "next/og";
import { markDataUri } from "./_brand/mark";

// The iOS home-screen / touch icon — the Horizon on the canonical dark room.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center", background: "#1a1726" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={124} height={124} src={markDataUri(124)} alt="Tars" />
      </div>
    ),
    size,
  );
}
