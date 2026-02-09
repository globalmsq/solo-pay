import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sample Merchant",
  description: "Sample merchant for SoloPay widget integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
