import type { Metadata } from "next";
import { Geist, Geist_Mono, Poppins, Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { PayPeriodProvider } from "@/contexts/PayPeriodContext";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

const poppins = Poppins({
	variable: "--font-poppins",
	subsets: ["latin"],
	weight: ["400", "500", "600"],
});

const manrope = Manrope({
	variable: "--font-body",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
	variable: "--font-display",
	subsets: ["latin"],
	weight: ["600", "700"],
});

export const metadata: Metadata = {
	title: "Pay Statement Creator",
	description: "Create professional payment statements with ease",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${manrope.variable} ${fraunces.variable} antialiased`}
				style={{ overscrollBehaviorX: "auto" }}
			>
				<PayPeriodProvider>{children}</PayPeriodProvider>
			</body>
		</html>
	);
}
