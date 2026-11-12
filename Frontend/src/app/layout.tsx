import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Rokkha — Bangladesh Flood Intelligence & Public Safety Platform",
  description:
    "Open district-level climate intelligence for flood analysis, risk mapping, and early warnings for Bangladesh.",
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
    <html lang="en">
      <body className="bg-brand-warm text-brand-forest antialiased min-h-screen selection:bg-brand-limestone selection:text-brand-forest">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

