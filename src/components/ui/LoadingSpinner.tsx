export function LoadingSpinner({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return (
    <div className="flex items-center gap-2">
      <div className={`${sizes[size]} animate-spin rounded-full border-2 border-[rgba(19,34,56,0.14)] border-t-[#0f8b8d]`} />
      {label && <span className="text-sm text-[rgba(96,113,134,0.9)]">{label}</span>}
    </div>
  );
}
