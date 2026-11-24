import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/public-media/")) return NextResponse.next();

  let ok = false;
  const token = req.cookies.get("ch_session")?.value;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET ?? ""));
      ok = true;
    } catch {}
  }
  const authPage = pathname === "/login" || pathname === "/register";
  if (!ok && !authPage) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (ok && authPage) return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
