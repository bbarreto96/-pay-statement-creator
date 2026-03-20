"use client";

export type SupabaseStatus = {
	lastWriteAt?: string;
	lastError?: string;
	lastErrorAt?: string;
};

const STORAGE_KEY = "supabase-status-v1";

export function readSupabaseStatus(): SupabaseStatus {
	if (typeof window === "undefined") return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as SupabaseStatus) : {};
	} catch {
		return {};
	}
}

function writeSupabaseStatus(next: SupabaseStatus) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		window.dispatchEvent(new Event("supabase-status"));
	} catch {
		// ignore storage errors
	}
}

export function recordSupabaseWrite() {
	const current = readSupabaseStatus();
	writeSupabaseStatus({
		...current,
		lastWriteAt: new Date().toISOString(),
	});
}

export function recordSupabaseError(err: unknown) {
	const current = readSupabaseStatus();
	const message = err instanceof Error ? err.message : String(err);
	writeSupabaseStatus({
		...current,
		lastError: message,
		lastErrorAt: new Date().toISOString(),
	});
}
