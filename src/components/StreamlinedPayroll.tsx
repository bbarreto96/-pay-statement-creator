"use client";

import React, { useState, useEffect } from "react";
import { Contractor } from "@/types/contractor";
import { PayStatementData } from "@/types/payStatement";
import {
	getAvailablePayPeriods,
	getDefaultPayPeriod,
	PayPeriod,
} from "../utils/payPeriods";
import {
	getActiveContractors,
	refreshContractorDatabase,
} from "@/data/contractorDatabase";

interface StreamlinedPayrollProps {
	onPayStatementGenerate: (data: PayStatementData) => void;
}

interface VisitEntry {
	buildingName: string;
	payType: "perVisit" | "hourly";
	payPerVisit: number;
	hourlyRate: number;
	numberOfVisits: number;
	hours: number;
	notes: string;
}

const StreamlinedPayroll: React.FC<StreamlinedPayrollProps> = ({
	onPayStatementGenerate,
}) => {
	// Initialize contractors with fresh data from localStorage
	const [contractors, setContractors] = useState<Contractor[]>(() => {
		refreshContractorDatabase();
		return getActiveContractors();
	});
	const [selectedContractor, setSelectedContractor] =
		useState<Contractor | null>(null);
	const [availablePayPeriods] = useState<PayPeriod[]>(getAvailablePayPeriods());
	const [selectedPayPeriod, setSelectedPayPeriod] = useState<string>(
		getDefaultPayPeriod()?.id || getAvailablePayPeriods()[0]?.id || ""
	);
	const [visitEntries, setVisitEntries] = useState<VisitEntry[]>([]);

	// Auto-populate buildings when contractor is selected
	useEffect(() => {
		if (selectedContractor) {
			const entries = selectedContractor.buildings
				.filter((building) => building.isActive)
				.map((building) => ({
					buildingName: building.buildingName,
					payType: building.payType || "perVisit",
					payPerVisit: building.payPerVisit || 0,
					hourlyRate: building.hourlyRate || 0,
					numberOfVisits: 0,
					hours: 0,
					notes: "",
				}));
			setVisitEntries(entries);
		}
	}, [selectedContractor]);
	const updatePayType = (index: number, type: "perVisit" | "hourly") => {
		const updated = [...visitEntries];
		updated[index].payType = type;
		setVisitEntries(updated);
	};

	const updateRate = (index: number, value: number) => {
		const updated = [...visitEntries];
		if (updated[index].payType === "perVisit") {
			updated[index].payPerVisit = value;
		} else {
			updated[index].hourlyRate = value;
		}
		setVisitEntries(updated);
	};

	const updateHours = (index: number, hours: number) => {
		const updated = [...visitEntries];
		updated[index].hours = hours;
		setVisitEntries(updated);
	};

	const updateVisitCount = (index: number, visits: number) => {
		const updated = [...visitEntries];
		updated[index].numberOfVisits = visits;
		setVisitEntries(updated);
	};

	const updateNotes = (index: number, notes: string) => {
		const updated = [...visitEntries];
		updated[index].notes = notes;
		setVisitEntries(updated);
	};

	const totalAmount = visitEntries.reduce((sum, entry) => {
		const lineTotal =
			entry.payType === "hourly"
				? (entry.hourlyRate || 0) * (entry.hours || 0)
				: (entry.payPerVisit || 0) * (entry.numberOfVisits || 0);
		return sum + lineTotal;
	}, 0);

	const generatePayStatement = () => {
		if (!selectedContractor || !selectedPayPeriod) return;

		// Build summary first (authoritative list of lines)
		// We'll derive Table 1 from this to ensure consistency.
		const nonZeroEntries = visitEntries.filter((entry) =>
			entry.payType === "hourly"
				? (entry.hours || 0) > 0
				: (entry.numberOfVisits || 0) > 0
		);

		// Summary includes all non-zero jobs with full details
		const summary = nonZeroEntries.map((entry) => ({
			description:
				entry.payType === "hourly"
					? `${entry.buildingName} (hourly)`
					: entry.buildingName,
			payPerVisit:
				entry.payType === "hourly" ? entry.hourlyRate : entry.payPerVisit,
			numberOfVisits:
				entry.payType === "hourly" ? entry.hours : entry.numberOfVisits,
			qtySuffix: entry.payType === "hourly" ? "hrs" : undefined,
			total:
				entry.payType === "hourly"
					? (entry.hourlyRate || 0) * (entry.hours || 0)
					: (entry.payPerVisit || 0) * (entry.numberOfVisits || 0),
		}));

		// Table 1 derives from summary: only description (without hours) and total
		const paymentDetails = summary.map((s) => ({
			description: s.description.replace(/\s*\(hourly\)$/i, ""),
			amount: s.total,
		}));

		// summary already built above

		const payStatementData: PayStatementData = {
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
				name: selectedContractor.name,
				address: {
					street: selectedContractor.address.street,
					city: selectedContractor.address.city,
					state: selectedContractor.address.state,
					zipCode: selectedContractor.address.zipCode,
				},
			},
			payment: {
				payPeriodId: selectedPayPeriod,
				method: selectedContractor.paymentInfo.method,
			},
			paymentDetails,
			summary,
			totalPayment: totalAmount,
		};

		onPayStatementGenerate(payStatementData);
	};

	return (
		<div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-lg">
			<h2 className="text-2xl font-bold mb-6 text-gray-800">
				🚀 Quick Payroll
			</h2>

			{/* Contractor Selection */}
			<div className="mb-6">
				<h3 className="text-lg font-semibold mb-4 text-gray-700">
					Select Contractor
				</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{contractors.map((contractor) => (
						<div
							key={contractor.id}
							onClick={() => setSelectedContractor(contractor)}
							className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
								selectedContractor?.id === contractor.id
									? "border-blue-500 bg-blue-50"
									: "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
							}`}
						>
							<div className="font-semibold text-gray-900">
								{contractor.name}
							</div>

							<div className="text-xs text-gray-500">
								{contractor.address.city}, {contractor.address.state}
							</div>
							<div className="text-xs text-blue-600 mt-1">
								{contractor.buildings.length} building(s)
							</div>
						</div>
					))}
				</div>
			</div>

			{selectedContractor && (
				<>
					{/* Pay Period */}
					<div className="mb-6">
						<h3 className="text-lg font-semibold mb-4 text-gray-700">
							Pay Period
						</h3>
						<select
							value={selectedPayPeriod}
							onChange={(e) => setSelectedPayPeriod(e.target.value)}
							className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
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

					{/* Building Visits - Auto-populated */}
					<div className="mb-6">
						<h3 className="text-lg font-semibold mb-4 text-gray-700">
							Building Visits for {selectedContractor.name}
						</h3>
						<div className="space-y-4">
							{visitEntries.map((entry, index) => (
								<div
									key={index}
									className="p-4 bg-gray-50 rounded-lg space-y-4"
								>
									<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-gray-700 mb-1">
												Building
											</label>
											<div className="px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900">
												{entry.buildingName}
											</div>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">
												Pay Type
											</label>
											<select
												value={entry.payType}
												onChange={(e) =>
													updatePayType(
														index,
														e.target.value as "perVisit" | "hourly"
													)
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
												style={{ color: "#000000" }}
											>
												<option value="perVisit">Pay Per Visit</option>
												<option value="hourly">Hourly</option>
											</select>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">
												{entry.payType === "hourly"
													? "Hourly Rate"
													: "Pay Per Visit"}
											</label>
											<input
												type="number"
												min="0"
												step="0.01"
												value={
													entry.payType === "hourly"
														? entry.hourlyRate
														: entry.payPerVisit
												}
												onChange={(e) =>
													updateRate(index, parseFloat(e.target.value) || 0)
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
												style={{ color: "#000000" }}
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700 mb-1">
												{entry.payType === "hourly"
													? "Hours"
													: "Number of Visits"}
											</label>
											<input
												type="number"
												min="0"
												value={
													entry.payType === "hourly"
														? entry.hours
														: entry.numberOfVisits
												}
												onChange={(e) =>
													entry.payType === "hourly"
														? updateHours(index, parseInt(e.target.value) || 0)
														: updateVisitCount(
																index,
																parseInt(e.target.value) || 0
														  )
												}
												className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-semibold bg-white text-black"
												style={{ color: "#000000" }}
											/>
										</div>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Notes
										</label>
										<input
											type="text"
											value={entry.notes}
											onChange={(e) => updateNotes(index, e.target.value)}
											className="w-full px-3 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
											style={{ color: "#000000" }}
										/>
									</div>
									{entry.numberOfVisits > 0 && (
										<div className="text-right">
											<span className="text-sm text-gray-600">
												Subtotal:{" "}
												<span className="font-semibold text-green-600">
													$
													{(entry.payPerVisit * entry.numberOfVisits).toFixed(
														2
													)}
												</span>
											</span>
										</div>
									)}
								</div>
							))}
						</div>

						{/* Total Display */}
						<div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
							<div className="text-center">
								<span className="text-2xl font-bold text-green-700">
									Total Payment: ${totalAmount.toFixed(2)}
								</span>
							</div>
						</div>
					</div>

					{/* Generate Button */}
					<div className="text-center">
						<button
							onClick={generatePayStatement}
							disabled={totalAmount === 0}
							className="px-8 py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors text-xl font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
						>
							{totalAmount === 0
								? "Enter Visit Counts"
								: `Generate Pay Statement - $${totalAmount.toFixed(2)}`}
						</button>
					</div>
				</>
			)}
		</div>
	);
};

export default StreamlinedPayroll;
