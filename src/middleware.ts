import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

function isPublicPath(pathname: string): boolean {
	if (pathname === "/login") return true;
	if (pathname.startsWith("/api/auth/")) return true;
	return false;
}

function withNext(pathname: string, search: string): string {
	return `${pathname}${search || ""}`;
}

export function middleware(req: NextRequest) {
	const { pathname, search } = req.nextUrl;

	if (isPublicPath(pathname)) {
		if (pathname === "/login") {
			const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
			if (token) {
				return NextResponse.redirect(new URL("/", req.url));
			}
		}
		return NextResponse.next();
	}

	const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
	if (token) return NextResponse.next();

	if (pathname.startsWith("/api/")) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const loginUrl = new URL("/login", req.url);
	loginUrl.searchParams.set("next", withNext(pathname, search));
	return NextResponse.redirect(loginUrl);
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
