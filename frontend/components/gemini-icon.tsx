/** Monochrome Gemini-style mark (decorative; not official Google branding asset). */
export function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M12 2 4 7v10l8 5 8-5V7l-8-5zm0 2.35 5.45 3.1L12 10.55 6.55 7.45 12 4.35zM6 9.6l5 2.85v5.7L6 15.3V9.6zm12 0v5.7l-5 2.85v-5.7L18 9.6z" />
    </svg>
  );
}
