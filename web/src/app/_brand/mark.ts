/*
  The Ascent mark as an SVG data URI, for use as an <img> inside next/og
  ImageResponse (rasterized by resvg — gradients supported, filters not).
  Literal colors — these images render outside the app's CSS, so there are no
  theme tokens to read. Kept in lock-step with components/tars-mark.tsx.
*/
export function markDataUri(px: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64" fill="none">` +
    `<defs>` +
    `<linearGradient id="sh" x1="20" y1="11" x2="20" y2="42" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0.3"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0.05"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="fl" x1="32" y1="11" x2="48" y2="42" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.18"/></linearGradient>` +
    `<radialGradient id="cs" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.32"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<ellipse cx="32" cy="51" rx="21" ry="3.6" fill="url(#cs)"/>` +
    `<path d="M9 42 L22 42 L22 46 L9 46 Z" fill="#79552a"/>` +
    `<path d="M42 42 L55 42 L55 46 L42 46 Z" fill="#79552a"/>` +
    `<path d="M32 11 L55 42 L42 42 L32 31.5 Z" fill="#bc8c49"/>` +
    `<path d="M32 11 L55 42 L42 42 L32 31.5 Z" fill="url(#fl)"/>` +
    `<path d="M32 11 L32 31.5 L22 42 L9 42 Z" fill="#efcc88"/>` +
    `<path d="M32 11 L32 31.5 L22 42 L9 42 Z" fill="url(#sh)"/>` +
    `<path d="M32 11 L9 42" stroke="#ffe9c2" stroke-width="1" stroke-linecap="round" stroke-opacity="0.55"/>` +
    `<path d="M32 11 L32 31.5" stroke="#fff1cf" stroke-width="1.4" stroke-linecap="round"/>` +
    `<circle cx="32" cy="11" r="1.7" fill="#fff7e6"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
