export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 md:px-8">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-4 h-12 w-72 max-w-full" />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => <div key={i} className="skeleton h-48 w-full" />)}
      </div>
    </div>
  );
}
