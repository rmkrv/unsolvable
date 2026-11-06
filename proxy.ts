import { auth } from "@/lib/server/auth/neon";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
  // API routes enforce session identity themselves so they can return JSON/RPC errors instead of HTML redirects.
  publicRoutes: ["/api/board", "/mcp"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
