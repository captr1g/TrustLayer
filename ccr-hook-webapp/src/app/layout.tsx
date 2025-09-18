import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navigation/navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "CCR Hook - Confidential Credit Risk for DeFi",
  description: "Privacy-preserving credit scoring for Uniswap v4. Get better swap conditions while protecting your financial privacy.",
  keywords: ["DeFi", "Credit Scoring", "Privacy", "Uniswap", "Web3", "FHE", "Zero Knowledge"],
  authors: [{ name: "CCR Hook Team" }],
  openGraph: {
    title: "CCR Hook - Confidential Credit Risk for DeFi",
    description: "Privacy-preserving credit scoring for Uniswap v4",
    type: "website",
    siteName: "CCR Hook",
  },
  twitter: {
    card: "summary_large_image",
    title: "CCR Hook - Confidential Credit Risk for DeFi",
    description: "Privacy-preserving credit scoring for Uniswap v4",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${playfairDisplay.variable} font-sans antialiased`}
      >
        <Providers>
          <div className="relative min-h-screen">
            <Navbar />
            <main className="pt-16">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
