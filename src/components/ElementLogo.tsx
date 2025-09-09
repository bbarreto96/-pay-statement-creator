import React from "react";

interface ElementLogoProps {
	size?: number;
}

const ElementLogo: React.FC<ElementLogoProps> = ({ size = 40 }) => {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
			{/* Element Logo - Green rounded rectangle with white "E" */}
			<div
				style={{
					width: size * 1.5,
					height: size,
					backgroundColor: "#4BAA47",
					borderRadius: "8px",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "white",
					fontWeight: 600,
					fontSize: size * 0.6,
					fontFamily: "var(--font-poppins), sans-serif",
				}}
			>
				Element
			</div>
		</div>
	);
};

export default ElementLogo;
