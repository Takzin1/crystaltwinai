import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrystalTwin-AI — Educational Digital Twin Simulator",
  description:
    "An educational digital twin simulator for AI-assisted crystallization process control. For education, research and PoC use only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
