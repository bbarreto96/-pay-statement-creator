"use client";

import React, { useEffect, useState } from "react";
import { formatUSD } from "@/utils/format";
import {
	PayStatementData,
	PaymentDetail,
	SummaryItem,
} from "@/types/payStatement";
import {
	getAvailablePayPeriods,
	getDefaultPayPeriod,
	PayPeriod,
} from "../utils/payPeriods";

interface PayStatementFormProps {
	onDataChange: (data: PayStatementData) => void;
	initialData?: PayStatementData;
	// UX: allow hiding of rarely-changed company info (moved to Settings)
	hideCompanyInfo?: boolean;
	// UX: allow external control of pay period (e.g., from TopBar)
	externalPayPeriodId?: string;
}

const PayStatementForm: React.FC<PayStatementFormProps> = ({
	onDataChange,
	initialData,
	hideCompanyInfo,
	externalPayPeriodId,
}) => {
	const [availablePayPeriods] = useState<PayPeriod[]>(getAvailablePayPeriods());
	const currentPayPeriod = getDefaultPayPeriod();

	const [formData, setFormData] = useState<PayStatementData>(
		initialData || {
			companyName: "ELEMENT CLEANING SYSTEMS LLC",
			companyAddress: {
				street: "1400 112th Ave Se",
				suite: "Suite 100",
				city: "Bellevue",
				state: "WA",
				zipCode: "98004",
			},
			companyPhone: "425-591-9427",
			paidTo: {
				name: "[Name]",
				address: {
					city: "[City, State Zipcode]",
					state: "",
					zipCode: "",
				},
			},
			payment: {
				payPeriodId: currentPayPeriod?.id || availablePayPeriods[0]?.id || "",
				method: "Direct Deposit",
			},

			paymentDetails: [{ description: "", amount: 0 }],
			summary: [
				{
					description: "[name of building]",
					payPerVisit: 0,
					numberOfVisits: 0,
					total: 0,
				},
			],
			totalPayment: 0,
		}
	);

	// Manual entry helpers: encode pay type + quantity in notes
	type ManualMeta = { payType: "perVisit" | "hourly"; qty: number };
	const parseMeta = (notes?: string | null): ManualMeta => {
		try {
			if (!notes) return { payType: "perVisit", qty: 1 };
			const m = new URLSearchParams(String(notes));
			const type = (m.get("type") as ManualMeta["payType"]) || "perVisit";
			const qty = Number(m.get("qty") || 1);
			return {
				payType: type === "hourly" ? "hourly" : "perVisit",
				// Allow zero quantity explicitly entered by the user; default to 1 only when invalid
				qty: isFinite(qty) && qty >= 0 ? qty : 1,
			};
		} catch {
			return { payType: "perVisit", qty: 1 };
		}
	};
	const serializeMeta = (meta: ManualMeta): string => {
		const p = new URLSearchParams();
		p.set("type", meta.payType);
		p.set("qty", String(meta.qty ?? 1));
		return p.toString();
	};

	// Helper: derive Summary and total from Payment Details (single source of truth)
	const filterAndDerive = (details: PaymentDetail[]) => {
		// Include both positive and negative amounts; exclude only zero-amount or empty description lines
		const filtered = (details || []).filter(
			(d) => (d.description?.trim()?.length || 0) > 0 && (d.amount ?? 0) !== 0
		);
		const summary: SummaryItem[] = filtered.map((d) => {
			const meta = parseMeta(d.notes);
			const rate = d.amount || 0;
			const qty = meta.qty ?? 1;
			const isHourly = meta.payType === "hourly";
			return {
				description: isHourly
					? `${d.description || ""} (hourly)`
					: d.description || "",
				payPerVisit: rate,
				numberOfVisits: qty,
				qtySuffix: isHourly ? "hrs" : undefined,
				total: rate * qty,
			};
		});
		const totalPayment = summary.reduce((sum, s) => sum + (s.total || 0), 0);
		return { summary, totalPayment };
	};

	// On mount, normalize summary/total from existing paymentDetails using the same derivation logic
	useEffect(() => {
		const { summary, totalPayment } = filterAndDerive(
			formData.paymentDetails || []
		);
		const newData = { ...formData, summary, totalPayment };
		setFormData(newData);
		onDataChange(newData);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Sync external pay period when controlled from parent TopBar
	useEffect(() => {
		if (!externalPayPeriodId) return;
		if (formData.payment.payPeriodId !== externalPayPeriodId) {
			const newData = {
				...formData,
				payment: { ...formData.payment, payPeriodId: externalPayPeriodId },
			};
			setFormData(newData);
			onDataChange(newData);
		}
	}, [externalPayPeriodId]);

	const updateFormData = (updates: Partial<PayStatementData>) => {
		const newData = { ...formData, ...updates };
		setFormData(newData);
		onDataChange(newData);
	};

	const addPaymentDetail = () => {
		const newDetails = [
			...formData.paymentDetails,
			{ description: "", amount: 0 },
		];
		// derive summary + total from Payment Details
		const { summary, totalPayment } = filterAndDerive(newDetails);
		updateFormData({ paymentDetails: newDetails, summary, totalPayment });
	};

	const updatePaymentDetail = (
		index: number,
		field: keyof PaymentDetail,
		value: string | number
	) => {
		const newDetails = [...formData.paymentDetails];
		newDetails[index] = { ...newDetails[index], [field]: value };
		const { summary, totalPayment } = filterAndDerive(newDetails);
		updateFormData({ paymentDetails: newDetails, totalPayment, summary });
	};

	const removePaymentDetail = (index: number) => {
		const newDetails = formData.paymentDetails.filter((_, i) => i !== index);
		const { summary, totalPayment } = filterAndDerive(newDetails);
		updateFormData({ paymentDetails: newDetails, totalPayment, summary });
	};

	// Summary is auto-derived; no direct editing handlers needed

	return (
		<div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-lg">
			<h2 className="text-2xl font-bold mb-6 text-gray-800">
				Pay Statement Creator
			</h2>

			{/* Company Information (hidden by default; moved to Settings) */}
			{!hideCompanyInfo && (
				<div className="mb-6">
					<h3 className="text-lg font-semibold mb-4 text-gray-700">
						Company Information
					</h3>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Company Name
							</label>
							<input
								type="text"
								value={formData.companyName}
								onChange={(e) =>
									updateFormData({ companyName: e.target.value })
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
								style={{ color: "#000000" }}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Phone
							</label>
							<input
								type="text"
								value={formData.companyPhone}
								onChange={(e) =>
									updateFormData({ companyPhone: e.target.value })
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
								style={{ color: "#000000" }}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Street Address
							</label>
							<input
								type="text"
								value={formData.companyAddress.street}
								onChange={(e) =>
									updateFormData({
										companyAddress: {
											...formData.companyAddress,
											street: e.target.value,
										},
									})
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
								style={{ color: "#000000" }}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Suite/Unit
							</label>
							<input
								type="text"
								value={formData.companyAddress.suite || ""}
								onChange={(e) =>
									updateFormData({
										companyAddress: {
											...formData.companyAddress,
											suite: e.target.value,
										},
									})
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
								style={{ color: "#000000" }}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								City
							</label>
							<input
								type="text"
								value={formData.companyAddress.city}
								onChange={(e) =>
									updateFormData({
										companyAddress: {
											...formData.companyAddress,
											city: e.target.value,
										},
									})
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
								style={{ color: "#000000" }}
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									State
								</label>
								<input
									type="text"
									value={formData.companyAddress.state}
									onChange={(e) =>
										updateFormData({
											companyAddress: {
												...formData.companyAddress,
												state: e.target.value,
											},
										})
									}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
									style={{ color: "#000000" }}
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									ZIP Code
								</label>
								<input
									type="text"
									value={formData.companyAddress.zipCode}
									onChange={(e) =>
										updateFormData({
											companyAddress: {
												...formData.companyAddress,
												zipCode: e.target.value,
											},
										})
									}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
									style={{ color: "#000000" }}
								/>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Paid To Information */}
			<div className="mb-6">
				<h3 className="text-lg font-semibold mb-4 text-gray-700">Paid To</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Name
						</label>
						<input
							type="text"
							value={formData.paidTo.name}
							onChange={(e) =>
								updateFormData({
									paidTo: { ...formData.paidTo, name: e.target.value },
								})
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
							style={{ color: "#000000" }}
						/>
					</div>
				</div>
			</div>

			{/* Payment Information */}
			<div className="mb-6">
				<h3 className="text-lg font-semibold mb-4 text-gray-700">
					Payment Information
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Pay Period
						</label>
						<select
							value={formData.payment.payPeriodId}
							onChange={(e) =>
								updateFormData({
									payment: { ...formData.payment, payPeriodId: e.target.value },
								})
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
							style={{ color: "#000000" }}
						>
							<option value="">Select Pay Period</option>
							{availablePayPeriods.map((period) => (
								<option key={period.id} value={period.id}>
									{period.label}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Method
						</label>
						<select
							value={formData.payment.method}
							onChange={(e) =>
								updateFormData({
									payment: { ...formData.payment, method: e.target.value },
								})
							}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
							style={{ color: "#000000" }}
						>
							<option value="Direct Deposit">Direct Deposit</option>
							<option value="Check">Check</option>
							<option value="Cash">Cash</option>
							<option value="Wire Transfer">Wire Transfer</option>
						</select>
					</div>
				</div>
			</div>

			{/* Payment Details */}
			<div className="mb-6">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-semibold text-gray-700">
						Payment Details
					</h3>
					<button
						onClick={addPaymentDetail}
						className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						Add Item
					</button>
				</div>

				{/*
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-semibold text-gray-700">
						Payment Details
					</h3>
					<button
						onClick={addPaymentDetail}
								<div className="flex-1">
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Pay Type
									</label>
									<select
										value={(() => (detail.notes && parseMeta(detail.notes).payType) || "perVisit")()}
										onChange={(e) => {
											const meta = parseMeta(detail.notes);
											const next = { ...meta, payType: e.target.value as "perVisit" | "hourly" };
											updatePaymentDetail(index, "notes", serializeMeta(next));
										}}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
										style={{ color: "#000000" }}
									>
										<option value="perVisit">Pay Per Visit</option>
										<option value="hourly">Hourly</option>
									</select>
								</div>
								<div className="flex-1">
									<label className="block text-sm font-medium text-gray-700 mb-1">
										{(() => (detail.notes && parseMeta(detail.notes).payType) === "hourly" ? "Hours" : "Quantity")()}
									</label>
									<input
										type="number"
										min="0"
										step="0.25"
										value={(() => (detail.notes && parseMeta(detail.notes).qty) || 1)()}
										onChange={(e) => {
											const meta = parseMeta(detail.notes);
											const qty = parseFloat(e.target.value) || 0;
											updatePaymentDetail(index, "notes", serializeMeta({ ...meta, qty }));
										}}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
										style={{ color: "#000000" }}
									/>
								</div>

						className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						Add Item
					</button>
*/}
				{formData.paymentDetails.map((detail, index) => (
					<div
						key={index}
						className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4 p-4 border border-gray-200 rounded-md"
					>
						<div className="md:col-span-3">
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Description
							</label>
							<input
								type="text"
								value={detail.description}
								onChange={(e) =>
									updatePaymentDetail(index, "description", e.target.value)
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
								style={{ color: "#000000" }}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Amount
							</label>
							<input
								type="number"
								step="0.01"
								value={detail.amount}
								onChange={(e) =>
									updatePaymentDetail(
										index,
										"amount",
										parseFloat(e.target.value) || 0
									)
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
								style={{ color: "#000000" }}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Pay Type
							</label>
							<select
								value={
									(detail.notes && parseMeta(detail.notes).payType) ||
									"perVisit"
								}
								onChange={(e) => {
									const meta = parseMeta(detail.notes);
									updatePaymentDetail(
										index,
										"notes",
										serializeMeta({
											...meta,
											payType: e.target.value as "perVisit" | "hourly",
										})
									);
								}}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
								style={{ color: "#000000" }}
							>
								<option value="perVisit">Pay Per Visit</option>
								<option value="hourly">Hourly</option>
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								{(detail.notes && parseMeta(detail.notes).payType) === "hourly"
									? "Hours"
									: "Quantity"}
							</label>
							<input
								type="number"
								min={0}
								step={0.25}
								value={detail.notes ? parseMeta(detail.notes).qty : 1}
								onChange={(e) => {
									const meta = parseMeta(detail.notes);
									const qty = parseFloat(e.target.value) || 0;
									updatePaymentDetail(
										index,
										"notes",
										serializeMeta({ ...meta, qty })
									);
								}}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
								style={{ color: "#000000" }}
							/>
						</div>
						<div className="flex items-end">
							<button
								onClick={() => removePaymentDetail(index)}
								className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
							>
								Remove
							</button>
						</div>
					</div>
				))}
				<div className="sticky bottom-0 bg-white py-2 text-right border-t border-gray-200">
					<span className="text-lg font-semibold">
						Total: {formatUSD(formData.totalPayment)}
					</span>
					<div className="text-sm text-gray-500 mt-1">
						Summary auto-updates to match Payment Details
					</div>
				</div>
			</div>

			<div className="mb-6">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-semibold text-gray-700">Summary</h3>
					<div className="text-sm text-gray-500">
						Auto-synced from Payment Details
					</div>
				</div>
				{formData.summary.map((item, index) => (
					<div
						key={index}
						className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 border border-gray-200 rounded-md"
					>
						<div className="md:col-span-2">
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Description
							</label>
							<div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-black">
								{item.description}
							</div>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								{item.qtySuffix === "hrs" ? "Rate (per hour)" : "Pay Per Visit"}
							</label>
							<div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-black">
								${"" + item.payPerVisit.toFixed(2)}
							</div>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								{item.qtySuffix === "hrs" ? "Hours" : "Number of Visits"}
							</label>
							<div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-black">
								{item.numberOfVisits}
							</div>
						</div>
						<div className="flex items-end gap-2">
							<div className="flex-1">
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Total
								</label>
								<div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-black">
									${"" + item.total.toFixed(2)}
								</div>
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Notes Section */}
			<div className="mb-6">
				<h3 className="text-lg font-semibold mb-4 text-gray-700">Notes</h3>
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Additional Notes (Optional)
					</label>
					<textarea
						value={formData.notes || ""}
						onChange={(e) => updateFormData({ notes: e.target.value })}
						rows={4}
						className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
						style={{ color: "#000000" }}
						placeholder="Enter any additional notes for this pay statement..."
					/>
				</div>
			</div>
		</div>
	);
};

export default PayStatementForm;
