"use client";

import React, { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginFormProps = {
	nextPath: string;
};

export default function LoginForm({ nextPath }: LoginFormProps) {
	const router = useRouter();
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
	);
}

