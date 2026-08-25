export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full bg-white">
      {/* root layout locks body scrolling, so this column owns its own */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-12">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
      </div>

      <aside className="hidden w-1/2 p-4 lg:block">
        <div className="relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-[#2f4a2e] via-[#3d5a3c] to-[#c1694f]">
          <div className="absolute -top-24 -left-24 size-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-0 bottom-40 size-72 rounded-full bg-[#c1694f]/40 blur-3xl" />
        </div>
      </aside>
    </div>
  );
}
