import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUCY · Growth Dashboard",
  description:
    "LUCY 2.0 growth & revenue metrics — MRR, retention, activation funnel, features.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg font-sans text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
