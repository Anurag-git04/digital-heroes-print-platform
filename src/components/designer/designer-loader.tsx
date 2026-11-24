"use client";

import dynamic from "next/dynamic";
import type { DesignerCanvasProps } from "./designer-canvas";

const DesignerCanvas = dynamic(
  () => import("./designer-canvas").then((module) => module.DesignerCanvas),
  {
    ssr: false,
    loading: () => <div className="h-[520px] animate-pulse rounded-2xl bg-[var(--line)]" aria-label="Loading designer" />,
  },
);

export function DesignerCanvasLoader(props: DesignerCanvasProps) {
  return <DesignerCanvas {...props} />;
}
