"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	getAvailablePayPeriods,
	getDefaultPayPeriod,
	PayPeriod,
} from "@/utils/payPeriods";
import { usePayPeriod } from "@/contexts/PayPeriodContext";
import SupabaseStatusBadge from "@/components/SupabaseStatusBadge";

interface TopBarProps {
	selectedPayPeriodId?: string;
	onChangePayPeriod?: (id: string) => void;
	onHomeClick?: () => void; // optional: let parent define Home behavior
}

const TopBar: React.FC<TopBarProps> = ({
	selectedPayPeriodId,
	onChangePayPeriod,
	onHomeClick,
}) => {
	const router = useRouter();
	const [ctxPayPeriodId, setCtxPayPeriodId] = usePayPeriod();
	const [isLoggingOut, setIsLoggingOut] = React.useState(false);

	// Avoid SSR/CSR mismatch by gating dynamic, time/localStorage-based values until mount
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => setMounted(true), []);

	const periods: PayPeriod[] = mounted ? getAvailablePayPeriods() : [];
	const defaultPeriod = mounted ? getDefaultPayPeriod() : null;
	const currentId = mounted ? (selectedPayPeriodId ?? ctxPayPeriodId ?? defaultPeriod?.id ?? "") : "";

	const onLogout = async () => {
		if (isLoggingOut) return;
		setIsLoggingOut(true);
		try {
			await fetch("/api/auth/logout", { method: "POST" });
		} finally {
			router.replace("/login");
			router.refresh();
			setIsLoggingOut(false);
		}
	};

	return (
		<header className="sticky top-0 z-30 w-full app-topbar">
			<div className="max-w-[1600px] mx-auto px-5 h-[70px] flex items-center justify-between gap-4">
				{/* Left: Logo/Home */}
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => (onHomeClick ? onHomeClick() : router.push("/"))}
						className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
						aria-label="Go to Home"
						title="Go to Home"
					>
						<span className="text-lg">🏠</span>
						<span className="section-title text-base text-white hidden sm:inline">Pay Statement Studio</span>
					</button>
				</div>

				{/* Center: Pay Period Selector */}
				<div className="flex-1 flex justify-center">
					<div className="flex items-center gap-2">
						<label htmlFor="pay-period" className="text-sm text-white/60 hidden sm:inline">
							Pay Period
						</label>
						{!mounted ? (
							<select id="pay-period" className="input-field text-sm" disabled aria-busy="true">
								<option>Loading…</option>
							</select>
						) : (
							<select
								id="pay-period"
								className="input-field text-sm"
								value={currentId}
								onChange={(e) => (onChangePayPeriod ? onChangePayPeriod(e.target.value) : setCtxPayPeriodId(e.target.value))}
							>
								{periods.map((p) => (
									<option key={p.id} value={p.id}>
										{p.label}
									</option>
								))}
							</select>
						)}
					</div>
				</div>

				{/* Right: Status / Settings / Log out */}
				<nav className="flex items-center gap-2 text-sm">
					<SupabaseStatusBadge />
					<Link href="/settings" className="text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/10 font-medium">
						Settings
					</Link>
					<button
						type="button"
						className="text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-white/10 font-medium"
						onClick={onLogout}
						disabled={isLoggingOut}
					>
						{isLoggingOut ? "Logging out…" : "Log out"}
					</button>
				</nav>
			</div>
		</header>
	);
};

export default TopBar;
