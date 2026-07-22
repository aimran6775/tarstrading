/*
  The Horizon mark as an SVG data URI, for use as an <img> inside next/og
  ImageResponse (Satori). Literal colors — these images render outside the
  app's CSS, so there are no theme tokens to read.
*/
export function markDataUri(px: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64" fill="none">` +
    `<circle cx="32" cy="32" r="26" stroke="#e9c47c" stroke-width="2.4"/>` +
    `<clipPath id="h"><circle cx="32" cy="32" r="24.6"/></clipPath>` +
    `<g clip-path="url(#h)">` +
    `<path d="M4 40 L60 24 L60 60 L4 60 Z" fill="#e9c47c" fill-opacity="0.16"/>` +
    `<line x1="4" y1="40" x2="60" y2="24" stroke="#e9c47c" stroke-width="2.4"/></g>` +
    `<g stroke="#ecebf0" stroke-width="2.6" stroke-linecap="round">` +
    `<line x1="20" y1="33" x2="27" y2="33"/><line x1="37" y1="33" x2="44" y2="33"/></g>` +
    `<circle cx="32" cy="33" r="2.6" fill="#e9c47c"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
