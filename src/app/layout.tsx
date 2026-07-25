import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import OneSignalInit from "@/components/OneSignalInit";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Health Wallet & Smart Prescription Guardian",
  description:
    "Unified QR-based health records and real-time clinical safety intelligence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}
      >
        <OneSignalInit />
        {mainLayoutContent(children)}
      </body>
    </html>
  );
}

function mainLayoutContent(children: React.ReactNode) {
  return (
    <div className="min-h-screen flex flex-col justify-between">
      <main className="grow">{children}</main>
      <footer className="py-6 text-center text-xs text-gray-400 border-t border-gray-100 bg-white">
        Health Wallet Infrastructure • National Clinical Safety Guardian System
      </footer>
    </div>
  );
}
