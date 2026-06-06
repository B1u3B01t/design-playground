import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./playground-global.css";
import "./playground-tailwind-entry.css";

export const metadata: Metadata = {
  title: "Playground",
};

export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return children;
}
