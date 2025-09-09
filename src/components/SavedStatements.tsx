"use client";

import React, { useState, useEffect } from "react";
import { PayStatementData } from "@/types/payStatement";
import {
	getPayStatementsClient,
	SavedStatement,
} from "@/lib/data/payStatements";

interface SavedStatementsProps {
	onLoadStatement: (data: PayStatementData) => void;
	currentData?: PayStatementData;
}

const SavedStatements: React.FC<SavedStatementsProps> = ({
	onLoadStatement,
	currentData,
}) => {
	const [savedStatements, setSavedStatements] = useState<SavedStatement[]>([]);
	const [showSaveDialog, setShowSaveDialog] = useState(false);
	const [saveName, setSaveName] = useState("");

	useEffect(() => {
		void loadSavedStatements();
	}, []);

	const loadSavedStatements = async () => {
		const client = getPayStatementsClient();
		const results = await client.listAll();
		setSavedStatements(results);
	};

	const handleSave = async () => {
		if (!currentData || !saveName.trim()) return;
		const client = getPayStatementsClient();
		const key = await client.save(saveName.trim(), currentData);
		if (key) {
			await loadSavedStatements();
			setShowSaveDialog(false);
			setSaveName("");
		}
	};

	const handleLoad = async (statement: SavedStatement) => {
		// When using local backend, data is embedded. For Supabase, load by key.
		if (statement.data) {
			onLoadStatement(statement.data);
		} else {
			const client = getPayStatementsClient();
			const data = await client.load(statement.key);
			if (data) onLoadStatement(data);
		}
	};

	const handleDelete = async (key: string) => {
		if (confirm("Are you sure you want to delete this statement?")) {
			const client = getPayStatementsClient();
			await client.delete(key);
			await loadSavedStatements();
		}
	};

	return (
		<div className="bg-white rounded-lg shadow-lg p-6">
			<div className="flex justify-between items-center mb-4">
				<h3 className="text-lg font-semibold text-black">Saved Statements</h3>
				{currentData && (
					<button
						onClick={() => setShowSaveDialog(true)}
						className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						Save Current
					</button>
				)}
			</div>

			{/* Save Dialog */}
			{showSaveDialog && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg p-6 w-96">
						<h4 className="text-lg font-semibold mb-4">Save Statement</h4>
						<input
							type="text"
							value={saveName}
							onChange={(e) => setSaveName(e.target.value)}
							placeholder="Enter a name for this statement..."
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
							autoFocus
						/>
						<div className="flex gap-2 justify-end">
							<button
								onClick={() => {
									setShowSaveDialog(false);
									setSaveName("");
								}}
								className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
							>
								Cancel
							</button>
							<button
								onClick={handleSave}
								disabled={!saveName.trim()}
								className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
							>
								Save
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Saved Statements List */}
			{savedStatements.length === 0 ? (
				<p className="text-black text-center py-8">No saved statements yet</p>
			) : (
				<div className="space-y-3">
					{savedStatements.map((statement) => (
						<div
							key={statement.key}
							className="flex items-center justify-between p-4 border border-gray-200 rounded-md hover:bg-gray-50"
						>
							<div className="flex-1">
								<h4 className="font-medium text-black">{statement.name}</h4>
								<p className="text-sm text-black">Saved on {statement.date}</p>
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => void handleLoad(statement)}
									className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
								>
									Load
								</button>
								<button
									onClick={() => void handleDelete(statement.key)}
									className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
								>
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default SavedStatements;
