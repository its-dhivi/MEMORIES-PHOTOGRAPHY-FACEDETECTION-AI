'use client';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { dashboardApi } from '@/lib/api';

const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
export default function AnalyticsPage() {
  const analytics = useQuery({
    queryKey: ['dashboard', 'analytics'],
    queryFn: dashboardApi.analytics,
  });
  if (analytics.isLoading) return <div className="h-96 animate-pulse rounded-xl bg-stone-200" />;
  if (!analytics.data)
    return (
      <div className="rounded-xl bg-red-50 p-5 text-red-800">Analytics could not be loaded.</div>
    );
  const maxPhotos = Math.max(1, ...analytics.data.photosOverTime.map((item) => item.count));
  return (
    <div className="space-y-12">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">PostgreSQL aggregates</p>
        <h1 className="mt-2 font-serif text-6xl leading-none">Studio insights</h1>
        <p className="mt-2 text-sm text-slate-500">
          Tenant-scoped event, upload, storage, and processing metrics.
        </p>
      </div>
      <section className="border-y border-[#ded8cf] py-8">
        <h2 className="font-serif text-4xl">Photographs uploaded over time</h2>
        {analytics.data.photosOverTime.length ? (
          <div className="mt-8 flex h-52 items-end gap-2 overflow-x-auto border-b pb-1">
            {analytics.data.photosOverTime.map((item) => (
              <div
                key={item.date}
                className="group flex min-w-8 flex-1 flex-col items-center justify-end"
                title={`${new Date(item.date).toLocaleDateString()}: ${item.count} photos`}
              >
                <div
                  className="w-full max-w-12 bg-[#a58b68]"
                  style={{ height: `${Math.max(4, (item.count / maxPhotos) * 180)}px` }}
                />
                <span className="mt-2 hidden text-[9px] text-slate-400 xl:block">
                  {new Date(item.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-14 text-center text-sm text-slate-500">
            <BarChart3 className="mx-auto mb-3 text-stone-300" />
            Upload analytics will appear after photographs are added.
          </div>
        )}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden border-y border-[#ded8cf] bg-white">
          <div className="border-b p-5">
            <h3 className="font-serif text-2xl">Event statistics</h3>
          </div>
          <div className="divide-y">
            {analytics.data.events.map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 p-4 text-sm"
              >
                <div>
                  <p className="font-medium">{event.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(event.eventDate).toLocaleDateString()}
                  </p>
                </div>
                <span>{event.photoCount} photos</span>
                <span className="text-slate-500">{formatBytes(event.storageBytes)}</span>
              </div>
            ))}
            {!analytics.data.events.length && (
              <p className="p-10 text-center text-sm text-slate-500">No event analytics yet.</p>
            )}
          </div>
        </div>
        <aside className="border-y border-[#ded8cf] bg-white p-6">
          <h3 className="font-serif text-2xl">Processing outcomes</h3>
          <div className="mt-5 space-y-3">
            {Object.entries(analytics.data.processing).map(([status, count]) => (
              <div
                key={status}
                className="flex justify-between rounded-lg bg-stone-50 px-3 py-2 text-sm"
              >
                <span>{status}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg border border-dashed p-4 text-sm text-slate-500">
            Guest-search analytics are empty until the Phase 4 guest workflow is enabled.
          </div>
        </aside>
      </section>
    </div>
  );
}
