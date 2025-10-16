"use client";

import React, { useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import ContractorSelector from "@/components/ContractorSelector";
import ContractorManager from "@/components/ContractorManager";
import PayStatementForm from "@/components/PayStatementForm";
import PDFGenerator from "@/components/PDFGenerator";
import { Contractor } from "@/types/contractor";
import { PayStatementData } from "@/types/payStatement";
import { getDefaultPayPeriod } from "@/utils/payPeriods";

/**
 * HomeLayout implements the IA described in docs/HOME_PAGE_GAMEPLAN.md
 * - TopBar: Home/Settings, Pay Period selector
 * - Left rail: Subcontractor selection
 * - Main workspace: Jobs & Summary (PayStatementForm) and Preview/PDF
 * - Right drawer (future): Batch queue (not implemented in this first pass)
 */
const HomeLayout: React.FC = () => {
	const [selectedContractor, setSelectedContractor] =
		useState<Contractor | null>(null);
	const [payStatementData, setPayStatementData] =
		useState<PayStatementData | null>(null);
	const [showPreview, setShowPreview] = useState(false);
	const [showContractorManager, setShowContractorManager] = useState(false);
	const defaultPeriod = getDefaultPayPeriod();

	const [payPeriodId, setPayPeriodId] = useState<string>(
		defaultPeriod?.id || ""
	);

	// Keep preview data in sync if the pay period changes via TopBar
	useEffect(() => {
		setPayStatementData((prev) => {
			if (!prev) return prev;
			if (prev.payment.payPeriodId === payPeriodId) return prev;
			return { ...prev, payment: { ...prev.payment, payPeriodId } };
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [payPeriodId]);
	// If the user changes Pay Period inside the form, reflect it in TopBar
	useEffect(() => {
		if (!payStatementData) return;
		const id = payStatementData.payment.payPeriodId;
		if (id && id !== payPeriodId) setPayPeriodId(id);
	}, [payStatementData, payPeriodId]);
	// When contractor changes, seed the PayStatementForm with defaults for speed
	const initialData: PayStatementData | undefined = useMemo(() => {
		if (!selectedContractor) return undefined;
		const seededDetails = (selectedContractor.buildings || [])
			.filter((b) => b.isActive)
			.map((b) => ({
				description:
					b.buildingName + (b.payType === "hourly" ? " (hourly)" : ""),
				amount:
					(b.payType === "hourly" ? b.hourlyRate || 0 : b.payPerVisit || 0) ||
					0,
			}));
		return {
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
				payPeriodId: payPeriodId || defaultPeriod?.id || "",
				method: selectedContractor.paymentInfo.method,
			},
			paymentDetails:
				seededDetails.length > 0
					? seededDetails
					: [{ description: "", amount: 0 }],
			summary: [
				{
					description: "[name of building]",
					payPerVisit: 0,
					numberOfVisits: 0,
					total: 0,
				},
			],
			totalPayment: 0,
			notes: "",
		};
	}, [selectedContractor, defaultPeriod?.id, payPeriodId]);

	return (
		<div className="min-h-screen bg-white text-black">
			<TopBar
				selectedPayPeriodId={payPeriodId}
				onChangePayPeriod={setPayPeriodId}
				onHomeClick={() => {
					// Reset the Home workspace to initial state
					setSelectedContractor(null);
					setPayStatementData(null);
					setShowPreview(false);
					setShowContractorManager(false);
				}}
			/>
			<div className="container mx-auto px-4 py-4 grid grid-cols-1 md:grid-cols-12 gap-4">
				{/* Left rail: Contractor selection */}
				<aside className="md:col-span-4 lg:col-span-3">
					<div className="bg-white border rounded-lg p-4">
						<div className="flex items-center justify-between mb-2">
							<h3 className="text-lg font-semibold text-black">Contractors</h3>
							<button
								onClick={() => setShowContractorManager(true)}
								className="px-2 py-1 text-sm bg-blue-600 text-white rounded-md"
							>
								Manage
							</button>
						</div>
						<ContractorSelector
							selectedContractor={selectedContractor || undefined}
							onContractorSelect={(c) => {
								setSelectedContractor(c);
								setPayStatementData(null); // reset persisted form when switching contractors
								setShowPreview(false);
							}}
						/>
					</div>
				</aside>

				{/* Main workspace */}
				<main className="md:col-span-8 lg:col-span-9">
					{!selectedContractor ? (
						<div className="flex items-center justify-center h-64 bg-white border rounded-lg">
							<p className="text-black">Select a subcontractor to begin</p>
						</div>
					) : (
						<div className="space-y-4">
							{!showPreview ? (
								<div>
									<div className="flex items-center justify-between mb-3">
										<h2 className="text-xl font-semibold text-black">
											{selectedContractor.name}
										</h2>
										<div className="flex gap-2">
											{payStatementData && (
												<button
													onClick={() => setShowPreview(true)}
													className="px-4 py-2 bg-green-600 text-white rounded-md"
												>
													Preview / PDF
												</button>
											)}
										</div>
									</div>
									<PayStatementForm
										// Preserve edits when returning from Preview
										initialData={payStatementData ?? initialData}
										onDataChange={setPayStatementData}
										hideCompanyInfo
										externalPayPeriodId={payPeriodId}
									/>
									<div className="text-right mt-4">
										<button
											onClick={() => setShowPreview(true)}
											className="px-5 py-2 bg-blue-600 text-white rounded-md"
										>
											Preview Statement
										</button>
									</div>
								</div>
							) : (
								<div className="bg-white border rounded-lg p-4">
									<div className="flex items-center justify-between mb-4">
										<button
											onClick={() => setShowPreview(false)}
											className="px-4 py-2 bg-gray-200 text-black rounded-md"
										>
											← Back to Edit
										</button>
										<div className="font-medium text-black">PDF Preview</div>
									</div>
									{payStatementData && <PDFGenerator data={payStatementData} />}
								</div>
							)}
						</div>
					)}
				</main>

				{/* Right drawer placeholder for batch queue (future) */}
			</div>
			{showContractorManager && (
				<ContractorManager onClose={() => setShowContractorManager(false)} />
			)}
		</div>
	);
};

export default HomeLayout;
