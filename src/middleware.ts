export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/dashboard", "/tree/new", "/tree/:path*"],
};
