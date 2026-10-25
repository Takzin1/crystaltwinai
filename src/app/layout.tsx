import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrystalPilot · CrystalTwin-AI — Evidence-gated AI experiment lab",
  description:
    "An NVIDIA Nemotron research agent (via Nebius Token Factory) that proposes, gates, simulates and records educational crystallization experiments. Education, research and PoC use only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
