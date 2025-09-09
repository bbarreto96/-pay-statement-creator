export interface PayPeriod {
	id: string;
	startDate: string; // ISO date YYYY-MM-DD
	endDate: string; // ISO date YYYY-MM-DD
	label: string; // e.g., 08/18/2025 – 08/31/2025
}

// Format helpers
const pad2 = (n: number) => n.toString().padStart(2, "0");
const formatISO = (d: Date) =>
	`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatLabel = (start: Date, end: Date) =>
	`${pad2(start.getMonth() + 1)}/${pad2(
		start.getDate()
	)}/${start.getFullYear()} – ${pad2(end.getMonth() + 1)}/${pad2(
		end.getDate()
	)}/${end.getFullYear()}`;

// Generate bi-weekly pay periods between [startISO, endISO], inclusive of periods whose end <= endISO
function generateBiWeeklyPeriods(
	startISO: string,
	endISO: string
): PayPeriod[] {
	const start = new Date(`${startISO}T00:00:00`);
	const endBoundary = new Date(`${endISO}T23:59:59`);
	const periods: PayPeriod[] = [];

	let k = 0;
	while (true) {
		const periodStart = new Date(start);
		periodStart.setDate(start.getDate() + 14 * k);
		const periodEnd = new Date(periodStart);
		periodEnd.setDate(periodEnd.getDate() + 13);

		if (periodEnd > endBoundary) break;

		const id = `pp-${(k + 1).toString().padStart(3, "0")}`;
		periods.push({
			id,
			startDate: formatISO(periodStart),
			endDate: formatISO(periodEnd),
			label: formatLabel(periodStart, periodEnd),
		});
		k += 1;
	}

	return periods;
}

const GENERATED_PERIODS: PayPeriod[] = generateBiWeeklyPeriods(
	"2025-08-18",
	"2026-08-30"
);

export const getAvailablePayPeriods = (): PayPeriod[] => {
	const today = new Date();
	const cutoffDays = 9; // show through 9 days after end

	return GENERATED_PERIODS.filter((period) => {
		const endDate = new Date(`${period.endDate}T00:00:00`);
		const cutoffDate = new Date(endDate);
		cutoffDate.setDate(cutoffDate.getDate() + cutoffDays);
		return today <= cutoffDate;
	});
};

export const getCurrentPayPeriod = (): PayPeriod | null => {
	const today = new Date();

	const currentPeriod = GENERATED_PERIODS.find((period) => {
		const startDate = new Date(`${period.startDate}T00:00:00`);
		const endDate = new Date(`${period.endDate}T23:59:59`);
		return today >= startDate && today <= endDate;
	});

	return currentPeriod || null;
};

export const getPayPeriodById = (id: string): PayPeriod | null => {
	return GENERATED_PERIODS.find((period) => period.id === id) || null;
};

export const getDefaultPayPeriod = (): PayPeriod | null => {
	const today = new Date();
	const visible = getAvailablePayPeriods();

	// 1) Active period (if any)
	const active = visible.find((p) => {
		const start = new Date(`${p.startDate}T00:00:00`);
		const end = new Date(`${p.endDate}T23:59:59`);
		return today >= start && today <= end;
	});
	if (active) return active;

	// 2) Next upcoming
	const upcoming = visible.find((p) => {
		const start = new Date(`${p.startDate}T00:00:00`);
		return start > today;
	});
	if (upcoming) return upcoming;

	// 3) Most recent still visible (within grace)
	return visible.length > 0 ? visible[visible.length - 1] : null;
};
