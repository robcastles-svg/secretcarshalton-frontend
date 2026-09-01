"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="container">
      <h1>Something went wrong</h1>
      <p>
        This page couldn&apos;t load — usually a temporary hiccup fetching content. Please try
        again in a moment.
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
