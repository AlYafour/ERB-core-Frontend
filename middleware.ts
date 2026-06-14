import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/register", "/company-login", "/platform-login"];

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

function isExpired(claims: Record<string, unknown>): boolean {
  if (typeof claims.exp !== "number") return false;
  return Date.now() / 1000 > claims.exp;
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")
  );
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;
  const isPublic = isPublicPath(pathname);

  // Unauthenticated: only public paths are allowed → land on "/company-login"
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL("/company-login", request.url));
  }

  if (token) {
    const claims = decodeJwtPayload(token);

    // Treat an expired token the same as no token — let the user see login pages
    // and let API interceptors handle token refresh for protected routes.
    if (!isExpired(claims)) {
      const isPlatformAdmin = Boolean(claims.is_platform_admin);

      // Authenticated user on a public path → route to the right home
      if (isPublic) {
        const dest = isPlatformAdmin ? "/super-admin" : "/dashboard";
        return NextResponse.redirect(new URL(dest, request.url));
      }

      // Platform-admin guard: tenant users must not reach /super-admin/*
      if (pathname.startsWith("/super-admin") && !isPlatformAdmin) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon|public|api|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|css|js)).*)",
  ],
};
