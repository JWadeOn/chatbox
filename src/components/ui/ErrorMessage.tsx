export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-[1.5rem] border border-red-200 bg-[rgba(255,245,244,0.94)] p-4 text-sm shadow-[0_12px_28px_rgba(180,65,47,0.08)]">
      <span className="text-red-700">Error: {message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto rounded-full border border-red-200 px-3 py-1 font-medium text-red-700 transition hover:bg-red-100 hover:text-red-900"
        >
          Retry
        </button>
      )}
    </div>
  );
}
