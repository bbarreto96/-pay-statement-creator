"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { Contractor } from "@/types/contractor";
import { getDataClient } from "@/lib/data";

import { useRouter } from "next/navigation";

interface ContractorSelectorProps {
	onContractorSelect: (contractor: Contractor) => void;
	selectedContractor?: Contractor;
	contractors?: Contractor[];
}

const ContractorSelector: React.FC<ContractorSelectorProps> = ({
	onContractorSelect,
	selectedContractor,
	contractors: contractorsProp,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedTerm, setDebouncedTerm] = useState("");
		const router = useRouter();

	const [showDropdown, setShowDropdown] = useState(false);
	const [contractors, setContractors] = useState<Contractor[]>([]);
	const [activeIndex, setActiveIndex] = useState<number>(-1);

		const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (contractorsProp) {
			setContractors(contractorsProp);
			return;
		}
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
	}, [contractorsProp]);

	// Debounce search term to reduce filtering churn
	useEffect(() => {
		const t = setTimeout(() => setDebouncedTerm(searchTerm), 200);
		return () => clearTimeout(t);
	}, [searchTerm]);
		useEffect(() => {
			const handlePointer = (e: MouseEvent | TouchEvent) => {
				const node = containerRef.current;
				if (!node) return;
				if (!node.contains(e.target as Node)) {
					setShowDropdown(false);
				}
			};
			document.addEventListener("mousedown", handlePointer);
			document.addEventListener("touchstart", handlePointer);
			return () => {
				document.removeEventListener("mousedown", handlePointer);
				document.removeEventListener("touchstart", handlePointer);
			};
		}, []);

		useEffect(() => {
			const handleFocusIn = (e: FocusEvent) => {
				const node = containerRef.current;
				if (!node) return;
				if (!node.contains(e.target as Node)) {
					setShowDropdown(false);
				}
			};
			document.addEventListener("focusin", handleFocusIn);
			return () => {
				document.removeEventListener("focusin", handleFocusIn);
			};
		}, []);

    const filteredContractors = useMemo(() => {
		const term = debouncedTerm.trim().toLowerCase();
		if (!term) return contractors;
		return contractors.filter(
			(contractor) =>
				contractor.name.toLowerCase().includes(term) ||
				contractor.paymentInfo.accountLastFour.includes(term)
		);
	}, [contractors, debouncedTerm]);

    // Reset active index when dropdown opens
    useEffect(() => {
        if (showDropdown && filteredContractors.length > 0) {
            setActiveIndex(0);
        } else {
            setActiveIndex(-1);
        }
    }, [showDropdown, filteredContractors.length]);

	const handleContractorSelect = (contractor: Contractor) => {
		onContractorSelect(contractor);
		setSearchTerm(contractor.name);
		setShowDropdown(false);
	};

	return (
		<div className="mb-6">
			<div className="relative" ref={containerRef}>
				<input
					type="text"
					role="combobox"
					aria-expanded={showDropdown}
					aria-controls="contractor-listbox"
					aria-activedescendant={activeIndex >= 0 ? `contractor-option-${activeIndex}` : undefined}
					autoComplete="off"
					value={searchTerm}
					onChange={(e) => {
						setSearchTerm(e.target.value);
						setShowDropdown(true);
					}}
					onKeyDown={(e) => {
						if (!showDropdown) return;
						if (e.key === "ArrowDown") {
							e.preventDefault();
							setActiveIndex((i) => Math.min(i + 1, filteredContractors.length - 1));
						} else if (e.key === "ArrowUp") {
							e.preventDefault();
							setActiveIndex((i) => Math.max(i - 1, 0));
						} else if (e.key === "Enter") {
							e.preventDefault();
							if (activeIndex >= 0 && filteredContractors[activeIndex]) {
								handleContractorSelect(filteredContractors[activeIndex]);
							}
						} else if (e.key === "Escape") {
							setShowDropdown(false);
						}
					}}
					onFocus={() => setShowDropdown(true)}
					placeholder="Search by name or account number..."
					className="input-field text-black placeholder:text-gray-500"
					style={{ color: "#000000" }}
				/>

				{showDropdown && filteredContractors.length > 0 && (
					<div id="contractor-listbox" role="listbox" className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
						{filteredContractors.map((contractor, i) => (
							<div
								key={contractor.id}
								id={`contractor-option-${i}`}
								role="option"
								aria-selected={i === activeIndex}
								onMouseEnter={() => setActiveIndex(i)}
								onClick={() => handleContractorSelect(contractor)}
								className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${i === activeIndex ? "bg-blue-50" : "hover:bg-blue-50/60"}`}
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
				<div className="mt-4 p-3 bg-white rounded-md border border-gray-200">
					<h4 className="font-semibold text-gray-900 mb-2">
						Selected Contractor
					</h4>
					<div className="text-sm text-gray-700">
						<div className="flex items-center justify-between">
							<div>
								<strong>Name:</strong> {selectedContractor.name}
							</div>
							<button
								onClick={() => {
									router.push(`/contractors/${selectedContractor.id}/statements`);
								}}
								className="btn-ghost text-xs"
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
