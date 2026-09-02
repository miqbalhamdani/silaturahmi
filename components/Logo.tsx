/**
 * The Silaturahmi mark: one node branching down into two — a generation and
 * the one it opens onto. Drawn on lucide's grid (24 viewBox, stroke 2, round
 * joins) so it sits evenly beside the icons it shares a toolbar with, and
 * takes currentColor so it follows the palette into dark mode.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="5" r="2.6" />
      <circle cx="5" cy="18" r="2.6" />
      <circle cx="19" cy="18" r="2.6" />
      <path d="M12 8v4m0 0-5.5 3.8M12 12l5.5 3.8" />
    </svg>
  );
}

/** Mark plus wordmark. Colour the word via className, the mark via markClassName. */
export default function Logo({
  className = "",
  markClassName = "size-8 text-primary",
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={`shrink-0 ${markClassName}`} />
      <span className="font-display text-xl font-semibold">Silaturahmi</span>
    </span>
  );
}
