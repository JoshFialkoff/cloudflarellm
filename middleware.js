import { NextResponse } from "next/server";

/**
 * Redirect unwanted subdomains to canonical domain.
 * Prevents duplicate-content SEO penalties from wildcard DNS hits.
 */
export function middleware(request) {
  const host = request.headers.get("host") || "";

  // Strip port if present
  const hostname = host.split(":")[0];

  // Redirect deprecated/duplicate subdomains to canonical
  const redirectSubdomains = ["lp.assistedly.ai", "chat.assistedly.ai"];
  if (redirectSubdomains.includes(hostname)) {
    const url = request.nextUrl.clone();
    url.hostname = "assistedly.ai";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
