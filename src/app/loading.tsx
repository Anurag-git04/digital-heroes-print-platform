export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 lg:px-10">
      <div className="space-y-6">
        <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--line)]" />
        <div className="h-12 w-2/3 max-w-lg animate-pulse rounded-2xl bg-[var(--line)]" />
        <div className="h-5 w-1/2 max-w-md animate-pulse rounded-full bg-[var(--line)]" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-60 animate-pulse rounded-2xl bg-[var(--line)]" />
          ))}
        </div>
      </div>
    </main>
  );
}
