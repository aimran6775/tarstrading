export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 md:px-8">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-4 h-12 w-80 max-w-full" />
      <div className="mt-10 flex flex-col gap-5">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-28 w-full" />)}
      </div>
    </div>
  );
}
