import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Manrope, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "./providers";

// Self-hosted by Next at build time: no font request to Google from the visitor's phone.
// Manrope for headings, Inter for text, IBM Plex Mono for data labels (times, coordinates, model
// details); Noto Sans Bengali for Bangla (the Latin fonts have no Bengali letters).
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap", variable: "--font-manrope" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--font-plex-mono" });
const notoBengali = Noto_Sans_Bengali({ subsets: ["bengali"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-noto-bengali" });

export const metadata: Metadata = {
  title: "Rokkha — Flood intelligence and early warning for Bangladesh",
  description:
    "Daily district flood forecasts, satellite flood history and early warnings for Bangladesh, with flood-help requests and shared rescue coordination.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${plexMono.variable} ${notoBengali.variable}`}>
      <body className="bg-rk-page text-rk-ink antialiased min-h-screen selection:bg-rk-mist selection:text-rk-forest">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

