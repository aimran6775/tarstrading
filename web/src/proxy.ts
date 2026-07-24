import { NextRequest, NextResponse } from "next/server";

/*
  Host routing for production (Next 16 proxy — the middleware successor).

  One deployment serves two hostnames:
  - tarstrading.com        → the product. Its /admin/* redirects to the admin
                             host so the control center has ONE canonical home.
  - admin.tarstrading.com  → the control center. "/" (and any non-admin path
                             that isn't an API/auth/asset route) rewrites into
                             /admin/*, so the subdomain IS the dashboard.

  Auth is untouched: both hosts share the same session cookie domain-wide via
  login on either host; currentAdmin() still guards every admin page/API on
  the server, so this file is routing, not security.

  Local dev (localhost) has no admin host — everything passes through.
*/

const ADMIN_HOST = "admin.tarstrading.com";

/** Paths that must never be host-rewritten: framework, APIs, auth, assets. */
const PASS = /^\/(?:api|_next|login|join|disclosures|favicon|icon|apple-icon|opengraph-image|main-search-video|robots|sitemap)/;

export default function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  const { pathname } = req.nextUrl;

  if (host === ADMIN_HOST) {
    // The subdomain IS the dashboard: bare paths map into /admin.
    if (!pathname.startsWith("/admin") && !PASS.test(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // On the product host, the control center lives at its own address.
  if (host === "tarstrading.com" || host === "www.tarstrading.com") {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const url = req.nextUrl.clone();
      url.hostname = ADMIN_HOST;
      url.port = "";
      return NextResponse.redirect(url, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets entirely — the proxy only thinks about page routes.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
