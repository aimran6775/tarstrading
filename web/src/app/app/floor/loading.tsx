/*
  Floor skeleton — the heaviest page (it reconciles + fans out queries), so it
  gets a shaped placeholder instead of a blank shell while data streams.
*/
export default function FloorLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 animate-pulse px-4 pb-24 pt-4 md:px-6 md:pb-10">
      <div className="h-64 rounded-3xl border border-hairline bg-bg2/50" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl border border-hairline bg-bg2/40" />)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-2xl border border-hairline bg-bg2/40" />)}
      </div>
    </main>
  );
}
