import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Shell } from "./components/shell";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "LifeOS",
  description: "Personal AI chief of staff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
