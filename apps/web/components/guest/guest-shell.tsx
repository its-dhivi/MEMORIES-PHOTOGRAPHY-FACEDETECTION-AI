import Link from 'next/link';
import type { ReactNode } from 'react';

export function GuestShell({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <main className="guest-shell min-h-screen">
      <header className="relative z-30 mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-5 sm:h-24 sm:px-10 lg:px-14">
        <Link href={`/e/${slug}`} className="flex items-center gap-3 focus:outline-none">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#252522] font-serif text-lg text-white">
            M
          </span>
          <span>
            <span className="block font-serif text-lg font-semibold leading-none">
              Memories Photography
            </span>
            <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[.2em] text-[#a58b68]">
              Private event collection
            </span>
          </span>
        </Link>
        <Link
          href={`/e/${slug}/privacy`}
          className="min-h-11 rounded-full border border-[#ded8cf] px-4 py-3 text-xs text-[#6f6a63] hover:bg-white"
        >
          Privacy
        </Link>
      </header>
      {children}
    </main>
  );
}
