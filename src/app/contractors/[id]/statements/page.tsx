"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDataClient } from "@/lib/data";
import {
	getPayStatementsClient,
	SavedStatement,
} from "@/lib/data/payStatements";
import PDFGenerator from "@/components/PDFGenerator";
import PayStatement from "@/components/PayStatement";
import TopBar from "@/components/TopBar";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { getPayPeriodById } from "@/utils/payPeriods";
import type { PayStatementData } from "@/types/payStatement";

export default function ContractorStatementsPage() {
	const params = useParams();
	const router = useRouter();
	const contractorId = useMemo(() => (params?.id as string) || "", [params]);
	const [contractorName, setContractorName] = useState<string>("");
	const [items, setItems] = useState<SavedStatement[]>([]);
	const [q, setQ] = useState("");

	// Date range (optional)
	const [fromDate, setFromDate] = useState<string>(""); // YYYY-MM-DD
	const [toDate, setToDate] = useState<string>(""); // YYYY-MM-DD

	// Modal state for viewing a specific statement
	const [showModal, setShowModal] = useState(false);
	const [modalData, setModalData] = useState<PayStatementData | null>(null);
	const [loadingModal, setLoadingModal] = useState(false);

	// Download state
	const [singleDownloadingKey, setSingleDownloadingKey] = useState<
		string | null
	>(null);
	const [bulkDownloading, setBulkDownloading] = useState(false);

	// Hidden render target for PDF generation
	const hiddenContainerRef = useRef<HTMLDivElement | null>(null);
	const [hiddenData, setHiddenData] = useState<PayStatementData | null>(null);

	useEffect(() => {
		const client = getDataClient();
		void client
			.getContractorById(contractorId)
			.then((c) => setContractorName(c?.name || ""));
	}, [contractorId]);

	useEffect(() => {
		const ps = getPayStatementsClient();
		void ps.listByContractorId(contractorId).then(setItems);
	}, [contractorId]);

	const filteredBySearch = useMemo(() => {
		if (!q.trim()) return items;
		const term = q.toLowerCase();
		return items.filter(
			(i) =>
				i.name.toLowerCase().includes(term) ||
				i.date.toLowerCase().includes(term)
		);
	}, [items, q]);

	const itemsInDateRange = useMemo(() => {
		if (!fromDate && !toDate) return filteredBySearch;
		return filteredBySearch.filter((i) => {
			const iso = i.dateISO || "";
			if (!iso) return false;
			if (fromDate && iso < fromDate) return false;
			if (toDate && iso > toDate) return false;
			return true;
		});
	}, [filteredBySearch, fromDate, toDate]);

	const openStatement = async (s: SavedStatement) => {
		setLoadingModal(true);
		setShowModal(true);
		try {
			if (s.data) {
				setModalData(s.data);
			} else {
				const ps = getPayStatementsClient();
				const data = await ps.load(s.key);
				if (data) setModalData(data);
			}
		} finally {
			setLoadingModal(false);
		}
	};

	const buildFileName = (data: PayStatementData, fallback: string) => {
		const periodLabel =
			getPayPeriodById(data.payment.payPeriodId || "")?.label || fallback;
		const raw = `${data.paidTo.name} - ${periodLabel}`;
		return raw.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
	};

	const renderAndDownloadPDF = async (
		data: PayStatementData,
		fallbackDate: string
	) => {
		// Render hidden PayStatement
		setHiddenData(data);
		// Wait for 2 RAFs to ensure layout, plus a tiny delay
		await new Promise((r) =>
			requestAnimationFrame(() => requestAnimationFrame(r))
		);
		await new Promise((r) => setTimeout(r, 20));
		const container = hiddenContainerRef.current;
		if (!container) return;

		const canvas = await html2canvas(container, {
			scale: 1,
			useCORS: true,
			backgroundColor: "#ffffff",
			logging: false,
		});

		// Guard against zero-sized canvas
		const cW = canvas.width || 1;
		const cH = canvas.height || 1;
		const imgData = canvas.toDataURL("image/png");
		const pdf = new jsPDF("p", "mm", "letter");

		const pdfWidth = pdf.internal.pageSize.getWidth();
		const pdfHeight = pdf.internal.pageSize.getHeight();
		const width = pdfWidth;
		const height = pdfHeight;
		const x = 0;
		const y = 0;

		pdf.addImage(imgData, "PNG", x, y, width, height);
		const safeName = buildFileName(data, fallbackDate);
		pdf.save(`${safeName}.pdf`);

		// Clear hidden data after save
		setHiddenData(null);
	};

	const addStatementToPdf = async (
		pdf: jsPDF,
		data: PayStatementData,
		fallbackDate: string,
		isFirstPage: boolean
	) => {
		// Render hidden PayStatement
		setHiddenData(data);
		await new Promise((r) =>
			requestAnimationFrame(() => requestAnimationFrame(r))
		);
		await new Promise((r) => setTimeout(r, 20));
		const container = hiddenContainerRef.current;
		if (!container) return;

		const canvas = await html2canvas(container, {
			scale: 1,
			useCORS: true,
			backgroundColor: "#ffffff",
			logging: false,
		});

		const cW = canvas.width || 1;
		const cH = canvas.height || 1;
		const imgData = canvas.toDataURL("image/png");

		// Add page if not the first
		if (!isFirstPage) {
			pdf.addPage("letter", "p");
		}

		const pdfWidth = pdf.internal.pageSize.getWidth();
		const pdfHeight = pdf.internal.pageSize.getHeight();
		const width = pdfWidth;
		const height = pdfHeight;
		const x = 0;
		const y = 0;

		pdf.addImage(imgData, "PNG", x, y, width, height);

		// Clear after adding to PDF
		setHiddenData(null);
	};

	const handleDownloadSingle = async (s: SavedStatement) => {
		setSingleDownloadingKey(s.key);
		try {
			let data: PayStatementData | null = s.data || null;
			if (!data) {
				const ps = getPayStatementsClient();
				data = await ps.load(s.key);
			}
			if (data) {
				await renderAndDownloadPDF(data, s.dateISO || s.date);
			} else {
				alert("Unable to load this pay statement.");
			}
		} catch (e) {
			console.error(e);
			alert("Failed to download PDF for this statement.");
		} finally {
			setSingleDownloadingKey(null);
		}
	};

	const handleBulkDownload = async () => {
		const list =
			itemsInDateRange.length > 0 ? itemsInDateRange : filteredBySearch;
		if (list.length === 0) {
			alert("No pay statements to download.");
			return;
		}
		setBulkDownloading(true);
		try {
			const pdf = new jsPDF("p", "mm", "letter");
			let isFirst = true;
			for (const s of list) {
				let data: PayStatementData | null = s.data || null;
				if (!data) {
					const ps = getPayStatementsClient();
					data = await ps.load(s.key);
				}
				if (data) {
					// eslint-disable-next-line no-await-in-loop
					await addStatementToPdf(pdf, data, s.dateISO || s.date, isFirst);
					isFirst = false;
				}
			}
			const datePart =
				fromDate || toDate
					? `${fromDate || "..."}_to_${toDate || "..."}`
					: "All";
			const rawName = `Pay_Statements_${
				contractorName || "Contractor"
			}_${datePart}`;
			const safeName = rawName
				.replace(/[^A-Za-z0-9]+/g, "_")
				.replace(/^_+|_+$/g, "");
			pdf.save(`${safeName}.pdf`);
		} catch (e) {
			console.error(e);
			alert("Some downloads may have failed. Please try again.");
		} finally {
			setBulkDownloading(false);
		}
	};

	return (
		<>
			<TopBar />
			<div className="container mx-auto p-6">
				<div className="flex items-center justify-between mb-4">
					<h1 className="text-xl font-semibold">
						Pay Statements for {contractorName}
					</h1>
					<button
						onClick={() => router.push("/")}
						className="px-3 py-2 bg-gray-200 rounded"
					>
						Home
					</button>
				</div>

				<div className="mb-4 space-y-3">
					<input
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder="Search by name or date..."
						className="w-full px-3 py-2 border rounded"
					/>

					<div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
						<div>
							<label className="block text-sm text-gray-700 mb-1">
								From date (optional)
							</label>
							<input
								type="date"
								value={fromDate}
								onChange={(e) => setFromDate(e.target.value)}
								className="w-full px-3 py-2 border rounded"
							/>
						</div>
						<div>
							<label className="block text-sm text-gray-700 mb-1">
								To date (optional)
							</label>
							<input
								type="date"
								value={toDate}
								onChange={(e) => setToDate(e.target.value)}
								className="w-full px-3 py-2 border rounded"
							/>
						</div>
						<div className="md:col-span-2 flex gap-2 mt-2 md:mt-0">
							<button
								onClick={handleBulkDownload}
								disabled={bulkDownloading}
								className={`px-4 py-2 rounded text-white ${
									bulkDownloading
										? "bg-gray-400 cursor-not-allowed"
										: "bg-blue-600 hover:bg-blue-700"
								}`}
							>
								{bulkDownloading
									? "Downloading..."
									: "Download All (date range)"}
							</button>
							{(fromDate || toDate) && (
								<div className="text-sm text-gray-600 flex items-center">
									{itemsInDateRange.length} in range
								</div>
							)}
						</div>
					</div>
				</div>

				{filteredBySearch.length === 0 ? (
					<div className="text-gray-500">No statements found.</div>
				) : (
					<div className="space-y-2">
						{filteredBySearch.map((s) => (
							<div
								key={s.key}
								className="p-4 border rounded flex items-center justify-between hover:bg-gray-50 cursor-pointer"
								onClick={() => void openStatement(s)}
							>
								<div>
									<div className="font-medium">{s.name}</div>
									<div className="text-sm text-gray-600">{s.date}</div>
								</div>
								<div className="flex items-center gap-2">
									<button
										onClick={(e) => {
											e.stopPropagation();
											void handleDownloadSingle(s);
										}}
										disabled={singleDownloadingKey === s.key || bulkDownloading}
										className={`px-3 py-1 text-sm rounded text-white ${
											singleDownloadingKey === s.key || bulkDownloading
												? "bg-gray-400 cursor-not-allowed"
												: "bg-emerald-600 hover:bg-emerald-700"
										}`}
									>
										{singleDownloadingKey === s.key
											? "Downloading..."
											: "Download PDF"}
									</button>
								</div>
							</div>
						))}
					</div>
				)}

				{/* Modal for viewing a statement */}
				{showModal && (
					<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
						<div className="bg-white rounded-lg p-4 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
							<div className="flex items-center justify-between mb-3">
								<div className="font-semibold">View Pay Statement</div>
								<button
									onClick={() => setShowModal(false)}
									className="text-2xl text-gray-600"
								>
									×
								</button>
							</div>
							{loadingModal ? (
								<div className="p-6 text-center text-gray-600">Loading...</div>
							) : modalData ? (
								<PDFGenerator data={modalData} />
							) : (
								<div className="p-6 text-center text-gray-600">Not found.</div>
							)}
						</div>
					</div>
				)}

				{/* Hidden container for PDF captures */}
				<div
					ref={hiddenContainerRef}
					style={{
						position: "absolute",
						left: -10000,
						top: -10000,
						background: "#fff",
						width: "8.5in",
					}}
				>
					{hiddenData && <PayStatement data={hiddenData} preset="bpv1" />}
				</div>
			</div>
		</>
	);
}
