import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://yzdong.me"),
  title: {
    default: "Zi Dong",
    template: "%s — Zi Dong",
  },
  description: "Zi Dong's personal site.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-2xl px-6 py-16">{children}</div>
      </body>
    </html>
  );
}
