/* Market page skeleton — chart + tray placeholder while quotes/bars load. */
export default function MarketLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 animate-pulse px-4 pb-24 pt-4 md:px-6">
      <div className="h-8 w-40 rounded bg-bg2/50" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="h-[420px] rounded-2xl border border-hairline bg-bg2/40" />
        <div className="h-[420px] rounded-2xl border border-hairline bg-bg2/40" />
      </div>
    </main>
  );
}
