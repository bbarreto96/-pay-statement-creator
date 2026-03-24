"use client";

import React, { useState } from "react";
import TopBar from "@/components/TopBar";
import { getCompanyConfig, saveCompanyConfig, CompanyConfig } from "@/lib/companyConfig";

export default function SettingsPage() {
	const [config, setConfig] = useState<CompanyConfig>(() => getCompanyConfig());
	const [saved, setSaved] = useState(false);

	const handleSave = () => {
		saveCompanyConfig(config);
		setSaved(true);
		setTimeout(() => setSaved(false), 2500);
	};

	return (
		<div className="min-h-screen app-shell">
			<TopBar />
			<main className="max-w-5xl mx-auto p-6">
				<h1 className="section-title text-2xl mb-4">Settings</h1>
				<p className="text-gray-700 mb-6">
					Company information is used when generating PDFs and pay statements.
				</p>

				<div className="app-panel p-4 space-y-4">
					<h2 className="section-title text-base text-gray-800">Company Information</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-black mb-1">Company Name</label>
							<input
								className="w-full px-3 py-2 border rounded-md text-black"
								value={config.name}
								onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-black mb-1">Phone</label>
							<input
								className="w-full px-3 py-2 border rounded-md text-black"
								value={config.phone}
								onChange={(e) => setConfig((c) => ({ ...c, phone: e.target.value }))}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-black mb-1">Street Address</label>
							<input
								className="w-full px-3 py-2 border rounded-md text-black"
								value={config.address.street}
								onChange={(e) => setConfig((c) => ({ ...c, address: { ...c.address, street: e.target.value } }))}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-black mb-1">Suite / Unit</label>
							<input
								className="w-full px-3 py-2 border rounded-md text-black"
								value={config.address.suite || ""}
								onChange={(e) => setConfig((c) => ({ ...c, address: { ...c.address, suite: e.target.value } }))}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-black mb-1">City</label>
							<input
								className="w-full px-3 py-2 border rounded-md text-black"
								value={config.address.city}
								onChange={(e) => setConfig((c) => ({ ...c, address: { ...c.address, city: e.target.value } }))}
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label className="block text-sm font-medium text-black mb-1">State</label>
								<input
									className="w-full px-3 py-2 border rounded-md text-black"
									value={config.address.state}
									onChange={(e) => setConfig((c) => ({ ...c, address: { ...c.address, state: e.target.value } }))}
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-black mb-1">ZIP Code</label>
								<input
									className="w-full px-3 py-2 border rounded-md text-black"
									value={config.address.zipCode}
									onChange={(e) => setConfig((c) => ({ ...c, address: { ...c.address, zipCode: e.target.value } }))}
								/>
							</div>
						</div>
					</div>
				</div>

				<div className="mt-6 flex items-center gap-3">
					<button
						onClick={handleSave}
						className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
					>
						Save
					</button>
					{saved && (
						<span className="text-sm text-emerald-700 font-medium">Saved!</span>
					)}
				</div>
			</main>
		</div>
	);
}
