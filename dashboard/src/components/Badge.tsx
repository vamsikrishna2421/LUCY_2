import type { ReactNode } from "react";

type Tone = "accent" | "success" | "danger" | "neutral" | "info";

const toneClass: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent-glow border-accent-line",
  success: "bg-success/10 text-success border-success/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  info: "bg-info/10 text-info border-info/30",
  neutral: "bg-surface-alt text-text-muted border-border",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2.5 py-0.5 text-caption font-medium ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}
