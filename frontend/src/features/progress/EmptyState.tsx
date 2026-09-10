interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = "Todavia no hay suficientes datos." }: EmptyStateProps) {
  return <p className="text-gray-400 text-sm py-10 text-center">{message}</p>;
}
