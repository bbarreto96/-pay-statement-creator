export const formatUSD = (n: number): string =>
  (isNaN(n) ? 0 : n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

