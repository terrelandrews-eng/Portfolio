import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "LifeOS",
  description: "Personal AI chief of staff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-3xl px-6 py-8">
          <header className="mb-8 flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold text-accent">
              LifeOS
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/today" className="hover:underline">
                Today
              </Link>
              <Link href="/week" className="hover:underline">
                Week
              </Link>
              <Link href="/chat" className="hover:underline">
                Chat
              </Link>
              <Link href="/knowledge" className="hover:underline">
                Knowledge
              </Link>
              <Link href="/settings" className="hover:underline">
                Settings
              </Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
