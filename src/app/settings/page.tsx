"use client";

import React, { useState } from "react";
import TopBar from "@/components/TopBar";

export default function SettingsPage() {
	const [companyName, setCompanyName] = useState(
		"ELEMENT CLEANING SYSTEMS LLC"
	);
	const [companyPhone, setCompanyPhone] = useState("425-591-9427");

	return (
		<div className="min-h-screen bg-white text-black">
			<TopBar />
			<main className="container mx-auto p-6">
				<h1 className="text-2xl font-semibold mb-4">Settings</h1>
				<p className="text-black mb-6">
					Company information is configured here and used when generating PDFs.
				</p>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg border">
					<div>
						<label className="block text-sm font-medium text-black mb-1">
							Company Name
						</label>
						<input
							className="w-full px-3 py-2 border rounded-md text-black"
							value={companyName}
							onChange={(e) => setCompanyName(e.target.value)}
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-black mb-1">
							Company Phone
						</label>
						<input
							className="w-full px-3 py-2 border rounded-md text-black"
							value={companyPhone}
							onChange={(e) => setCompanyPhone(e.target.value)}
						/>
					</div>
				</div>

				<div className="mt-6">
					<button className="px-4 py-2 bg-blue-600 text-white rounded-md">
						Save
					</button>
				</div>
			</main>
		</div>
	);
}
