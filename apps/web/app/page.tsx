import { Camera, LockKeyhole, QrCode, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Reveal } from '@/components/motion/reveal';

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#faf9f6] text-[#252522]">
      <nav className="fixed inset-x-0 top-0 z-40 border-b border-[#e8e4dd] bg-[#faf9f6]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-5 sm:px-10 lg:px-14">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#252522] text-white">
              <Camera size={18} />
            </span>
            <span>
              <strong className="block font-serif text-xl leading-none">
                Memories Photography
              </strong>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[.2em] text-[#725d44]">
                AI Photo Finder
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <a href="#experience" className="hidden text-sm text-[#6f6a63] sm:block">
              The experience
            </a>
            <Link href="/login" className="button-primary">
              Studio sign in
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto grid min-h-screen max-w-[1500px] items-center gap-12 px-5 pb-16 pt-28 sm:px-10 lg:grid-cols-[.9fr_1.1fr] lg:px-14">
        <Reveal>
          <p className="eyebrow">Private event photography</p>
          <h1 className="mt-6 font-serif text-[clamp(4.5rem,9vw,9.5rem)] font-medium leading-[.74] tracking-[-.06em]">
            Find yourself in the story.
          </h1>
          <p className="mt-9 max-w-lg text-lg leading-8 text-[#696660]">
            Guests discover the photographs that matter to them. Photographers deliver a private,
            beautifully branded collection.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#experience" className="button-primary">
              See how it feels
            </a>
            <Link href="/login" className="button-secondary">
              Open studio workspace
            </Link>
          </div>
          <div className="mt-12 flex gap-6 border-t border-[#ded8cf] pt-5 text-xs text-[#696660]">
            <span className="flex items-center gap-2">
              <ShieldCheck size={15} />
              Explicit consent
            </span>
            <span className="flex items-center gap-2">
              <LockKeyhole size={15} />
              Event-only search
            </span>
          </div>
        </Reveal>
        <Reveal delay={0.12} className="relative min-h-[64vh]">
          <div className="absolute bottom-0 left-0 top-20 w-[62%] bg-[#b7aa9c]" />
          <div className="absolute right-0 top-0 h-[72%] w-[54%] bg-[#d9c8b2] shadow-[0_30px_90px_rgba(55,45,34,.14)]" />
          <div className="absolute bottom-0 right-[8%] h-[42%] w-[48%] border-[12px] border-white bg-[#66736c]" />
          <div className="absolute bottom-8 left-8 max-w-xs bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#725d44]">
              A private album
            </p>
            <p className="mt-3 font-serif text-3xl leading-none">
              One selfie. Your moments, gathered.
            </p>
          </div>
        </Reveal>
      </section>

      <section id="experience" className="bg-[#252522] px-5 py-24 text-white sm:px-10 lg:px-14">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-xs uppercase tracking-[.2em] text-[#d2b995]">The guest journey</p>
              <h2 className="mt-4 font-serif text-6xl leading-[.85] sm:text-8xl">
                As simple as opening an album.
              </h2>
            </div>
            <p className="max-w-xl self-end text-lg leading-8 text-white/60 lg:justify-self-end">
              No app. No account. Just a private event link, clear consent, one portrait, and a
              gallery made personal.
            </p>
          </div>
          <div className="mt-16 grid border-y border-white/15 md:grid-cols-3 md:divide-x md:divide-white/15">
            {[
              [QrCode, 'Open the event', 'Scan the photographer’s QR invitation.'],
              [Camera, 'Take one portrait', 'Use the camera or upload a clear selfie.'],
              [ShieldCheck, 'Keep your memories', 'Preview and download only authorized matches.'],
            ].map(([Icon, title, copy]) => {
              const C = Icon as typeof Camera;
              return (
                <article
                  key={title as string}
                  className="border-b border-white/15 py-9 md:border-b-0 md:px-8 first:pl-0 last:pr-0"
                >
                  <C className="text-[#d2b995]" />
                  <h3 className="mt-12 font-serif text-3xl">{title as string}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/55">{copy as string}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1400px] gap-12 px-5 py-24 sm:px-10 lg:grid-cols-2 lg:px-14">
        <div>
          <p className="eyebrow">For photographers</p>
          <h2 className="mt-4 font-serif text-6xl leading-[.85] sm:text-7xl">
            A calmer way to deliver every celebration.
          </h2>
        </div>
        <div className="border-l border-[#ded8cf] pl-8">
          <p className="text-lg leading-8 text-[#696660]">
            Create event collections, upload private originals, monitor processing, design a
            shareable QR invitation, and understand guest engagement from a studio workspace built
            around the job.
          </p>
          <Link href="/login" className="button-primary mt-8">
            Enter the studio
          </Link>
        </div>
      </section>
      <footer className="border-t border-[#ded8cf] px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-serif text-2xl">Memories Photography</p>
          <p className="max-w-lg text-xs leading-5 text-[#696660]">
            Face matching availability depends on configured, commercially licensed models. No
            recognition accuracy claims are implied.
          </p>
        </div>
      </footer>
    </main>
  );
}
