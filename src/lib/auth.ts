export const AUTH_COOKIE_NAME = "psc_auth";
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

type AuthConfig = {
	username: string;
	password: string;
	secret: string;
};

const textEncoder = new TextEncoder();

function readAuthConfig(): AuthConfig | null {
	const username = process.env.APP_LOGIN_USERNAME?.trim();
	const password = process.env.APP_LOGIN_PASSWORD?.trim();
	const secret = process.env.APP_LOGIN_SECRET?.trim();
	if (!username || !password || !secret) return null;
	return { username, password, secret };
}

async function sha256Hex(input: string): Promise<string> {
	const bytes = textEncoder.encode(input);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function isAuthEnabled(): boolean {
	return !!readAuthConfig();
}

export async function areCredentialsValid(
	username: string,
	password: string
): Promise<boolean> {
	const config = readAuthConfig();
	if (!config) return false;
	return username === config.username && password === config.password;
}

export async function createSessionToken(): Promise<string | null> {
	const config = readAuthConfig();
	if (!config) return null;
	return sha256Hex(`${config.username}:${config.password}:${config.secret}`);
}

export async function isValidSessionToken(token: string): Promise<boolean> {
	const expected = await createSessionToken();
	if (!expected) return false;
	return token === expected;
}

