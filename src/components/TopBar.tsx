"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	getAvailablePayPeriods,
	getDefaultPayPeriod,
	PayPeriod,
} from "@/utils/payPeriods";

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
	const periods: PayPeriod[] = getAvailablePayPeriods();
	const defaultPeriod = getDefaultPayPeriod();
	const currentId = selectedPayPeriodId || defaultPeriod?.id || "";

	return (
		<header className="sticky top-0 z-30 w-full bg-white/90 backdrop-blur border-b border-gray-200">
			<div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
				{/* Left: Logo/Name + Home */}
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => (onHomeClick ? onHomeClick() : router.push("/"))}
						className="text-black font-semibold hover:underline cursor-pointer"
						aria-label="Go to Home"
						title="Go to Home"
					>
						Home
					</button>
					<span className="text-black">|</span>
					<div className="text-sm text-black hidden sm:block">
						Pay Statement Creator
					</div>
				</div>

				{/* Center: Pay Period Selector */}
				<div className="flex-1 flex justify-center">
					<div className="flex items-center gap-2">
						<label htmlFor="pay-period" className="text-sm text-black">
							Pay Period
						</label>
						<select
							id="pay-period"
							className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-black"
							value={currentId}
							onChange={(e) => onChangePayPeriod?.(e.target.value)}
						>
							{periods.map((p) => (
								<option key={p.id} value={p.id}>
									{p.label}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Right: Settings / Help */}
				<nav className="flex items-center gap-4 text-sm">
					<Link href="/settings" className="text-black hover:text-black">
						Settings
					</Link>
					<a
						href="https://github.com"
						target="_blank"
						rel="noreferrer"
						className="text-black hover:text-black"
					>
						Help
					</a>
				</nav>
			</div>
		</header>
	);
};

export default TopBar;
