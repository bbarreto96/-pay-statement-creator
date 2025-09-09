"use client";

import React, { useRef } from "react";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import PayStatement from "./PayStatement";
import { PayStatementData } from "@/types/payStatement";
import { getPayPeriodById } from "../utils/payPeriods";
import SaveStatementButton from "./SaveStatementButton";

interface PDFGeneratorProps {
	data: PayStatementData;
}

const PDFGenerator: React.FC<PDFGeneratorProps> = ({ data }) => {
	const componentRef = useRef<HTMLDivElement>(null);

	// Print functionality using react-to-print
	/*
	const handlePrint = useReactToPrint({
		content: () => componentRef.current,
		documentTitle: `Pay Statement - ${data.paidTo.name} - ${
			getPayPeriodById(data.payment.payPeriodId)?.label || "Pay Period"
		}`,
		pageStyle: `
      @page {
        size: A4;
        margin: 0.5in;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }
      }
    `,
	});
*/

	// Alternative PDF generation using browser's native print functionality
	const generatePDF = async () => {
		if (!componentRef.current) return;

		try {
			console.log("Starting PDF generation using print method...");

			// Build a nice, safe title for the PDF using Contractor Name + Pay Period
			const periodLabel =
				getPayPeriodById(data.payment.payPeriodId)?.label || "Pay Period";
			const rawTitle = `${data.paidTo.name} - ${periodLabel}`;
			const safeTitle = rawTitle
				.replace(/[^A-Za-z0-9]+/g, "_")
				.replace(/^_+|_+$/g, "");

			// Create a new window for printing
			const printWindow = window.open("", "_blank");
			if (!printWindow) {
				alert("Please allow popups for PDF generation");
				return;
			}

			// Get the HTML content
			let content = componentRef.current.outerHTML;
			// Ensure images use absolute URLs so they load in the print window
			content = content.replace(/src=\"\//g, `src="${window.location.origin}/`);

			// Create the print document
			printWindow.document.write(`
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<title>${safeTitle}</title>
					<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
					<style>
						@page {
							size: A4;
							margin: 0.5in;
						}

						* {
							margin: 0;
							padding: 0;
							box-sizing: border-box;
						}

						body {
							font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
							-webkit-print-color-adjust: exact;
							color-adjust: exact;
							background: white;
						}

						img {
							max-width: 100%;
							height: auto;
							display: block;
						}

						table {
							border-collapse: collapse;
							width: 100%;
						}

						.mx-auto {
							margin-left: auto;
							margin-right: auto;
						}

						.bg-white {
							background-color: white;
						}

						@media print {
							body {
								-webkit-print-color-adjust: exact;
								color-adjust: exact;
							}

							* {
								-webkit-print-color-adjust: exact;
								color-adjust: exact;
							}
						}
					</style>
				</head>
				<body>
					${content}
				</body>
				</html>
			`);

			// Wait for content to load
			printWindow.document.close();
			// Ensure title is applied for Save as PDF default filename
			try {
				printWindow.document.title = safeTitle;
			} catch (e) {}

			// Wait for fonts and images to load
			await new Promise((resolve) => {
				printWindow.onload = () => {
					setTimeout(resolve, 1000);
				};
				// Fallback timeout
				setTimeout(resolve, 2000);
			});

			// Trigger print dialog
			printWindow.focus();
			printWindow.print();

			// Close the window after a delay
			setTimeout(() => {
				printWindow.close();
			}, 1000);

			console.log("PDF generation completed - print dialog opened");
		} catch (error) {
			console.error("Error generating PDF:", error);
			const message = error instanceof Error ? error.message : String(error);
			alert(`Error generating PDF: ${message}. Please try again.`);
		}
	};

	// Fallback method using html2canvas (simplified)
	const generatePDFCanvas = async () => {
		if (!componentRef.current) return;

		try {
			console.log("Starting fallback PDF generation...");

			// Simple html2canvas approach
			const canvas = await html2canvas(componentRef.current, {
				scale: 1,
				useCORS: true,
				backgroundColor: "#ffffff",
				logging: false,
			});

			const imgData = canvas.toDataURL("image/png");
			const pdf = new jsPDF("p", "mm", "a4");

			const pdfWidth = pdf.internal.pageSize.getWidth();
			const pdfHeight = pdf.internal.pageSize.getHeight();

			// Simple fit-to-page calculation
			const imgAspectRatio = canvas.height / canvas.width;
			const pdfAspectRatio = pdfHeight / pdfWidth;

			let width, height;
			if (imgAspectRatio > pdfAspectRatio) {
				height = pdfHeight - 20;
				width = height / imgAspectRatio;
			} else {
				width = pdfWidth - 20;
				height = width * imgAspectRatio;
			}

			const x = (pdfWidth - width) / 2;
			const y = (pdfHeight - height) / 2;

			pdf.addImage(imgData, "PNG", x, y, width, height);

			const periodLabelCanvas =
				getPayPeriodById(data.payment.payPeriodId)?.label || "Pay Period";
			const rawTitleCanvas = `${data.paidTo.name} - ${periodLabelCanvas}`;
			const safeTitleCanvas = rawTitleCanvas
				.replace(/[^A-Za-z0-9]+/g, "_")
				.replace(/^_+|_+$/g, "");
			pdf.save(`${safeTitleCanvas}.pdf`);

			console.log("Fallback PDF generation completed");
		} catch (error) {
			console.error("Error in fallback PDF generation:", error);
			const message = error instanceof Error ? error.message : String(error);
			alert(`Error generating PDF: ${message}. Please try again.`);
		}
	};

	// Removed unused Zapier/Drive upload function

	return (
		<div className="space-y-4">
			{/* Action Buttons */}
			<div className="flex gap-4 justify-center print:hidden flex-wrap">
				<button
					onClick={generatePDF}
					className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
				>
					🖨️ Print/Save as PDF (Recommended)
				</button>
				<button
					onClick={generatePDFCanvas}
					className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
				>
					📄 Download PDF (Alternative)
				</button>
				{/* Save Statement button added; Zapier/Drive removed */}
				<SaveStatementButton data={data} />
			</div>

			{/* Pay Statement Component */}
			<div ref={componentRef}>
				<PayStatement data={data} />
			</div>
		</div>
	);
};

export default PDFGenerator;
