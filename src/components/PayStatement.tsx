import React from "react";
import { PayStatementData } from "@/types/payStatement";

import { getPayPeriodById } from "../utils/payPeriods";

interface PayStatementProps {
	data: PayStatementData;
}

const PayStatement: React.FC<PayStatementProps> = ({
	data,
	preset = "current",
}) => {
	const isBP = preset === "bpv1";
	const sortedSummary = isBP
		? [...(data.summary || [])].sort((a, b) =>
				(a.description || "").localeCompare(b.description || "", undefined, {
					sensitivity: "base",
				})
		  )
		: data.summary || [];

	return (
		<div
			className="mx-auto bg-white print:shadow-none"
			style={{
				width: "8.5in",
				minHeight: "11in",
				padding: "0.75in 0.9in",
				fontFamily:
					"'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
				fontSize: "12px",
				lineHeight: "18px",
				color: "#474D53",
				position: "relative",
				boxSizing: "border-box",
				WebkitPrintColorAdjust: "exact",
				colorAdjust: "exact",
				WebkitFontSmoothing: "antialiased",
				MozOsxFontSmoothing: "grayscale",
				transform: "translateZ(0)", // Force hardware acceleration
				backfaceVisibility: "hidden",
			}}
		>
			{/* Centered Header with Logo and Payment Statement Title */}
			<div
				style={{
					textAlign: "center",
					marginBottom: "56px",
				}}
			>
				<div
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: "12px",
					}}
				>
					<img
						src="/Logo-01.png"
						alt="Element Logo"
						style={{
							height: "48px",
							width: "auto",
							transform: "translateY(-2px)",
							display: "block",
						}}
					/>
					<span
						style={{
							fontSize: "16px",
							fontWeight: 600,
							color: "#474D53",
							fontFamily: "var(--font-poppins), sans-serif",
						}}
					>
						Payment Statement
					</span>
				</div>
			</div>

			{/* Three Column Layout */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr 1fr",
					gap: "32px",
					marginBottom: "32px",
				}}
			>
				{/* Company Information */}
				<div>
					<h3
						style={{
							fontSize: "12px",
							fontWeight: 600,
							color: "#474D53",
							margin: 0,
							marginBottom: "8px",
							textAlign: "center",
						}}
					>
						{data.companyName}
					</h3>
					<div
						style={{
							fontSize: "10px",
							lineHeight: "14px",
							fontWeight: 400,
							textAlign: "center",
						}}
					>
						<div>{data.companyAddress.street}</div>
						{data.companyAddress.suite && (
							<div>{data.companyAddress.suite}</div>
						)}
						<div>
							{data.companyAddress.city}, {data.companyAddress.state}{" "}
							{data.companyAddress.zipCode}
						</div>
						<div>{data.companyPhone}</div>
					</div>
				</div>

				{/* Paid To */}
				<div>
					<h3
						style={{
							fontSize: "12px",
							fontWeight: 600,
							color: "#474D53",
							margin: 0,
							marginBottom: "8px",
							textAlign: "center",
						}}
					>
						Paid to
					</h3>
					<div
						style={{
							fontSize: "10px",
							lineHeight: "14px",
							fontWeight: 400,
							textAlign: "center",
						}}
					>
						<div>{data.paidTo.name}</div>
						{data.paidTo.address.street && (
							<div>{data.paidTo.address.street}</div>
						)}
						<div>
							{data.paidTo.address.city}, {data.paidTo.address.state}{" "}
							{data.paidTo.address.zipCode}
						</div>
					</div>
				</div>

				{/* Payment Information */}
				<div>
					<h3
						style={{
							fontSize: "12px",
							fontWeight: 600,
							color: "#474D53",
							margin: 0,
							marginBottom: "8px",
							textAlign: "center",
						}}
					>
						Payment
					</h3>
					<div
						style={{
							fontSize: "10px",
							lineHeight: "14px",
							fontWeight: 400,
							textAlign: "center",
						}}
					>
						<div>
							Pay Period:{" "}
							{getPayPeriodById(data.payment.payPeriodId)?.label || "N/A"}
						</div>
						<div>Method: {data.payment.method}</div>
					</div>
				</div>
			</div>

			{/* Payment Details Table */}
			{!isBP && (
				<div style={{ marginBottom: "24px" }}>
					<h3
						style={{
							fontSize: "10px",
							fontWeight: 600,
							color: "#474D53",
							margin: 0,
							marginBottom: "4px",
							textAlign: "left",
						}}
					>
						{isBP ? "Summary by Building" : "Payment Details"}
					</h3>
					{/* Thin horizontal teal line */}
					<div
						style={{
							width: "100%",
							height: "1px",
							backgroundColor: "#A8D5A6",
							marginBottom: "2px",
						}}
					></div>
					{/* Header labels positioned manually */}
					{isBP ? (
						<div
							style={{
								display: "flex",
								width: "100%",
								marginBottom: "8px",
							}}
						>
							<div
								style={{
									width: "40%",
									fontSize: "10px",
									fontWeight: 600,
									textAlign: "left",
									color: "#474D53",
								}}
							>
								Building
							</div>
							<div
								style={{
									width: "20%",
									fontSize: "10px",
									fontWeight: 600,
									textAlign: "center",
									color: "#474D53",
								}}
							>
								Qty
							</div>
							<div
								style={{
									width: "20%",
									fontSize: "10px",
									fontWeight: 600,
									textAlign: "center",
									color: "#474D53",
								}}
							>
								Rate
							</div>
							<div
								style={{
									width: "20%",
									fontSize: "10px",
									fontWeight: 600,
									textAlign: "right",
									color: "#474D53",
								}}
							>
								Amount
							</div>
						</div>
					) : (
						<div
							style={{
								display: "flex",
								width: "100%",
								marginBottom: "8px",
							}}
						>
							<div
								style={{
									width: "70%",
									fontSize: "10px",
									fontWeight: 600,
									textAlign: "left",
									color: "#474D53",
								}}
							>
								Description
							</div>
							<div style={{ width: "10%" }}></div>
							<div
								style={{
									width: "20%",
									fontSize: "10px",
									fontWeight: 600,
									textAlign: "right",
									color: "#474D53",
								}}
							>
								Total
							</div>
						</div>
					)}
					<table
						style={{
							width: "100%",
							borderCollapse: "collapse",
							border: "none",
							borderBottom: "0.5px solid #A8D5A6",
							borderSpacing: "0",
							margin: "0",
							padding: "0",
						}}
					>
						<tbody>
							{sortedSummary.map((item, index) =>
								isBP ? (
									<tr key={index}>
										<td
											style={{
												fontSize: "10px",
												fontWeight: 400,
												padding: "6px 0",
												border: "none",
												width: "40%",
											}}
										>
											{(item.description || "").replace(/\s*\(hourly\)$/i, "")}
										</td>
										<td
											style={{
												fontSize: "10px",
												fontWeight: 400,
												textAlign: "center",
												padding: "6px 0",
												border: "none",
												width: "20%",
											}}
										>
											{item.numberOfVisits}
											{item.qtySuffix ? ` ${item.qtySuffix}` : " units"}
										</td>
										<td
											style={{
												fontSize: "10px",
												fontWeight: 400,
												textAlign: "center",
												padding: "6px 0",
												border: "none",
												width: "20%",
											}}
										>
											{item.payPerVisit.toLocaleString("en-US", {
												style: "currency",
												currency: "USD",
												minimumFractionDigits: 2,
											})}
											{item.qtySuffix === "hrs" ? " / hr" : " / unit"}
										</td>
										<td
											style={{
												fontSize: "10px",
												fontWeight: 400,
												textAlign: "right",
												padding: "6px 0",
												border: "none",
												width: "20%",
											}}
										>
											{item.total.toLocaleString("en-US", {
												style: "currency",
												currency: "USD",
												minimumFractionDigits: 2,
											})}
										</td>
									</tr>
								) : (
									<tr key={index}>
										<td
											style={{
												fontSize: "10px",
												fontWeight: 400,
												padding: "6px 0",
												border: "none",
												width: "70%",
											}}
										>
											{(item.description || "").replace(/\s*\(hourly\)$/i, "")}
										</td>
										<td
											style={{
												fontSize: "10px",
												fontWeight: 400,
												padding: "6px 0",
												border: "none",
												width: "10%",
											}}
										>
											{/* Blank spacer */}
										</td>
										<td
											style={{
												fontSize: "10px",
												fontWeight: 400,
												textAlign: "right",
												padding: "6px 0",
												border: "none",
												width: "20%",
											}}
										>
											{item.total.toLocaleString("en-US", {
												style: "currency",
												currency: "USD",
												minimumFractionDigits: 2,
											})}
										</td>
									</tr>
								)
							)}
							{isBP ? (
								<tr>
									<td
										style={{
											fontSize: "10px",
											fontWeight: 600,
											padding: "6px 0 3px 0",
											border: "none",
											lineHeight: "10px",
											width: "40%",
										}}
									>
										Total
									</td>
									<td style={{ width: "20%" }} />
									<td style={{ width: "20%" }} />
									<td
										style={{
											fontSize: "10px",
											fontWeight: 600,
											textAlign: "right",
											padding: "6px 0 3px 0",
											border: "none",
											lineHeight: "10px",
											width: "20%",
										}}
									>
										{(data.summary || [])
											.reduce((sum, item) => sum + (item.total || 0), 0)
											.toLocaleString("en-US", {
												style: "currency",
												currency: "USD",
												minimumFractionDigits: 2,
											})}
									</td>
								</tr>
							) : (
								<tr>
									<td
										style={{
											fontSize: "10px",
											fontWeight: 400,
											padding: "6px 0 3px 0",
											border: "none",
											lineHeight: "10px",
											width: "70%",
										}}
									>
										Total Payment
									</td>
									<td
										style={{
											fontSize: "10px",
											fontWeight: 400,
											padding: "6px 0 3px 0",
											border: "none",
											lineHeight: "10px",
											width: "10%",
										}}
									>
										{/* Blank spacer */}
									</td>
									<td
										style={{
											fontSize: "10px",
											fontWeight: 600,
											textAlign: "right",
											padding: "6px 0 3px 0",
											border: "none",
											lineHeight: "10px",
											width: "20%",
										}}
									>
										{(data.summary || [])
											.reduce((sum, item) => sum + (item.total || 0), 0)
											.toLocaleString("en-US", {
												style: "currency",
												currency: "USD",
												minimumFractionDigits: 2,
											})}
									</td>
								</tr>
							)}
							<tr>
								<td colSpan={isBP ? 4 : 3} style={{ padding: "6px 0" }} />
							</tr>
						</tbody>
					</table>
				</div>
			)}

			{/* Summary Table */}
			<div>
				<h3
					style={{
						fontSize: "11px",
						fontWeight: 600,
						color: "#474D53",
						margin: 0,
						marginBottom: "4px",
						textAlign: "left",
					}}
				>
					{isBP ? "Itemized Details" : "Summary"}
				</h3>
				{/* Thin horizontal teal line */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "#A8D5A6",
						marginBottom: "2px",
					}}
				></div>
				{/* Header labels positioned manually */}
				<div
					style={{
						display: "flex",
						width: "100%",
						marginBottom: "0px",
						paddingBottom: "8px",
					}}
				>
					<div
						style={{
							width: "30%",
							fontSize: "10px",
							fontWeight: 600,
							textAlign: "left",
							color: "#474D53",
							borderRight: "0.5px solid #E5E7EB",
							paddingRight: "8px",
						}}
					>
						Description
					</div>
					<div
						style={{
							width: "25%",
							fontSize: "10px",
							fontWeight: 600,
							textAlign: "center",
							color: "#474D53",
							borderRight: "0.5px solid #E5E7EB",
							paddingRight: "8px",
						}}
					>
						{isBP ? "Rate" : "Pay Per Visit"}
					</div>
					<div
						style={{
							width: "25%",
							fontSize: "10px",
							fontWeight: 600,
							textAlign: "center",
							color: "#474D53",
							borderRight: "0.5px solid #E5E7EB",
							paddingRight: "8px",
						}}
					>
						<div
							style={{
								width: "25%",
								fontSize: "10px",
								fontWeight: 600,
								textAlign: "center",
								color: "#474D53",
								borderRight: "0.5px solid #E5E7EB",
								paddingRight: "8px",
							}}
						>
							&nbsp;
						</div>
						<div
							style={{
								width: "25%",
								fontSize: "10px",
								fontWeight: 600,
								textAlign: "center",
								color: "#474D53",
								borderRight: "0.5px solid #E5E7EB",
								paddingRight: "8px",
							}}
						>
							Qty
						</div>
					</div>
					<div
						style={{
							width: "20%",
							fontSize: "10px",
							fontWeight: 600,
							textAlign: "right",
							color: "#474D53",
						}}
					>
						Total
					</div>
				</div>
				<table
					style={{
						width: "100%",
						borderCollapse: "collapse",
						border: "none",
						borderBottom: "0.5px solid #A8D5A6",
						borderSpacing: "0",
						margin: "0",
						padding: "0",
					}}
				>
					<tbody>
						{sortedSummary.map((item, index) => (
							<tr key={index}>
								<td
									style={{
										fontSize: "10px",
										fontWeight: 400,
										padding: "6px 0",
										border: "none",
										borderRight: "0.5px solid #E5E7EB",
										width: "30%",
									}}
								>
									{item.description}
								</td>
								<td
									style={{
										fontSize: "10px",
										fontWeight: 400,
										textAlign: "center",
										padding: "6px 0",
										border: "none",
										borderRight: "0.5px solid #E5E7EB",
										width: "25%",
									}}
								>
									{item.payPerVisit.toLocaleString("en-US", {
										style: "currency",
										currency: "USD",
										minimumFractionDigits: 2,
									})}
									{isBP ? (item.qtySuffix === "hrs" ? " / hr" : " / unit") : ""}
								</td>
								<td
									style={{
										fontSize: "10px",
										fontWeight: 400,
										textAlign: "center",
										padding: "6px 0",
										border: "none",
										borderRight: "0.5px solid #E5E7EB",
										width: "25%",
									}}
								>
									{item.numberOfVisits}
									{item.qtySuffix ? ` ${item.qtySuffix}` : " units"}
								</td>
								<td
									style={{
										fontSize: "10px",
										fontWeight: 400,
										textAlign: "right",
										padding: "6px 0",
										border: "none",
										width: "20%",
									}}
								>
									{item.total.toLocaleString("en-US", {
										style: "currency",
										currency: "USD",
										minimumFractionDigits: 2,
									})}
								</td>
							</tr>
						))}
						{/* Total row for summary */}
						<tr>
							<td
								style={{
									fontSize: "10px",
									fontWeight: 600,
									padding: "6px 0 3px 0",
									border: "none",
									borderRight: "0.5px solid #E5E7EB",
									width: "30%",
								}}
							>
								Total
							</td>
							<td
								style={{
									fontSize: "10px",
									fontWeight: 400,
									padding: "6px 0 3px 0",
									border: "none",
									borderRight: "0.5px solid #E5E7EB",
									width: "25%",
								}}
							>
								{/* Blank spacer */}
							</td>
							<td
								style={{
									fontSize: "10px",
									fontWeight: 600,
									textAlign: "center",
									padding: "6px 0 3px 0",
									border: "none",
									borderRight: "0.5px solid #E5E7EB",
									width: "25%",
								}}
							></td>
							<td
								style={{
									fontSize: "10px",
									fontWeight: 600,
									textAlign: "right",
									padding: "6px 0 3px 0",
									border: "none",
									width: "20%",
								}}
							>
								{data.summary
									.reduce((sum, item) => sum + item.total, 0)
									.toLocaleString("en-US", {
										style: "currency",
										currency: "USD",
										minimumFractionDigits: 2,
									})}
							</td>
						</tr>
					</tbody>
				</table>

				{/* Notes Section - moved below second table */}
				{data.notes && (
					<div
						style={{
							marginTop: "20px",
							padding: "12px",
							backgroundColor: "#f9f9f9",
							borderRadius: "4px",
							border: "1px solid #e5e7eb",
						}}
					>
						<div
							style={{
								fontSize: "10px",
								fontWeight: 600,
								color: "#374151",
								marginBottom: "8px",
							}}
						>
							Notes:
						</div>
						<div
							style={{
								fontSize: "10px",
								color: "#6b7280",
								lineHeight: "1.4",
							}}
						>
							{data.notes}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default PayStatement;
