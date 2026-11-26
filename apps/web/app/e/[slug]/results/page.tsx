'use client';
import { useQuery } from '@tanstack/react-query';
import { Check, Download, Images, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GuestShell } from '@/components/guest/guest-shell';
import { PhotoViewer } from '@/components/guest/photo-viewer';
import { guestApi, type SearchResults } from '@/lib/guest-api';
type Item = SearchResults['items'][number];
export default function ResultsPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [searchId, setSearchId] = useState<string>();
  const [viewer, setViewer] = useState<number>();
  const [zipMessage, setZipMessage] = useState<string>();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    queueMicrotask(() =>
      setSearchId(sessionStorage.getItem(`memories-search:${slug}`) ?? undefined),
    );
  }, [slug]);
  const results = useQuery({
    queryKey: ['guest-results', searchId],
    queryFn: () => guestApi.results(searchId!),
    enabled: Boolean(searchId),
    retry: false,
  });
  async function download(item: Item) {
    if (!searchId) return;
    const response = await guestApi.download(item.photoId, searchId);
    window.location.assign(response.url);
  }
  async function prepareDownload(photoIds?: string[]) {
    if (!searchId) return;
    setZipMessage('Preparing your ZIP…');
    try {
      const created = photoIds
        ? await guestApi.downloadSelected(searchId, photoIds)
        : await guestApi.downloadAll(searchId);
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const job = await guestApi.downloadJob(created.jobId);
        if (job.status === 'COMPLETED' && job.url) {
          setZipMessage(
            `Your archive is ready until ${new Date(job.expiresAt).toLocaleTimeString()}.`,
          );
          window.location.assign(job.url);
          return;
        }
        if (job.status === 'FAILED' || job.status === 'EXPIRED') throw new Error();
      }
      throw new Error();
    } catch {
      setZipMessage('The ZIP could not be prepared. Please download photos individually.');
    }
  }
  if (!searchId)
    return (
      <GuestShell slug={slug}>
        <section className="mx-auto max-w-md px-5 py-20 text-center">
          <h1 className="font-serif text-4xl">Search not found</h1>
          <p className="mt-3 text-neutral-600">Your private search may have expired.</p>
          <button
            onClick={() => router.replace(`/e/${slug}`)}
            className="mt-6 rounded-xl bg-[#171717] px-6 py-3 text-white"
          >
            Start again
          </button>
        </section>
      </GuestShell>
    );
  if (results.isLoading)
    return (
      <GuestShell slug={slug}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-5 py-16 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-neutral-200" />
          ))}
        </div>
      </GuestShell>
    );
  if (!results.data)
    return (
      <GuestShell slug={slug}>
        <section className="mx-auto max-w-md px-5 py-20 text-center">
          <h1 className="font-serif text-4xl">Results unavailable</h1>
          <p className="mt-3 text-neutral-600">
            Your session or results have expired. Start a new private search.
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem(`memories-search:${slug}`);
              router.replace(`/e/${slug}`);
            }}
            className="mt-6 rounded-xl bg-[#171717] px-6 py-3 text-white"
          >
            Start again
          </button>
        </section>
      </GuestShell>
    );
  const data = results.data;
  if (!data.items.length)
    return (
      <GuestShell slug={slug}>
        <section className="mx-auto max-w-lg px-5 py-20 text-center">
          <Images className="mx-auto text-[#B89B72]" size={46} />
          <h1 className="mt-5 font-serif text-4xl">No matching photos found yet</h1>
          <p className="mt-3 text-neutral-600">
            We couldn’t find a confident match in this event. Try another clear selfie or check back
            after more photographs are uploaded.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => router.push(`/e/${slug}/selfie`)}
              className="rounded-xl bg-[#171717] px-6 py-3 text-white"
            >
              Try another selfie
            </button>
            <button
              onClick={() => router.push(`/e/${slug}`)}
              className="rounded-xl border border-neutral-300 px-6 py-3"
            >
              Return to event
            </button>
          </div>
        </section>
      </GuestShell>
    );
  return (
    <GuestShell slug={slug}>
      <section className="mx-auto max-w-[1500px] px-5 pb-20 pt-8 sm:px-10 lg:px-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[.25em] text-[#B89B72]">
              Your private gallery
            </p>
            <h1 className="mt-3 max-w-4xl font-serif text-5xl leading-[.9] sm:text-7xl">
              Your moments, found.
            </h1>
            <p className="mt-5 text-base text-[#4b4843]">
              {data.items.length} matching {data.items.length === 1 ? 'photograph' : 'photographs'}
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Available until {new Date(data.expiresAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/e/${slug}/selfie`)}
              className="button-secondary px-4 py-3 text-sm"
            >
              Try another selfie
            </button>
            {data.downloadAllEnabled && !selecting && (
              <button
                onClick={() => setSelecting(true)}
                className="button-primary flex items-center gap-2 px-4 py-3 text-sm"
              >
                <Check size={17} />
                Select photos
              </button>
            )}
          </div>
        </div>
        {zipMessage && (
          <p role="status" className="mt-4 rounded-xl bg-white p-3 text-sm">
            {zipMessage}
          </p>
        )}
        <motion.div
          className="mt-12 columns-2 gap-2 sm:columns-3 lg:columns-4 xl:columns-5"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.045 } } }}
        >
          {data.items.map((item, index) => (
            <motion.button
              key={item.photoId}
              variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
              aria-pressed={selecting ? selected.has(item.photoId) : undefined}
              aria-label={
                selecting
                  ? `${selected.has(item.photoId) ? 'Deselect' : 'Select'} ${item.filename}`
                  : `Open ${item.filename}`
              }
              onClick={() => {
                if (!selecting) return setViewer(index);
                setSelected((current) => {
                  const next = new Set(current);
                  if (next.has(item.photoId)) next.delete(item.photoId);
                  else next.add(item.photoId);
                  return next;
                });
              }}
              className="group relative mb-2 block w-full break-inside-avoid overflow-hidden bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#B89B72]"
            >
              <img
                src={item.thumbnailUrl ?? item.previewUrl ?? ''}
                alt={item.filename}
                loading="lazy"
                className={`h-auto w-full object-cover transition-transform group-hover:scale-[1.015] motion-reduce:transition-none ${index % 3 === 0 ? 'aspect-[4/5]' : 'aspect-[3/4]'}`}
              />
              {selecting && (
                <span
                  className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    selected.has(item.photoId)
                      ? 'border-white bg-[#252522] text-white'
                      : 'border-white bg-black/25 text-transparent'
                  }`}
                >
                  <Check size={16} />
                </span>
              )}
            </motion.button>
          ))}
        </motion.div>
        {viewer !== undefined && (
          <PhotoViewer
            items={data.items}
            index={viewer}
            onIndex={setViewer}
            onClose={() => setViewer(undefined)}
            onDownload={(item) => void download(item)}
          />
        )}
        {selecting && (
          <div className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl bg-[#252522] px-4 py-3 text-white shadow-2xl sm:bottom-8">
            <div>
              <p className="font-medium">{selected.size} photos selected</p>
              <div className="mt-1 flex gap-3 text-xs text-white/70">
                <button
                  onClick={() => setSelected(new Set(data.items.map((item) => item.photoId)))}
                >
                  Select all matches
                </button>
                <button onClick={() => setSelected(new Set())}>Deselect all</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Cancel selection"
                onClick={() => {
                  setSelecting(false);
                  setSelected(new Set());
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"
              >
                <X size={18} />
              </button>
              <button
                disabled={!selected.size}
                onClick={() => void prepareDownload([...selected])}
                className="flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#252522] disabled:opacity-40"
              >
                <Download size={17} /> Download {selected.size || ''}
              </button>
            </div>
          </div>
        )}
      </section>
    </GuestShell>
  );
}
