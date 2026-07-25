import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Precifarm Ticketing CMS",
  description: "Booking, ticketing and payment operations for Precifarm routes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white antialiased">{children}</body>
    </html>
  );
}
