import type { NextConfig } from "next";

/*
  One codebase, two Railway services, selected by APP_ROLE at build time:

  - frontend (tarstrading.com):  serves the product UI. Every /api/* request
    is rewritten server-side to the backend service (API_ORIGIN), so the
    browser only ever talks to tarstrading.com while ALL data traffic is
    answered by the backend — no client changes, no CORS.
  - backend (admin.tarstrading.com): serves the admin control center and the
    entire API surface. The src/proxy.ts host router makes the bare admin
    host render /admin.

  API_ORIGIN should be the backend's PRIVATE address on Railway
  (http://<service>.railway.internal:<port>) so frontend→backend hops stay
  inside the datacenter instead of looping through the public edge.
  Locally neither var is set and the app behaves as the single dev monolith.
*/
const isFrontend = process.env.APP_ROLE === "frontend" && !!process.env.API_ORIGIN;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!isFrontend) return [];
    return [{ source: "/api/:path*", destination: `${process.env.API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
