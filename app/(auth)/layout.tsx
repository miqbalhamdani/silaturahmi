import Link from "next/link";
import Logo, { LogoMark } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full bg-white">
      {/* root layout locks body scrolling, so this column owns its own */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-12">
          <div className="w-full max-w-[26rem]">
            {/* these pages are pinned light, so the mark takes literal palette
                values rather than tokens the .dark class could flip */}
            <Link href="/" className="mb-10 inline-flex rounded-lg">
              <Logo
                className="text-[#2c2418]"
                markClassName="size-9 text-[#3d5a3c]"
              />
            </Link>
            {children}
          </div>
        </div>
      </div>

      <aside className="hidden w-1/2 p-4 lg:block">
        <div className="relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-[#2f4a2e] via-[#3d5a3c] to-[#c1694f]">
          <div className="absolute -top-24 -left-24 size-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute right-0 bottom-40 size-72 rounded-full bg-[#c1694f]/40 blur-3xl" />
          <LogoMark className="absolute -right-20 -bottom-24 size-[28rem] text-white/12" />
        </div>
      </aside>
    </div>
  );
}
