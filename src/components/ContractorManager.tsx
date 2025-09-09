"use client";

import React, { useState, useEffect } from "react";
import { Contractor, BuildingAssignment } from "@/types/contractor";
import { getDataClient } from "@/lib/data";

interface ContractorManagerProps {
	onClose: () => void;
}

const ContractorManager: React.FC<ContractorManagerProps> = ({ onClose }) => {
	const [contractors, setContractors] = useState<Contractor[]>([]);
	const [editingContractor, setEditingContractor] = useState<Contractor | null>(
		null
	);
	const [showAddForm, setShowAddForm] = useState(false);

	// Refresh contractor list from backend
	const refreshContractorList = async () => {
		const dc = getDataClient();
		const list = await dc.listActiveContractors();
		setContractors(list);
	};

	// Load contractors on component mount
	useEffect(() => {
		void refreshContractorList();
	}, []);

	const [formData, setFormData] = useState<Partial<Contractor>>({
		name: "",
		address: {
			street: "",
			city: "",
			state: "WA",
			zipCode: "",
		},
		paymentInfo: {
			method: "Direct Deposit",
			accountLastFour: "",
		},
		buildings: [],
		isActive: true,
		notes: "",
	});

	const resetForm = () => {
		setFormData({
			name: "",
			address: {
				street: "",
				city: "",
				state: "WA",
				zipCode: "",
			},
			paymentInfo: {
				method: "Direct Deposit",
				accountLastFour: "",
			},
			buildings: [],
			isActive: true,
			notes: "",
		});
		setEditingContractor(null);
		setShowAddForm(false);
	};

	const handleEdit = (contractor: Contractor) => {
		setEditingContractor(contractor);
		setFormData(contractor);
		setShowAddForm(true);
	};

	const handleSave = async () => {
		if (!formData.name) {
			alert("Please enter the contractor's name");
			return;
		}

		try {
			const dc = getDataClient();
			if (editingContractor) {
				// Update existing contractor
				await dc.updateContractor(editingContractor.id, formData as Contractor);
			} else {
				// Add new contractor
				await dc.addContractor(
					formData as Omit<Contractor, "id" | "dateAdded">
				);
			}

			// Refresh the contractor list
			await refreshContractorList();
			resetForm();
		} catch (err: unknown) {
			console.error("Failed to save contractor", err);
			const msg =
				typeof err === "string"
					? err
					: err &&
					  typeof err === "object" &&
					  "message" in (err as Record<string, unknown>)
					? String((err as { message?: unknown }).message)
					: "Failed to save contractor. Please try again.";
			alert(msg);
		}
	};

	const addBuilding = () => {
		const newBuilding: BuildingAssignment = {
			buildingName: "",
			payType: "perVisit",
			payPerVisit: 0,
			hourlyRate: 0,
			isActive: true,
		};
		setFormData({
			...formData,
			buildings: [...(formData.buildings || []), newBuilding],
		});
	};

	const updateBuilding = (index: number, building: BuildingAssignment) => {
		const buildings = [...(formData.buildings || [])];
		buildings[index] = building;
		setFormData({ ...formData, buildings });
	};

	const removeBuilding = (index: number) => {
		const buildings = [...(formData.buildings || [])];
		buildings.splice(index, 1);
		setFormData({ ...formData, buildings });
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-2xl font-bold text-gray-800">
						Contractor Management
					</h2>
					<button
						onClick={onClose}
						className="text-gray-500 hover:text-gray-700 text-2xl"
					>
						×
					</button>
				</div>

				{!showAddForm ? (
					<>
						{/* Contractor List */}
						<div className="mb-4">
							<button
								onClick={() => setShowAddForm(true)}
								className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
							>
								Add New Contractor
							</button>
						</div>

						<div className="flex gap-2 mt-2">
							<button
								onClick={async () => {
									try {
										const dc = getDataClient();
										const list = await dc.listAllContractors();
										const json = JSON.stringify(list, null, 2);
										const blob = new Blob([json], {
											type: "application/json",
										});
										const url = URL.createObjectURL(blob);
										const a = document.createElement("a");
										a.href = url;
										a.download = `contractors-export-${new Date()
											.toISOString()
											.replace(/[:.]/g, "-")}.json`;
										a.click();
										URL.revokeObjectURL(url);
									} catch (e) {
										alert("Failed to export contractors");
									}
								}}
								className="px-3 py-2 bg-gray-100 rounded border hover:bg-gray-200"
							>
								Export JSON
							</button>
							<button
								onClick={async () => {
									const input = document.createElement("input");
									input.type = "file";
									input.accept = "application/json";
									input.onchange = async () => {
										const file = input.files?.[0];
										if (!file) return;
										try {
											const text = await file.text();
											const parsed = JSON.parse(text);
											if (!Array.isArray(parsed))
												throw new Error("Expected array");
											const dc = getDataClient();
											// Upsert: if name matches, update; otherwise add
											for (const c of parsed) {
												if (!c?.name) continue;
												try {
													// Try to find contractor by name (simple match)
													const all = await dc.listAllContractors();
													const existing = all.find(
														(x) =>
															x.name.trim().toLowerCase() ===
															c.name.trim().toLowerCase()
													);
													if (existing) {
														await dc.updateContractor(existing.id, c);
													} else {
														await dc.addContractor(c);
													}
												} catch {}
											}
											await refreshContractorList();
											alert("Contractors imported and synced to Supabase");
										} catch (e) {
											alert("Invalid JSON file");
										}
									};
									input.click();
								}}
								className="px-3 py-2 bg-gray-100 rounded border hover:bg-gray-200"
							>
								Import JSON
							</button>
						</div>

						<div className="flex gap-2 mt-2">
							<button
								onClick={async () => {
									try {
										const raw = localStorage.getItem(
											"element-cleaning-contractors"
										);
										if (!raw) {
											alert("No local contractors found to sync");
											return;
										}
										const parsed = JSON.parse(raw);
										if (!Array.isArray(parsed))
											throw new Error("Invalid local data");
										const dc = getDataClient();
										const all = await dc.listAllContractors();
										for (const c of parsed) {
											if (!c?.name) continue;
											const existing = all.find(
												(x) =>
													x.name.trim().toLowerCase() ===
													c.name.trim().toLowerCase()
											);
											if (existing) {
												await dc.updateContractor(existing.id, c);
											} else {
												await dc.addContractor(c);
											}
										}
										localStorage.removeItem("element-cleaning-contractors");
										await refreshContractorList();
										alert(
											"Local contractors synced to Supabase and cleared from localStorage"
										);
									} catch (e) {
										alert("Failed to sync local contractors");
									}
								}}
								className="px-3 py-2 bg-gray-100 rounded border hover:bg-gray-200"
							>
								Sync Local to Supabase
							</button>
						</div>

						<div className="space-y-4">
							{contractors.map((contractor) => (
								<div
									key={contractor.id}
									className="border border-gray-200 rounded-lg p-4"
								>
									<div className="flex justify-between items-start">
										<div>
											<h3 className="font-semibold text-lg">
												{contractor.name}
											</h3>

											<p className="text-sm text-gray-500">
												{contractor.address.city}, {contractor.address.state}{" "}
												{contractor.address.zipCode}
											</p>
											<p className="text-sm text-gray-500">
												{contractor.paymentInfo.method} •{" "}
												{contractor.buildings.length} buildings
											</p>
										</div>
										<button
											onClick={() => handleEdit(contractor)}
											className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
										>
											Edit
										</button>
									</div>
								</div>
							))}
						</div>
					</>
				) : (
					<>
						{/* Add/Edit Form */}
						<div className="mb-4">
							<button
								onClick={resetForm}
								className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
							>
								← Back to List
							</button>
						</div>

						<div className="space-y-6">
							{/* Basic Info */}
							<div>
								<h3 className="text-lg font-semibold mb-4">
									Basic Information
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Name *
										</label>
										<input
											type="text"
											value={formData.name || ""}
											onChange={(e) =>
												setFormData({ ...formData, name: e.target.value })
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
											style={{ color: "#000000" }}
										/>
									</div>
									{/*
									<div className="hidden">
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Account Number (SSN) *
										</label>
										<input
											type="text"
											value={""}
											onChange={(e) =>
												setFormData({
													...formData,
													accountNumber: e.target.value,
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
											style={{ color: "#000000" }}
										/>
									</div>
									*/}
								</div>
							</div>

							{/* Address */}
							<div>
								<h3 className="text-lg font-semibold mb-4">Address</h3>
								<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
									<div className="md:col-span-2">
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Street Address *
										</label>
										<input
											type="text"
											value={formData.address?.street || ""}
											onChange={(e) =>
												setFormData({
													...formData,
													address: {
														...formData.address!,
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
											City *
										</label>
										<input
											type="text"
											value={formData.address?.city || ""}
											onChange={(e) =>
												setFormData({
													...formData,
													address: {
														...formData.address!,
														city: e.target.value,
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
											style={{ color: "#000000" }}
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											State
										</label>
										<input
											type="text"
											value={formData.address?.state || "WA"}
											onChange={(e) =>
												setFormData({
													...formData,
													address: {
														...formData.address!,
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
											ZIP Code *
										</label>
										<input
											type="text"
											value={formData.address?.zipCode || ""}
											onChange={(e) =>
												setFormData({
													...formData,
													address: {
														...formData.address!,
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

							{/* Payment Info */}
							<div>
								<h3 className="text-lg font-semibold mb-4">
									Payment Information
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Payment Method
										</label>
										<select
											value={formData.paymentInfo?.method || "Direct Deposit"}
											onChange={(e) =>
												setFormData({
													...formData,
													paymentInfo: {
														...formData.paymentInfo!,
														method: e.target
															.value as Contractor["paymentInfo"]["method"],
													},
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
									<div>
										<label className="block text-sm font-medium text-gray-700 mb-1">
											Account Last 4 Digits
										</label>
										<input
											type="text"
											maxLength={4}
											value={formData.paymentInfo?.accountLastFour || ""}
											onChange={(e) =>
												setFormData({
													...formData,
													paymentInfo: {
														...formData.paymentInfo!,
														accountLastFour: e.target.value,
													},
												})
											}
											className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
											style={{ color: "#000000" }}
										/>
									</div>
								</div>

								{/* Google Drive Mapping */}
								<div className="mt-6">
									<h3 className="text-lg font-semibold mb-4">
										Google Drive Mapping
									</h3>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-gray-700 mb-1">
												Contractor&apos;s Drive Folder ID (optional)
											</label>
											<input
												type="text"
												placeholder="e.g. 1AbCdeFGhIJkLmNoPqRsTUvWxYz"
												value={""}
												readOnly
												disabled
												onChange={(e) =>
													setFormData({
														...formData,
														googleDriveFolderId: e.target.value,
													})
												}
												className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
												style={{ color: "#000000" }}
											/>
											<p className="text-xs text-gray-500 mt-1">
												Find this in the Google Drive folder URL after
												/folders/...
											</p>
										</div>
									</div>
								</div>
							</div>

							{/* Buildings */}
							<div>
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-lg font-semibold">Buildings</h3>
									<button
										onClick={addBuilding}
										className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
									>
										Add Building
									</button>
								</div>

								<div className="space-y-3">
									{(formData.buildings || []).map((building, index) => (
										<div
											key={index}
											className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-gray-200 rounded-md"
										>
											<div>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													Building Name
												</label>
												<input
													type="text"
													value={building.buildingName}
													onChange={(e) =>
														updateBuilding(index, {
															...building,
															buildingName: e.target.value,
														})
													}
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
													style={{ color: "#000000" }}
												/>
											</div>
											<div>
												<label className="block text-sm font-medium text-gray-700 mb-1">
													Pay Per Visit
												</label>
												<input
													type="number"
													step="0.01"
													value={building.payPerVisit}
													onChange={(e) =>
														updateBuilding(index, {
															...building,
															payPerVisit: parseFloat(e.target.value) || 0,
														})
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
													value={building.payType || "perVisit"}
													onChange={(e) =>
														updateBuilding(index, {
															...building,
															payType: e.target.value as NonNullable<
																BuildingAssignment["payType"]
															>,
														})
													}
													className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
												>
													<option value="perVisit">Per Visit</option>
													<option value="hourly">Hourly</option>
												</select>
												{(building.payType || "perVisit") === "perVisit" ? (
													<>
														<label className="block text-sm font-medium text-gray-700 mb-1 mt-3">
															Pay Per Visit
														</label>
														<input
															type="number"
															step="0.01"
															value={building.payPerVisit || 0}
															onChange={(e) =>
																updateBuilding(index, {
																	...building,
																	payPerVisit: parseFloat(e.target.value) || 0,
																})
															}
															className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
															style={{ color: "#000000" }}
														/>
													</>
												) : (
													<>
														<label className="block text-sm font-medium text-gray-700 mb-1 mt-3">
															Hourly Rate
														</label>
														<input
															type="number"
															step="0.01"
															value={building.hourlyRate || 0}
															onChange={(e) =>
																updateBuilding(index, {
																	...building,
																	hourlyRate: parseFloat(e.target.value) || 0,
																})
															}
															className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
															style={{ color: "#000000" }}
														/>
													</>
												)}
											</div>
											<div className="flex items-end">
												<button
													onClick={() => removeBuilding(index)}
													className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
												>
													Remove
												</button>
											</div>
										</div>
									))}
								</div>
							</div>

							{/* Notes */}
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Notes
								</label>
								<textarea
									value={formData.notes || ""}
									onChange={(e) =>
										setFormData({ ...formData, notes: e.target.value })
									}
									rows={3}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
									style={{ color: "#000000" }}
								/>
							</div>

							{/* Save Button */}
							<div className="text-center">
								<button
									onClick={handleSave}
									className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-lg font-semibold"
								>
									{editingContractor ? "Update Contractor" : "Add Contractor"}
								</button>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
};

export default ContractorManager;
