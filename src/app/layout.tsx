import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Precifarm EV Charging CMS",
  description: "Home installs, public charging sessions and M-Pesa operations for Precifarm Kenya",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white antialiased">{children}</body>
    </html>
  );
}
