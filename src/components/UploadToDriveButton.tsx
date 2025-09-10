"use client";

import React, { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { PayStatementData } from "@/types/payStatement";
import { getPayPeriodById } from "@/utils/payPeriods";

type GisTokenResponse = { access_token?: string };
type GisTokenClient = { requestAccessToken: () => void };
type GoogleOauth2 = {
	initTokenClient: (params: {
		client_id: string;
		scope: string;
		prompt?: string;
		callback: (response: GisTokenResponse) => void;
	}) => GisTokenClient;
};
type GoogleAccounts = { oauth2: GoogleOauth2 };
type GoogleGlobal = { accounts: GoogleAccounts };
declare global {
	interface Window {
		google?: GoogleGlobal;
	}
}

type DivRef =
	| React.RefObject<HTMLDivElement | null>
	| React.MutableRefObject<HTMLDivElement | null>;

interface Props {
	data: PayStatementData;
	targetRef: DivRef;
}

const UploadToDriveButton: React.FC<Props> = ({ data, targetRef }) => {
	const [uploading, setUploading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [fileLink, setFileLink] = useState<string | null>(null);
	const [accessToken, setAccessToken] = useState<string | null>(null);

	const getClientId = () => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
	const ensureGisLoaded = async () => {
		if (typeof window === "undefined") return;
		if (window.google?.accounts?.oauth2) return;
		await new Promise<void>((resolve, reject) => {
			const s = document.createElement("script");
			s.src = "https://accounts.google.com/gsi/client";
			s.async = true;
			s.onload = () => resolve();
			s.onerror = () =>
				reject(new Error("Failed to load Google Identity Services"));
			document.head.appendChild(s);
		});
	};

	const getAccessToken = async (): Promise<string> => {
		const clientId = getClientId();
		if (!clientId)
			throw new Error(
				"Google OAuth client not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID)"
			);
		await ensureGisLoaded();
		if (accessToken) return accessToken;
		return await new Promise<string>((resolve, reject) => {
			try {
				const tokenClient = window.google!.accounts.oauth2.initTokenClient({
					client_id: clientId,
					scope: "https://www.googleapis.com/auth/drive.file",
					prompt: "consent",
					callback: (resp: GisTokenResponse) => {
						if (resp?.access_token) {
							setAccessToken(resp.access_token);
							resolve(resp.access_token);
						} else {
							reject(new Error("No access token returned"));
						}
					},
				});
				tokenClient.requestAccessToken();
			} catch (e) {
				reject(e);
			}
		});
	};

	const makeSafeTitle = (raw: string) =>
		raw.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

	const generatePdfBlob = async (): Promise<{
		blob: Blob;
		filename: string;
	}> => {
		if (!targetRef.current) throw new Error("Nothing to export yet");

		// Render to canvas at exact Letter @ 96dpi (816x1056 px)
		const targetW = Math.round(8.5 * 96);
		const targetH = Math.round(11 * 96);
		const canvas = await html2canvas(targetRef.current, {
			width: targetW,
			height: targetH,
			windowWidth: targetW,
			windowHeight: targetH,
			scale: 2, // force scale to keep PDF small enough for serverless limits
			useCORS: true,
			backgroundColor: "#ffffff",
			logging: false,
		});

		const imgData = canvas.toDataURL("image/jpeg", 0.85);
		const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "letter" });

		const pdfWidth = pdf.internal.pageSize.getWidth();
		const pdfHeight = pdf.internal.pageSize.getHeight();

		const pxToPt = (px: number) => (px * 72) / 96;
		const width = pxToPt(targetW);
		const height = pxToPt(targetH);
		pdf.addImage(imgData, "JPEG", 0, 0, width, height);

		const periodLabel =
			getPayPeriodById(data.payment.payPeriodId || "")?.label ||
			data.payment.payPeriodId;
		const rawTitle = `${data.paidTo.name} - ${periodLabel}`;
		const safeTitle = makeSafeTitle(rawTitle);

		const arrayBuffer = pdf.output("arraybuffer");
		const blob = new Blob([arrayBuffer], { type: "application/pdf" });
		const filename = `${safeTitle}.pdf`;
		return { blob, filename };
	};

	const handleUpload = async () => {
		setMessage(null);
		setFileLink(null);
		setUploading(true);
		try {
			const { blob, filename } = await generatePdfBlob();
			const contractorName = data.paidTo.name || "Contractor";

			const form = new FormData();
			form.append(
				"file",
				new File([blob], filename, { type: "application/pdf" })
			);
			form.append("filename", filename);
			form.append("contractorName", contractorName);
			form.append("allowCreate", "true");

			// If OAuth client is configured, obtain a user access token so uploads go to the user's My Drive
			let authHeader: Record<string, string> = {};
			try {
				if (getClientId()) {
					const token = await getAccessToken();
					authHeader = { Authorization: `Bearer ${token}` };
				}
			} catch (e) {
				// If OAuth not configured, fall back to service account (may fail on personal Gmail)
			}

			const res = await fetch("/api/drive/upload", {
				method: "POST",
				body: form,
				headers: authHeader,
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err?.error || `Upload failed (${res.status})`);
			}

			const json = (await res.json()) as {
				id?: string;
				webViewLink?: string;
				webContentLink?: string;
				name?: string;
			};

			setMessage(`Uploaded to Google Drive: ${json.name || filename}`);
			setFileLink(json.webViewLink || json.webContentLink || null);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			setMessage(`Upload error: ${msg}`);
		} finally {
			setUploading(false);
			// Auto clear message after a short delay (leave link if present)
			setTimeout(() => setMessage(null), 4000);
		}
	};

	return (
		<div className="inline-flex items-center gap-3">
			<button
				onClick={handleUpload}
				disabled={uploading}
				className={`px-6 py-3 rounded-lg text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
					uploading
						? "bg-gray-400 cursor-not-allowed"
						: "bg-indigo-600 hover:bg-indigo-700"
				}`}
				title="Upload this pay statement to Google Drive"
			>
				📤 {uploading ? "Uploading..." : "Upload to Drive"}
			</button>
			{message && (
				<span className="text-sm text-gray-700" role="status">
					{message}
					{fileLink && (
						<>
							{" "}
							<a
								className="text-indigo-700 underline"
								href={fileLink}
								target="_blank"
								rel="noreferrer"
							>
								Open
							</a>
						</>
					)}
				</span>
			)}
		</div>
	);
};

export default UploadToDriveButton;
