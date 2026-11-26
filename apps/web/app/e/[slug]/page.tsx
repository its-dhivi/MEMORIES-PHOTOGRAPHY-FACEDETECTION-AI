'use client';
import { useQuery } from '@tanstack/react-query';
import { Camera, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { GuestShell } from '@/components/guest/guest-shell';
import { guestApi } from '@/lib/guest-api';

export default function EventLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const event = useQuery({
    queryKey: ['guest-event', slug],
    queryFn: () => guestApi.event(slug),
    retry: false,
  });
  async function begin() {
    if (!event.data) return;
    if (event.data.pinRequired) {
      router.push(`/e/${slug}/access`);
      return;
    }
    await guestApi.createSession(slug);
    router.push(`/e/${slug}/selfie`);
  }
  if (event.isLoading)
    return <main aria-label="Loading event" className="min-h-screen animate-pulse bg-[#FAF9F6]" />;
  if (!event.data)
    return (
      <GuestShell slug={slug}>
        <section className="mx-auto max-w-md px-6 py-24 text-center">
          <Camera className="mx-auto text-[#B89B72]" size={42} />
          <h1 className="mt-5 font-serif text-4xl">Event unavailable</h1>
          <p className="mt-3 text-neutral-600">
            This event link is invalid or no longer available.
          </p>
        </section>
      </GuestShell>
    );
  const item = event.data;
  return (
    <GuestShell slug={slug}>
      <section className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1500px] pb-12 sm:min-h-[calc(100vh-96px)] sm:px-10 lg:grid-cols-[1.15fr_.85fr] lg:items-stretch lg:gap-12 lg:px-14 lg:pb-14">
        <div className="relative min-h-[55vh] overflow-hidden bg-[#e8e1d8] lg:min-h-[calc(100vh-150px)]">
          {item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Camera
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#a9a197]"
              size={120}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
          <p className="absolute bottom-5 left-5 text-xs uppercase tracking-[.2em] text-white/80 sm:bottom-8 sm:left-8">
            Photographed by {item.studioName}
          </p>
        </div>
        <div className="flex flex-col justify-center px-6 py-12 sm:px-0 sm:py-16 lg:py-10">
          <p className="eyebrow">{item.type.replaceAll('_', ' ')}</p>
          <h1 className="mt-5 font-serif text-[clamp(4rem,8vw,8.5rem)] font-medium leading-[.78] tracking-[-.055em]">
            {item.title}
          </h1>
          <p className="mt-7 text-sm uppercase tracking-[.13em] text-[#77746e]">
            {new Date(item.eventDate).toLocaleDateString(undefined, { dateStyle: 'long' })}
            {item.location ? ` · ${item.location}` : ''}
          </p>
          <p className="mt-10 max-w-lg font-serif text-3xl leading-[1.08] text-[#4b4843] sm:text-4xl">
            A private collection of moments, waiting to be rediscovered.
          </p>
          <p className="mt-5 max-w-md text-base leading-7 text-[#77746e]">
            Use one selfie to find photographs featuring you. Your search stays private and within
            this event.
          </p>
          <button
            onClick={() => void begin()}
            disabled={!item.finderAvailable}
            className="button-primary mt-9 min-h-14 w-full sm:w-fit sm:px-8 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Find My Photos
          </button>
          <p className="mt-5 flex items-center gap-2 text-xs text-[#77746e]">
            <LockKeyhole size={14} />
            {item.pinRequired ? 'Event PIN required' : 'Private, event-scoped access'}
          </p>
          {!item.finderAvailable && (
            <p
              role="status"
              className="mt-5 border-l-2 border-[#9a6b2f] bg-white p-4 text-sm text-[#795328]"
            >
              {item.finderMessage}
            </p>
          )}
          <div className="mt-12 flex items-start gap-3 border-t border-[#ded8cf] pt-6 text-xs leading-5 text-[#77746e]">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#a58b68]" />
            <span>
              Your selfie is used only for this private search and is not permanently stored by
              default.
            </span>
          </div>
        </div>
      </section>
    </GuestShell>
  );
}
