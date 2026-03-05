/**
 * components/atoms/LoadingSpinner.tsx
 * Animated spinner for page loads and form submits.
 * §4.1 Atoms — props: size sm|md|lg, fullscreen?
 */

import { cn } from "../../lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  /** Centres spinner in a full-viewport overlay */
  fullscreen?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
};

export function LoadingSpinner({
  size = "md",
  fullscreen = false,
  className,
}: LoadingSpinnerProps) {
  const spinner = (
    <div
      aria-label="Loading"
      role="status"
      className={cn(
        "animate-spin rounded-full border-current border-r-transparent",
        SIZE_CLASSES[size],
        className
      )}
    />
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
}