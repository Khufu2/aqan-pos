import type { Metadata } from "next";
import "./globals.css";
import "./operations.css";
import "./accessibility.css";
import "./purchasing-improvements.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pos.aqanbiomedical.com"),
  title: "AQAN BIOMEDICAL POS",
  description: "Intelligent biomedical equipment sales, stock, CRM, service and customer growth in one secure workspace.",
  openGraph: {
    title: "AQAN BIOMEDICAL POS",
    description: "Secure biomedical sales, inventory, service and customer intelligence.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "AQAN BIOMEDICAL POS intelligent biomedical workspace" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AQAN BIOMEDICAL POS",
    description: "Secure biomedical sales, inventory, service and customer intelligence.",
    images: ["/og.jpg"],
  },
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
