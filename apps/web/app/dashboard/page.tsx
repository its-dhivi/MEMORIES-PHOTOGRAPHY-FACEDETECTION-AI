'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Camera, CheckCircle2, CircleAlert, QrCode, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { dashboardApi } from '@/lib/api';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 GB';
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export default function DashboardPage() {
  const overview = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: dashboardApi.overview,
  });
  const recent = useQuery({
    queryKey: ['dashboard', 'recent-events'],
    queryFn: dashboardApi.recentEvents,
  });
  const activeEvent =
    recent.data?.items.find((item) => item.status === 'ACTIVE') ?? recent.data?.items[0];

  if (overview.isError || recent.isError)
    return (
      <div role="alert" className="border-l-2 border-[#9d4848] bg-white p-6 text-sm text-[#7e3636]">
        Your studio workspace could not be loaded. Refresh to try again.
      </div>
    );

  return (
    <div className="space-y-14 lg:space-y-20">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)] lg:items-end">
        <div>
          <p className="eyebrow">Today in your studio</p>
          <h1 className="mt-4 max-w-3xl font-serif text-[clamp(3.25rem,7vw,7.2rem)] font-medium leading-[.82] tracking-[-.055em]">
            Make the next collection unforgettable.
          </h1>
        </div>
        <div className="border-t border-[#d9d3ca] pt-5 lg:border-l lg:border-t-0 lg:pb-2 lg:pl-8 lg:pt-0">
          <p className="max-w-md text-base leading-7 text-[#6e6a64]">
            Create an event, add photographs, and share a private experience with guests—all from
            one calm workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/events/new" className="button-primary">
              Create an event
            </Link>
            <Link href="/dashboard/events" className="button-secondary">
              Open event library
            </Link>
          </div>
        </div>
      </section>

      {overview.isLoading || recent.isLoading ? (
        <div className="shimmer h-[500px] rounded-[2rem]" />
      ) : (
        <>
          {activeEvent ? (
            <section className="grid overflow-hidden bg-[#252522] text-white lg:grid-cols-[1.25fr_.75fr]">
              <div className="relative min-h-[430px] overflow-hidden">
                {activeEvent.coverUrl ? (
                  <img
                    src={activeEvent.coverUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-700 hover:scale-[1.02]"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#4b4741]">
                    <Camera size={64} className="text-white/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-7 sm:p-10">
                  <p className="text-xs uppercase tracking-[.22em] text-[#eadbc5]">
                    Active collection
                  </p>
                  <h2 className="mt-3 max-w-2xl font-serif text-5xl font-medium leading-none sm:text-7xl">
                    {activeEvent.title}
                  </h2>
                  <p className="mt-4 text-sm text-white/70">
                    {new Date(activeEvent.eventDate).toLocaleDateString(undefined, {
                      dateStyle: 'long',
                    })}{' '}
                    · {activeEvent.photoCount.toLocaleString()} photographs
                  </p>
                </div>
              </div>
              <div className="flex flex-col justify-between p-7 sm:p-10">
                <div>
                  <p className="text-xs uppercase tracking-[.2em] text-white/45">
                    Collection readiness
                  </p>
                  <div className="mt-6 flex items-end justify-between">
                    <p className="font-serif text-7xl leading-none">
                      {activeEvent.processing.percent}%
                    </p>
                    <span className="pb-2 text-sm text-white/55">processed</span>
                  </div>
                  <div className="mt-5 h-px bg-white/15">
                    <div
                      className="h-px bg-[#d9c4a5]"
                      style={{ width: `${activeEvent.processing.percent}%` }}
                    />
                  </div>
                  <p className="mt-5 text-sm leading-6 text-white/60">
                    {activeEvent.processing.pending
                      ? `${activeEvent.processing.pending} photographs are still waiting.`
                      : 'This collection is ready to share.'}
                  </p>
                </div>
                <div className="mt-12 space-y-2">
                  <Link
                    href={`/dashboard/events/${activeEvent.id}/photos#uploads`}
                    className="flex min-h-14 items-center justify-between border-t border-white/15 py-3 text-sm hover:text-[#e8d2b2]"
                  >
                    <span className="flex items-center gap-3">
                      <UploadCloud size={18} /> Add photographs
                    </span>
                    <ArrowUpRight size={18} />
                  </Link>
                  <Link
                    href={`/dashboard/events/${activeEvent.id}/qr`}
                    className="flex min-h-14 items-center justify-between border-t border-white/15 py-3 text-sm hover:text-[#e8d2b2]"
                  >
                    <span className="flex items-center gap-3">
                      <QrCode size={18} /> Share with guests
                    </span>
                    <ArrowUpRight size={18} />
                  </Link>
                  <Link
                    href={`/dashboard/events/${activeEvent.id}`}
                    className="flex min-h-14 items-center justify-between border-t border-white/15 py-3 text-sm hover:text-[#e8d2b2]"
                  >
                    <span>Open event workspace</span>
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
              </div>
            </section>
          ) : (
            <section className="border-y border-[#ded8cf] py-16 text-center">
              <Camera className="mx-auto text-[#a58b68]" />
              <h2 className="mt-5 font-serif text-4xl">Your first collection begins here.</h2>
              <Link href="/dashboard/events/new" className="button-primary mt-6">
                Create an event
              </Link>
            </section>
          )}

          <section>
            <div className="flex items-end justify-between border-b border-[#ded8cf] pb-5">
              <div>
                <p className="eyebrow">The studio pulse</p>
                <h2 className="mt-2 font-serif text-4xl sm:text-5xl">What needs your attention</h2>
              </div>
              <Link href="/dashboard/processing" className="hidden text-sm text-[#6e6253] sm:block">
                View activity
              </Link>
            </div>
            <div className="grid divide-y divide-[#e1dcd4] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              <div className="py-7 lg:pr-8">
                <CircleAlert size={20} className="text-[#9d4848]" />
                <p className="mt-8 font-serif text-5xl">{overview.data?.failedJobs ?? 0}</p>
                <p className="mt-2 text-sm text-[#77746e]">failed jobs need review</p>
              </div>
              <div className="py-7 lg:px-8">
                <UploadCloud size={20} className="text-[#a58b68]" />
                <p className="mt-8 font-serif text-5xl">{overview.data?.awaitingProcessing ?? 0}</p>
                <p className="mt-2 text-sm text-[#77746e]">photographs waiting</p>
              </div>
              <div className="py-7 lg:pl-8">
                <CheckCircle2 size={20} className="text-[#53705a]" />
                <p className="mt-8 font-serif text-5xl">
                  {overview.data?.processedPhotos.toLocaleString() ?? 0}
                </p>
                <p className="mt-2 text-sm text-[#77746e]">photographs ready</p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between">
              <div>
                <p className="eyebrow">Recent work</p>
                <h2 className="mt-2 font-serif text-4xl sm:text-5xl">Collections in the studio</h2>
              </div>
              <Link href="/dashboard/events" className="text-sm text-[#6e6253]">
                See all events
              </Link>
            </div>
            <div className="mt-7 grid gap-5 md:grid-cols-3">
              {recent.data?.items.slice(0, 3).map((item, index) => (
                <Link
                  key={item.id}
                  href={`/dashboard/events/${item.id}`}
                  className={`group relative overflow-hidden bg-[#eeeae4] ${index === 0 ? 'aspect-[4/5] md:row-span-2' : 'aspect-[4/3]'}`}
                >
                  {item.coverUrl ? (
                    <img
                      src={item.coverUrl}
                      alt=""
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
                    />
                  ) : (
                    <Camera className="absolute left-1/2 top-1/2 -translate-x-1/2 text-[#aaa39a]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <p className="text-xs uppercase tracking-[.18em] text-white/65">
                      {item.status === 'EXPIRED' ? 'Completed' : item.status}
                    </p>
                    <h3 className="mt-2 font-serif text-3xl leading-none">{item.title}</h3>
                    <p className="mt-2 text-xs text-white/70">
                      {item.photoCount.toLocaleString()} photos · {item.processing.percent}% ready
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-8 border-y border-[#ded8cf] py-9 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [overview.data?.totalEvents ?? 0, 'events'],
              [overview.data?.activeEvents ?? 0, 'active now'],
              [formatBytes(overview.data?.storageBytes ?? 0), 'stored privately'],
              [overview.data?.guestSearches ?? 0, 'guest searches'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="font-serif text-4xl">{value}</p>
                <p className="mt-1 text-sm text-[#77746e]">{label}</p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
