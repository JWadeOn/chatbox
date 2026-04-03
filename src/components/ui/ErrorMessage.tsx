export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
      <span className="text-red-600">Error: {message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-auto text-red-700 underline hover:text-red-900">
          Retry
        </button>
      )}
    </div>
  );
}
