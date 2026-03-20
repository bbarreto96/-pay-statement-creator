"use client";

import { useEffect, useState } from "react";
import { readSupabaseStatus, SupabaseStatus } from "@/lib/supabase/status";

export function useSupabaseStatus(): SupabaseStatus {
	const [status, setStatus] = useState<SupabaseStatus>(() =>
		readSupabaseStatus()
	);

	useEffect(() => {
		const handler = () => setStatus(readSupabaseStatus());
		window.addEventListener("supabase-status", handler);
		window.addEventListener("storage", handler);
		return () => {
			window.removeEventListener("supabase-status", handler);
			window.removeEventListener("storage", handler);
		};
	}, []);

	return status;
}
