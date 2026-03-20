"use client";

import React, { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function getSafeNext(raw: string | null): string {
	if (!raw) return "/";
	if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
	return raw;
}

export default function LoginPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const nextPath = useMemo(() => getSafeNext(searchParams.get("next")), [searchParams]);
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function onSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			const resp = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});
			if (!resp.ok) {
				const data = (await resp.json().catch(() => ({}))) as { error?: string };
				setError(data.error ?? "Login failed.");
				return;
			}
			router.replace(nextPath);
			router.refresh();
		} catch {
			setError("Unable to log in. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen app-shell flex items-center justify-center px-4">
			<div className="w-full max-w-md app-panel p-6">
				<h1 className="section-title text-2xl mb-1">Sign In</h1>
				<p className="text-sm text-gray-600 mb-5">Enter your username and password.</p>
				<form onSubmit={onSubmit} className="space-y-4">
					<div>
						<label htmlFor="username" className="block text-sm font-medium mb-1">
							Username
						</label>
						<input
							id="username"
							name="username"
							autoComplete="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							className="input-field w-full"
							required
						/>
					</div>
					<div>
						<label htmlFor="password" className="block text-sm font-medium mb-1">
							Password
						</label>
						<input
							id="password"
							name="password"
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="input-field w-full"
							required
						/>
					</div>
					{error ? <p className="text-sm text-red-600">{error}</p> : null}
					<button
						type="submit"
						disabled={loading}
						className="w-full px-4 py-2 rounded-md bg-black text-white disabled:opacity-60"
					>
						{loading ? "Signing in..." : "Sign in"}
					</button>
				</form>
			</div>
		</div>
	);
}

