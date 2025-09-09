"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Contractor } from "@/types/contractor";
import { getDataClient } from "@/lib/data";

interface ContractorSelectorProps {
	onContractorSelect: (contractor: Contractor) => void;
	selectedContractor?: Contractor;
}

const ContractorSelector: React.FC<ContractorSelectorProps> = ({
	onContractorSelect,
	selectedContractor,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [showDropdown, setShowDropdown] = useState(false);
	const [contractors, setContractors] = useState<Contractor[]>([]);

	useEffect(() => {
		let active = true;
		getDataClient()
			.listActiveContractors()
			.then((list) => {
				if (active) setContractors(list);
			})
			.catch((err) => console.error("Failed to load contractors", err));
		return () => {
			active = false;
		};
	}, []);

	const filteredContractors = useMemo(() => {
		return contractors.filter(
			(contractor) =>
				contractor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				contractor.paymentInfo.accountLastFour.includes(searchTerm)
		);
	}, [contractors, searchTerm]);

	const handleContractorSelect = (contractor: Contractor) => {
		onContractorSelect(contractor);
		setSearchTerm(contractor.name);
		setShowDropdown(false);
	};

	return (
		<div className="mb-6">
			<h3 className="text-lg font-semibold mb-4 text-black">
				Select Contractor
			</h3>

			<div className="relative">
				<input
					type="text"
					value={searchTerm}
					onChange={(e) => {
						setSearchTerm(e.target.value);
						setShowDropdown(true);
					}}
					onFocus={() => setShowDropdown(true)}
					placeholder="Search by name or account number..."
					className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-700"
					style={{ color: "#000000" }}
				/>

				{showDropdown && filteredContractors.length > 0 && (
					<div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
						{filteredContractors.map((contractor) => (
							<div
								key={contractor.id}
								onClick={() => handleContractorSelect(contractor)}
								className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
							>
								<div className="font-medium text-black">{contractor.name}</div>
								<div className="text-sm text-black">
									****{contractor.paymentInfo.accountLastFour} •{" "}
									{contractor.address.city}, {contractor.address.state}
								</div>
								<div className="text-xs text-black">
									{contractor.buildings.length} building(s) •{" "}
									{contractor.paymentInfo.method}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{selectedContractor && (
				<div className="mt-4 p-4 bg-blue-50 rounded-lg">
					<h4 className="font-semibold text-blue-900 mb-2">
						Selected Contractor
					</h4>
					<div className="text-sm text-blue-800">
						<div className="flex items-center justify-between">
							<div>
								<strong>Name:</strong> {selectedContractor.name}
							</div>
							<button
								onClick={() => {
									window.location.href = `/contractors/${selectedContractor.id}/statements`;
								}}
								className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
							>
								View all pay statements
							</button>
						</div>
						<div>
							<strong>Account:</strong> ****
							{selectedContractor.paymentInfo.accountLastFour}
						</div>
						<div>
							<strong>Payment Method:</strong>{" "}
							{selectedContractor.paymentInfo.method}
						</div>
						<div>
							<strong>Buildings:</strong>
						</div>
						<ul className="ml-4 mt-1">
							{selectedContractor.buildings
								.filter((b) => b.isActive)
								.map((building, index) => (
									<li key={index} className="text-xs">
										• {building.buildingName} - ${building.payPerVisit}/visit
									</li>
								))}
						</ul>
					</div>
				</div>
			)}
		</div>
	);
};

export default ContractorSelector;
