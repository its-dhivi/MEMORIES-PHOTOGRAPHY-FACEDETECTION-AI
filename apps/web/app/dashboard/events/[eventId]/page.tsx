'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Camera,
  CheckCircle2,
  MapPin,
  QrCode,
  Settings,
  UploadCloud,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EventTabs } from '@/components/event-tabs';
import { eventsApi } from '@/lib/api';

export default function EventOverviewPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const client = useQueryClient();
  const event = useQuery({ queryKey: ['event', eventId], queryFn: () => eventsApi.get(eventId) });
  const changeStatus = useMutation({
    mutationFn: (status: string) => eventsApi.update(eventId, { status }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['event', eventId] }),
  });
  if (event.isLoading) return <div className="shimmer h-[75vh]" />;
  if (!event.data)
    return (
      <div role="alert" className="border-l-2 border-[#9d4848] bg-white p-6 text-[#7e3636]">
        {event.error?.message ?? 'Event could not be loaded.'}
      </div>
    );
  const item = event.data;
  const nextAction =
    item.photoCount === 0
      ? 'Upload the first photographs'
      : item.processing.percent < 100
        ? 'Review processing activity'
        : item.status !== 'ACTIVE'
          ? 'Activate guest access'
          : 'Share this collection';
  const nextHref =
    item.photoCount === 0
      ? `/dashboard/events/${eventId}/photos#uploads`
      : item.processing.percent < 100
        ? '/dashboard/processing'
        : item.status !== 'ACTIVE'
          ? `/dashboard/events/${eventId}/settings`
          : `/dashboard/events/${eventId}/qr`;

  return (
    <div className="space-y-10">
      <section className="grid overflow-hidden bg-[#252522] text-white lg:min-h-[620px] lg:grid-cols-[1.2fr_.8fr]">
        <div className="relative min-h-[420px] overflow-hidden">
          {item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#4c4842]">
              <Camera size={70} className="text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-7 sm:p-10">
            <p className="text-xs uppercase tracking-[.2em] text-[#e6d6bf]">
              {item.type} · {item.status === 'EXPIRED' ? 'Completed' : item.status}
            </p>
            <h1 className="mt-3 max-w-3xl font-serif text-6xl font-medium leading-[.82] sm:text-8xl">
              {item.title}
            </h1>
            <p className="mt-5 flex flex-wrap items-center gap-4 text-sm text-white/70">
              <span>
                {new Date(item.eventDate).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {item.location || 'Location not set'}
              </span>
            </p>
          </div>
        </div>
        <aside className="flex flex-col justify-between p-7 sm:p-10">
          <div>
            <p className="text-xs uppercase tracking-[.2em] text-white/45">Next best step</p>
            <h2 className="mt-4 font-serif text-4xl leading-none">{nextAction}</h2>
            <Link
              href={nextHref}
              className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-5 text-sm font-medium text-[#252522]"
            >
              Continue <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-3 gap-4 border-t border-white/15 pt-7">
            <div>
              <p className="font-serif text-4xl">{item.photoCount.toLocaleString()}</p>
              <p className="mt-1 text-xs text-white/50">photos</p>
            </div>
            <div>
              <p className="font-serif text-4xl">{item.processing.percent}%</p>
              <p className="mt-1 text-xs text-white/50">ready</p>
            </div>
            <div>
              <p className="font-serif text-4xl">{(item.storageBytes / 1024 ** 3).toFixed(1)}</p>
              <p className="mt-1 text-xs text-white/50">GB stored</p>
            </div>
          </div>
        </aside>
      </section>

      <EventTabs eventId={eventId} />

      <section className="grid gap-10 lg:grid-cols-[1fr_390px]">
        <div>
          <p className="eyebrow">Collection notes</p>
          <h2 className="mt-3 font-serif text-5xl">The story behind the event</h2>
          <p className="mt-6 max-w-3xl whitespace-pre-wrap text-base leading-8 text-[#77746e]">
            {item.description || 'Add a short description to give this collection context.'}
          </p>
          <div className="mt-10 border-y border-[#ded8cf] py-6">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#8e887f]">
              Guest link
            </p>
            <a
              href={item.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-between gap-4 break-all font-serif text-2xl hover:text-[#7f694f]"
            >
              {item.publicUrl}
              <ArrowUpRight className="shrink-0" size={18} />
            </a>
          </div>
        </div>
        <aside>
          <p className="eyebrow">Collection workflow</p>
          <div className="mt-4 divide-y divide-[#ded8cf] border-y border-[#ded8cf]">
            <Link
              href={`/dashboard/events/${eventId}/photos#uploads`}
              className="flex min-h-16 items-center justify-between py-3 text-sm"
            >
              <span className="flex items-center gap-3">
                <UploadCloud size={18} />
                Add photographs
              </span>
              <ArrowUpRight size={17} />
            </Link>
            <Link
              href={`/dashboard/events/${eventId}/photos`}
              className="flex min-h-16 items-center justify-between py-3 text-sm"
            >
              <span className="flex items-center gap-3">
                <Camera size={18} />
                Curate collection
              </span>
              <ArrowUpRight size={17} />
            </Link>
            <Link
              href={`/dashboard/events/${eventId}/qr`}
              className="flex min-h-16 items-center justify-between py-3 text-sm"
            >
              <span className="flex items-center gap-3">
                <QrCode size={18} />
                Share invitation
              </span>
              <ArrowUpRight size={17} />
            </Link>
            <Link
              href={`/dashboard/events/${eventId}/settings`}
              className="flex min-h-16 items-center justify-between py-3 text-sm"
            >
              <span className="flex items-center gap-3">
                <Settings size={18} />
                Access & settings
              </span>
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="mt-7 flex items-center gap-3 text-sm text-[#77746e]">
            <CheckCircle2 size={18} className="text-[#53705a]" />
            {item.processing.ready.toLocaleString()} photographs ready
          </div>
          {item.status !== 'ACTIVE' && (
            <button
              className="button-primary mt-7 w-full"
              onClick={() => changeStatus.mutate('ACTIVE')}
            >
              Activate event
            </button>
          )}
          {item.status !== 'ARCHIVED' && (
            <button
              className="button-secondary mt-3 w-full"
              onClick={() => changeStatus.mutate('ARCHIVED')}
            >
              Archive event
            </button>
          )}
        </aside>
      </section>
    </div>
  );
}
