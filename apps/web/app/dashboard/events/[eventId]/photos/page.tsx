'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, RefreshCw, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { BulkUploader } from '@/components/bulk-uploader';
import { eventsApi, photosApi } from '@/lib/api';

export default function EventPhotosPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const event = useQuery({ queryKey: ['event', eventId], queryFn: () => eventsApi.get(eventId) });
  const photos = useQuery({
    queryKey: ['photos', eventId, page, status],
    queryFn: () => photosApi.list(eventId, { page, pageSize: 40, status }),
  });
  const remove = useMutation({
    mutationFn: photosApi.remove,
    onSuccess: () => client.invalidateQueries({ queryKey: ['photos', eventId] }),
  });
  const retry = useMutation({
    mutationFn: photosApi.reprocess,
    onSuccess: () => client.invalidateQueries({ queryKey: ['photos', eventId] }),
  });
  const bulkDelete = async () => {
    if (!selected.size || !window.confirm(`Delete ${selected.size} selected photographs?`)) return;
    await Promise.all(Array.from(selected).map((id) => photosApi.remove(id)));
    setSelected(new Set());
    await client.invalidateQueries({ queryKey: ['photos', eventId] });
  };
  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-5 border-b border-[#ded8cf] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">
            {event.data?.title ?? 'Event'}
          </p>
          <h1 className="mt-2 font-serif text-6xl leading-none">The collection</h1>
          <p className="mt-3 text-sm text-[#77746e]">
            Upload, review, and curate private event photographs.
          </p>
        </div>
        <p className="text-sm text-[#77746e]">
          {photos.data?.total?.toLocaleString() ?? 0} photographs
        </p>
      </header>
      <div id="uploads">
        <BulkUploader eventId={eventId} />
      </div>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-4xl">Gallery</h2>
            <p className="text-sm text-slate-500">
              Private previews with short-lived authorization.
            </p>
          </div>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <button
                onClick={() => void bulkDelete()}
                className="rounded-lg bg-red-700 px-3 py-2 text-sm text-white"
              >
                Delete selected ({selected.size})
              </button>
            )}
            <select
              className="h-10 rounded-full border bg-white px-4 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="UPLOADED">Uploaded</option>
              <option value="QUEUED">Queued</option>
              <option value="PROCESSING">Processing</option>
              <option value="READY">Ready</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
        {photos.isLoading ? (
          <div className="mt-7 columns-2 gap-2 md:columns-3 xl:columns-5">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-stone-200" />
            ))}
          </div>
        ) : photos.data?.items.length ? (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {photos.data.items.map((photo) => (
              <article
                key={photo.id}
                className="group relative mb-2 break-inside-avoid overflow-hidden bg-stone-100"
              >
                <label className="absolute left-2 top-2 z-10 rounded bg-white/90 p-1">
                  <input
                    type="checkbox"
                    checked={selected.has(photo.id)}
                    onChange={(e) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (e.target.checked) next.add(photo.id);
                        else next.delete(photo.id);
                        return next;
                      })
                    }
                    aria-label={`Select ${photo.originalFilename}`}
                  />
                </label>
                <button
                  className="block w-full"
                  onClick={() => window.open(photo.previewUrl, '_blank', 'noopener')}
                >
                  <img
                    src={photo.thumbnailUrl ?? photo.previewUrl}
                    alt={photo.originalFilename}
                    loading="lazy"
                    className="h-auto w-full object-cover transition duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
                  />
                </button>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-2 pt-8 text-white">
                  <p className="truncate text-xs">{photo.originalFilename}</p>
                  <p className="text-[10px] text-white/70">
                    {photo.status} · {(photo.byteSize / 1024 / 1024).toFixed(1)} MB
                  </p>
                  {photo.faceCount !== null && (
                    <p className="text-[10px] text-white/70">
                      {photo.faceCount} faces · {photo.modelVersion ?? 'model unknown'} ·{' '}
                      {photo.processingDurationMs ?? 0} ms
                    </p>
                  )}
                </div>
                <div className="absolute right-2 top-2 flex gap-1 opacity-90 transition sm:opacity-0 sm:group-hover:opacity-100">
                  {photo.status === 'FAILED' && (
                    <button
                      onClick={() => retry.mutate(photo.id)}
                      title="Retry"
                      className="rounded bg-white p-1.5"
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this photograph?')) remove.mutate(photo.id);
                    }}
                    title="Delete"
                    className="rounded bg-white p-1.5 text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Camera className="mx-auto text-stone-300" size={40} />
            <p className="mt-4 text-sm text-slate-500">No photographs match this view.</p>
          </div>
        )}
        {photos.data && photos.data.totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-3">
            <button
              className="rounded border px-3 py-2 text-sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span className="py-2 text-sm">
              {page} / {photos.data.totalPages}
            </span>
            <button
              className="rounded border px-3 py-2 text-sm"
              disabled={page === photos.data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
