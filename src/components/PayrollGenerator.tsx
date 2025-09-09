"use client";

import React, { useState } from "react";
import { Contractor } from "@/types/contractor";
import { PayStatementData } from "@/types/payStatement";
import ContractorSelector from "./ContractorSelector";

interface PayrollGeneratorProps {
	onPayStatementGenerate: (data: PayStatementData) => void;
}

interface VisitEntry {
	buildingName: string;
	payType: "perVisit" | "hourly";
	payPerVisit?: number; // used when payType = perVisit
	hourlyRate?: number; // used when payType = hourly
	numberOfVisits?: number; // used when payType = perVisit
	hours?: number; // used when payType = hourly
}

const PayrollGenerator: React.FC<PayrollGeneratorProps> = ({
	onPayStatementGenerate,
}) => {
	const [selectedContractor, setSelectedContractor] = useState<
		Contractor | undefined
	>();
	const [payPeriod, setPayPeriod] = useState({
		startDate: "",
		endDate: "",
	});
	const [visitEntries, setVisitEntries] = useState<VisitEntry[]>([]);

	const handleContractorSelect = (contractor: Contractor) => {
		setSelectedContractor(contractor);
		// Initialize visit entries with contractor's buildings
		const entries: VisitEntry[] = contractor.buildings
			.filter((building) => building.isActive)
			.map((building) => ({
				buildingName: building.buildingName,
				payType: building.payType || "perVisit",
				payPerVisit: building.payPerVisit,
				hourlyRate: building.hourlyRate || 0,
				numberOfVisits: 0,
				hours: 0,
			}));
		setVisitEntries(entries);
	};

	const updateVisitCount = (index: number, visits: number) => {
		const updated = [...visitEntries];
		updated[index].numberOfVisits = visits;
		setVisitEntries(updated);
	};

	const updateHours = (index: number, hours: number) => {
		const updated = [...visitEntries];
		updated[index].hours = hours;
		setVisitEntries(updated);
	};

	const generatePayStatement = () => {
		if (!selectedContractor || !payPeriod.endDate) return;

		// Calculate payment details (per-visit and hourly)
		const paymentDetails = visitEntries
			.filter(
				(entry) =>
					(entry.payType === "perVisit" && (entry.numberOfVisits ?? 0) > 0) ||
					(entry.payType === "hourly" &&
						(entry.hours ?? entry.numberOfVisits ?? 0) > 0)
			)
			.map((entry) => {
				if (entry.payType === "hourly") {
					const hours = entry.hours ?? entry.numberOfVisits ?? 0;
					const rate = entry.hourlyRate ?? 0;
					return {
						description: entry.buildingName,
						amount: rate * hours,
					};
				}
				const visits = entry.numberOfVisits ?? 0;
				const p = entry.payPerVisit ?? 0;
				return {
					description: `${entry.buildingName} - ${visits} visits`,
					amount: p * visits,
				};
			});

		// Calculate summary
		const summary = visitEntries
			.filter(
				(entry) =>
					(entry.payType === "perVisit" && (entry.numberOfVisits ?? 0) > 0) ||
					(entry.payType === "hourly" &&
						(entry.hours ?? entry.numberOfVisits ?? 0) > 0)
			)
			.map((entry) => {
				if (entry.payType === "hourly") {
					const hours = entry.hours ?? 0;
					const rate = entry.hourlyRate ?? 0;
					return {
						description: `${entry.buildingName} (hourly)`,
						payPerVisit: rate,
						numberOfVisits: hours,
						total: rate * hours,
					};
				}
				const visits = entry.numberOfVisits ?? 0;
				const p = entry.payPerVisit ?? 0;
				return {
					description: entry.buildingName,
					payPerVisit: p,
					numberOfVisits: visits,
					total: p * visits,
				};
			});

		const totalPayment = paymentDetails.reduce(
			(sum, detail) => sum + detail.amount,
			0
		);

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
					city: selectedContractor.address.city,
					state: selectedContractor.address.state,
					zipCode: selectedContractor.address.zipCode,
				},
			},
			payment: {
				payPeriodId: payPeriod.endDate,
				method: selectedContractor.paymentInfo.method,
			},
			paymentDetails,
			summary,
			totalPayment,
		};

		onPayStatementGenerate(payStatementData);
	};

	const totalAmount = visitEntries.reduce((sum, entry) => {
		if (entry.payType === "hourly") {
			const hours = entry.hours ?? entry.numberOfVisits ?? 0;
			return sum + (entry.hourlyRate ?? 0) * hours;
		}
		return sum + (entry.payPerVisit ?? 0) * (entry.numberOfVisits ?? 0);
	}, 0);

	return (
		<div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-lg">
			<h2 className="text-2xl font-bold mb-6 text-gray-800">
				Payroll Generator
			</h2>

			<ContractorSelector
				onContractorSelect={handleContractorSelect}
				selectedContractor={selectedContractor}
			/>

			{selectedContractor && (
				<>
					{/* Pay Period */}
					<div className="mb-6">
						<h3 className="text-lg font-semibold mb-4 text-gray-700">
							Pay Period
						</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Start Date
								</label>
								<input
									type="date"
									value={payPeriod.startDate}
									onChange={(e) =>
										setPayPeriod({ ...payPeriod, startDate: e.target.value })
									}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									End Date (Payment Date)
								</label>
								<input
									type="date"
									value={payPeriod.endDate}
									onChange={(e) =>
										setPayPeriod({ ...payPeriod, endDate: e.target.value })
									}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
						</div>
					</div>

					{/* Visit Entries */}
					<div className="mb-6">
						<h3 className="text-lg font-semibold mb-4 text-gray-700">
							Building Visits
						</h3>
						<div className="space-y-3">
							{visitEntries.map((entry, index) => (
								<div
									key={index}
									className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-gray-200 rounded-md"
								>
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Building
										</label>
										<input
											type="text"
											value={entry.buildingName}
											readOnly
											className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Pay Type
										</label>
										<select
											value={entry.payType}
											onChange={(e) => {
												const updated = [...visitEntries];
												updated[index].payType = e.target.value as
													| "perVisit"
													| "hourly";
												setVisitEntries(updated);
											}}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
											type="text"
											value={
												entry.payType === "hourly"
													? `$${(entry.hourlyRate ?? 0).toFixed(2)}`
													: `$${(entry.payPerVisit ?? 0).toFixed(2)}`
											}
											readOnly
											className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
										/>
									</div>
									<div>
										{entry.payType === "hourly" ? (
											<>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													Hours
												</label>
												<input
													type="number"
													min="0"
													step="0.25"
													value={entry.hours ?? 0}
													onChange={(e) =>
														updateHours(index, parseFloat(e.target.value) || 0)
													}
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
												/>
											</>
										) : (
											<>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													Number of Visits
												</label>
												<input
													type="number"
													min="0"
													value={entry.numberOfVisits ?? 0}
													onChange={(e) =>
														updateVisitCount(
															index,
															parseInt(e.target.value) || 0
														)
													}
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
												/>
											</>
										)}
									</div>
								</div>
							))}
						</div>

						<div className="mt-4 text-right">
							<span className="text-lg font-semibold">
								Total Amount: ${totalAmount.toFixed(2)}
							</span>
						</div>
					</div>

					{/* Generate Button */}
					<div className="text-center">
						<button
							onClick={generatePayStatement}
							disabled={!payPeriod.endDate || totalAmount === 0}
							className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors text-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
						>
							Generate Pay Statement
						</button>
					</div>
				</>
			)}
		</div>
	);
};

export default PayrollGenerator;
