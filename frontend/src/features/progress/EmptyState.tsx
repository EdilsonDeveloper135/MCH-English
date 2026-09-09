interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = "Todavia no hay suficientes datos." }: EmptyStateProps) {
  return <p className="text-gray-600 text-sm py-10 text-center">{message}</p>;
}
