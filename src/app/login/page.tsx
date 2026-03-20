import React from "react";
import LoginForm from "@/components/LoginForm";

type LoginPageProps = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSafeNext(raw: string | string[] | undefined): string {
	const v = Array.isArray(raw) ? raw[0] : raw;
	if (!v) return "/";
	if (!v.startsWith("/") || v.startsWith("//")) return "/";
	return v;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
	const params = await searchParams;
	const nextPath = getSafeNext(params.next);

	return (
		<div className="min-h-screen app-shell flex items-center justify-center px-4">
			<div className="w-full max-w-md app-panel p-6">
				<h1 className="section-title text-2xl mb-1">Sign In</h1>
				<p className="text-sm text-gray-600 mb-5">Enter your username and password.</p>
				<LoginForm nextPath={nextPath} />
			</div>
		</div>
	);
}

