import Link from "next/link";

interface EmptyStateProps {
  message?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  message = "Todavia no hay suficientes datos.",
  actionLabel = "Comenzar a practicar",
  actionHref = "/library",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
      <p className="text-gray-400 text-sm">{message}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="inline-block text-xs bg-neutral-900 hover:bg-neutral-800 text-cyan-400 hover:text-cyan-300 border border-neutral-700 px-3 py-1.5 rounded-lg font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}

