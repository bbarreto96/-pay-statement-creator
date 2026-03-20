import { NextResponse } from "next/server";
import {
	AUTH_COOKIE_NAME,
	AUTH_MAX_AGE_SECONDS,
	areCredentialsValid,
	createSessionToken,
	isAuthEnabled,
} from "@/lib/auth";

export async function POST(req: Request) {
	try {
		if (!isAuthEnabled()) {
			return NextResponse.json(
				{
					error:
						"Login is not configured. Set APP_LOGIN_USERNAME, APP_LOGIN_PASSWORD, and APP_LOGIN_SECRET.",
				},
				{ status: 500 }
			);
		}

		const body = (await req.json()) as {
			username?: string;
			password?: string;
		};
		const username = body?.username?.trim() ?? "";
		const password = body?.password?.trim() ?? "";

		if (!username || !password) {
			return NextResponse.json(
				{ error: "Username and password are required." },
				{ status: 400 }
			);
		}

		const ok = await areCredentialsValid(username, password);
		if (!ok) {
			return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
		}

		const token = await createSessionToken();
		if (!token) {
			return NextResponse.json({ error: "Unable to create session." }, { status: 500 });
		}

		const res = NextResponse.json({ ok: true });
		res.cookies.set(AUTH_COOKIE_NAME, token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: AUTH_MAX_AGE_SECONDS,
		});
		return res;
	} catch {
		return NextResponse.json({ error: "Invalid request." }, { status: 400 });
	}
}

