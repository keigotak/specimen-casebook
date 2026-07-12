import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "Specimen Casebook — Auditable biodiversity records",
    description: "Provenance-aware reconciliation for trustworthy biodiversity collections data.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Specimen Casebook",
      description: "Auditable data reconciliation for biodiversity collections.",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "Specimen Casebook — conflict preserved, science protected" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Specimen Casebook",
      description: "Auditable data reconciliation for biodiversity collections.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
