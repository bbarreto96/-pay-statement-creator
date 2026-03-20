"use client";

import React from "react";
import { useSupabaseStatus } from "@/hooks/useSupabaseStatus";

const isSupabase = process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase";

function formatAgo(iso?: string) {
	if (!iso) return "never";
	const ts = new Date(iso).getTime();
	if (Number.isNaN(ts)) return "unknown";
	const deltaSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
	if (deltaSec < 10) return "just now";
	if (deltaSec < 60) return `${deltaSec}s ago`;
	const mins = Math.floor(deltaSec / 60);
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

const SupabaseStatusBadge: React.FC = () => {
	const { lastWriteAt, lastError, lastErrorAt } = useSupabaseStatus();
	if (!isSupabase) return null;
	const lastWriteMs = lastWriteAt ? new Date(lastWriteAt).getTime() : 0;
	const lastErrorMs = lastErrorAt ? new Date(lastErrorAt).getTime() : 0;
	const hasError = Boolean(lastError && lastErrorMs > lastWriteMs);
	const statusLabel = hasError ? "Supabase: error" : "Supabase: ok";
	const detail = hasError
		? lastError || "Unknown error"
		: lastWriteAt
		? `Last save ${formatAgo(lastWriteAt)}`
		: "No saves yet";

	return (
		<div
			className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded border border-gray-200 bg-white/90"
			title={detail}
		>
			<span
				className={`inline-flex h-2 w-2 rounded-full ${
					hasError ? "bg-red-500" : "bg-emerald-500"
				}`}
				aria-hidden="true"
			/>
			<span className="text-gray-700">{statusLabel}</span>
		</div>
	);
};

export default SupabaseStatusBadge;
