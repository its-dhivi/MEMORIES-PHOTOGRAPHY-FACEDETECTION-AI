'use client';
import { useQuery } from '@tanstack/react-query';
import { Camera } from 'lucide-react';
import Link from 'next/link';
import { eventsApi } from '@/lib/api';
export default function PhotographsPage() {
  const events = useQuery({
    queryKey: ['events', 'photo-picker'],
    queryFn: () => eventsApi.list({ pageSize: 100, sort: 'desc' }),
  });
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-gold">Photograph library</p>
      <h2 className="mt-2 font-serif text-4xl">Choose an event</h2>
      <p className="mt-2 text-sm text-slate-500">
        Photographs remain partitioned by event to protect tenant and guest boundaries.
      </p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {events.data?.items.map((event) => (
          <Link
            key={event.id}
            href={`/dashboard/events/${event.id}/photos`}
            className="flex items-center gap-4 rounded-xl border bg-white p-4 hover:border-gold"
          >
            <div className="h-16 w-16 overflow-hidden rounded-lg bg-stone-100">
              {event.coverUrl ? (
                <img src={event.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera className="m-5 text-stone-300" />
              )}
            </div>
            <div>
              <p className="font-medium">{event.title}</p>
              <p className="text-sm text-slate-500">{event.photoCount} photographs</p>
            </div>
          </Link>
        ))}
      </div>
      {events.data && !events.data.items.length && (
        <div className="mt-8 rounded-xl border border-dashed bg-white p-12 text-center text-sm text-slate-500">
          Create an event before uploading photographs.
        </div>
      )}
    </div>
  );
}
