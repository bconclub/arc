import type { Metadata } from "next";
import { PitchDeck } from "@/components/pitch/PitchDeck";

export const metadata: Metadata = { title: "PROXe · Pitch" };

/** /pitch: what PROXe is and what it solves, one card at a time. Owner session only (middleware). */
export default function PitchPage() {
  return <PitchDeck />;
}
