import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Veto — Your AI tried. Veto said no.",
  description:
    "Hybrid EVM/WASM execution sandbox that physically prevents AI agents from executing hallucinated trades. Solidity holds the money. Rust does the math. Built on Robinhood Chain with Arbitrum Stylus.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Veto — Your AI tried. Veto said no.",
    description:
      "Hybrid EVM/WASM execution sandbox that blocks volatile AI trades on-chain via Stylus math coprocessor.",
    url: "https://veto-dashboard.vercel.app",
    siteName: "Veto",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Veto — WASM Risk Engine",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Veto — Your AI tried. Veto said no.",
    description:
      "WASM-powered trade interception on Robinhood Chain. 90% gas savings vs Solidity.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
