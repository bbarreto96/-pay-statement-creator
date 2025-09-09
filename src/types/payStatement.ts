export interface PaymentDetail {
	description: string;
	amount: number;
	notes?: string;
}

export interface SummaryItem {
	description: string;
	payPerVisit: number;
	numberOfVisits: number;
	qtySuffix?: string; // e.g., 'hrs' for hourly
	total: number;
}

export interface PayStatementData {
	// Company Information
	companyName: string;
	companyAddress: {
		street: string;
		suite?: string;
		city: string;
		state: string;
		zipCode: string;
	};
	companyPhone: string;

	// Payment Information
	paidTo: {
		name: string;
		address: {
			street?: string;
			city: string;
			state: string;
			zipCode: string;
		};
	};

	// Payment Details
	payment: {
		payPeriodId: string;
		method: string;
	};

	// Payment Details Table
	paymentDetails: PaymentDetail[];

	// Summary Table
	summary: SummaryItem[];

	// Totals
	totalPayment: number;

	// Notes
	notes?: string;
}
