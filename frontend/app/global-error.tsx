'use client';

/**
 * Catches errors in the root layout (e.g. during SSR) and shows a fallback
 * instead of a 500. Must include <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>We&apos;re sorry. Please try again.</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer', marginTop: '1rem' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
