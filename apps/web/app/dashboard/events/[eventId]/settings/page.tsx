'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { EventForm, type EventFormValues } from '@/components/event-form';
import { EventTabs } from '@/components/event-tabs';
import { eventsApi } from '@/lib/api';

export default function EventSettingsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const event = useQuery({ queryKey: ['event', eventId], queryFn: () => eventsApi.get(eventId) });
  const settings = useQuery({
    queryKey: ['event', eventId, 'settings'],
    queryFn: () => eventsApi.settings(eventId),
  });
  const [accessEnabled, setAccessEnabled] = useState<boolean>();
  const [downloadsEnabled, setDownloadsEnabled] = useState<boolean>();
  const [downloadAllEnabled, setDownloadAllEnabled] = useState<boolean>();
  const [faceMatchingEnabled, setFaceMatchingEnabled] = useState<boolean>();
  const [similarityThreshold, setSimilarityThreshold] = useState<number>();
  const [privateSelfie, setPrivateSelfie] = useState<File>();
  const [privateSearchConsent, setPrivateSearchConsent] = useState(false);
  const [privateResults, setPrivateResults] = useState<{
    threshold: number;
    results: Array<{
      photoId: string;
      filename: string;
      similarity: number;
      previewUrl: string | null;
    }>;
  }>();
  const [retentionDays, setRetentionDays] = useState<number>();
  const [accessPin, setAccessPin] = useState('');
  const [clearPin, setClearPin] = useState(false);
  const [status, setStatus] = useState<string>();
  const updateEvent = useMutation({
    mutationFn: (values: EventFormValues) =>
      eventsApi.update(eventId, {
        ...values,
        eventDate: new Date(values.eventDate).toISOString(),
        status: status ?? event.data?.status,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['event', eventId] }),
  });
  const updateSettings = useMutation({
    mutationFn: () =>
      eventsApi.updateSettings(eventId, {
        accessEnabled: accessEnabled ?? settings.data?.accessEnabled,
        downloadsEnabled: downloadsEnabled ?? settings.data?.downloadsEnabled,
        downloadAllEnabled: downloadAllEnabled ?? settings.data?.downloadAllEnabled,
        faceMatchingEnabled: faceMatchingEnabled ?? settings.data?.faceMatchingEnabled,
        similarityThreshold:
          similarityThreshold ?? Number(settings.data?.similarityThreshold ?? 0.64),
        retentionDays: retentionDays ?? settings.data?.retentionDays,
        ...(accessPin ? { accessPin } : {}),
        ...(clearPin ? { clearAccessPin: true } : {}),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['event', eventId, 'settings'] }),
  });
  const remove = useMutation({
    mutationFn: () => eventsApi.remove(eventId),
    onSuccess: () => router.replace('/dashboard/events'),
  });
  const privateSearch = useMutation({
    mutationFn: () => eventsApi.privateSearch(eventId, privateSelfie!),
    onSuccess: (response) => setPrivateResults(response),
  });
  if (event.isLoading || settings.isLoading)
    return <div className="h-96 animate-pulse rounded-xl bg-stone-200" />;
  if (!event.data)
    return <div className="rounded-xl bg-red-50 p-5 text-red-800">Event could not be loaded.</div>;
  const initial: EventFormValues = {
    title: event.data.title,
    type: event.data.type,
    description: event.data.description ?? '',
    eventDate: new Date(event.data.eventDate).toISOString().slice(0, 16),
    location: event.data.location ?? '',
    publicSlug: event.data.publicSlug,
  };
  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white">
        <div className="p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gold">{event.data.title}</p>
          <h2 className="mt-2 font-serif text-4xl">Event settings</h2>
        </div>
        <EventTabs eventId={eventId} />
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-white p-6">
          <h3 className="font-serif text-2xl">Event information</h3>
          <label className="mt-5 mb-5 block text-sm font-medium">
            Event status
            <select
              value={status ?? event.data.status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-2 h-11 w-full rounded-lg border bg-white px-3"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <EventForm
            initial={initial}
            submitLabel="Save event"
            submitting={updateEvent.isPending}
            error={updateEvent.error?.message}
            onSubmit={(values) => updateEvent.mutate(values)}
          />
        </section>
        <section className="space-y-6">
          <div className="rounded-xl border bg-white p-6">
            <h3 className="font-serif text-2xl">Face matching</h3>
            <p className="mt-2 text-sm text-slate-600">
              Owners and administrators can run private event-scoped selfie searches. Public guest
              matching additionally requires system-level model validation.
            </p>
            <label className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span>Enable Face Matching</span>
              <input
                type="checkbox"
                checked={faceMatchingEnabled ?? settings.data?.faceMatchingEnabled ?? false}
                onChange={(e) => setFaceMatchingEnabled(e.target.checked)}
                className="h-5 w-5 accent-charcoal"
              />
            </label>
            <label className="mt-4 block text-sm">
              Similarity threshold
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={similarityThreshold ?? Number(settings.data?.similarityThreshold ?? 0.64)}
                onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                className="mt-2 h-11 w-full rounded-lg border px-3"
              />
            </label>
            <h4 className="mt-6 border-t pt-5 text-lg font-medium">Private event search</h4>
            <p className="mt-1 text-sm text-slate-500">
              Upload a selfie you are authorized to use. It is processed in memory and not retained.
            </p>
            <input
              className="mt-3 block w-full text-sm"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                setPrivateSelfie(e.target.files?.[0]);
                setPrivateResults(undefined);
              }}
            />
            <label className="mt-3 flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={privateSearchConsent}
                onChange={(e) => setPrivateSearchConsent(e.target.checked)}
              />
              I have permission to process this selfie for this event search.
            </label>
            <button
              className="mt-4 rounded bg-charcoal px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={!privateSelfie || !privateSearchConsent || privateSearch.isPending}
              onClick={() => privateSearch.mutate()}
            >
              {privateSearch.isPending ? 'Searching…' : 'Search event photos privately'}
            </button>
            {privateSearch.error && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {privateSearch.error.message}
              </p>
            )}
            {privateResults && (
              <div className="mt-4 space-y-3" aria-live="polite">
                <p className="text-sm">
                  {privateResults.results.length} matching photos at threshold{' '}
                  {privateResults.threshold.toFixed(2)}
                </p>
                {privateResults.results.map((result) => (
                  <div key={result.photoId} className="flex items-center gap-3 rounded border p-2">
                    {result.previewUrl && (
                      <img
                        src={result.previewUrl}
                        alt="Matching event photo"
                        className="h-16 w-20 rounded object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{result.filename}</span>
                    <span className="text-sm">{result.similarity.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border bg-white p-6">
            <h3 className="font-serif text-2xl">Guest access</h3>
            <p className="mt-1 text-sm text-slate-500">
              Access, search and download settings are enforced across guest-facing workflows.
            </p>
            <label className="mt-5 flex items-center justify-between gap-3 text-sm">
              <span>Enable public event access</span>
              <input
                type="checkbox"
                checked={accessEnabled ?? settings.data?.accessEnabled ?? false}
                onChange={(e) => setAccessEnabled(e.target.checked)}
                className="h-5 w-5 accent-charcoal"
              />
            </label>
            <label className="mt-5 block text-sm font-medium">
              Optional event PIN
              <input
                value={accessPin}
                onChange={(e) => setAccessPin(e.target.value)}
                type="password"
                minLength={4}
                placeholder={
                  settings.data?.accessPinConfigured
                    ? 'PIN is configured'
                    : 'Leave blank for no PIN'
                }
                className="mt-2 h-11 w-full rounded-lg border px-3"
              />
            </label>
            {settings.data?.accessPinConfigured && (
              <label className="mt-3 flex items-center gap-2 text-sm text-red-700">
                <input
                  type="checkbox"
                  checked={clearPin}
                  onChange={(e) => setClearPin(e.target.checked)}
                />
                Remove configured PIN
              </label>
            )}
            <div className="mt-6 space-y-3 border-t pt-5">
              <label className="flex items-center justify-between text-sm">
                <span>Allow individual downloads</span>
                <input
                  type="checkbox"
                  checked={downloadsEnabled ?? settings.data?.downloadsEnabled ?? true}
                  onChange={(e) => setDownloadsEnabled(e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between text-sm">
                <span>Allow download all</span>
                <input
                  type="checkbox"
                  checked={downloadAllEnabled ?? settings.data?.downloadAllEnabled ?? false}
                  onChange={(e) => setDownloadAllEnabled(e.target.checked)}
                />
              </label>
              <label className="block text-sm">
                Retention period (days)
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={retentionDays ?? settings.data?.retentionDays ?? 90}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="mt-2 h-11 w-full rounded-lg border px-3"
                />
              </label>
            </div>
            <button
              onClick={() => updateSettings.mutate()}
              disabled={updateSettings.isPending}
              className="mt-6 rounded-lg bg-charcoal px-4 py-2.5 text-sm text-white"
            >
              Save settings
            </button>
            {updateSettings.isSuccess && (
              <span className="ml-3 text-sm text-emerald-700">Saved</span>
            )}
          </div>
          <div className="rounded-xl border border-red-200 bg-white p-6">
            <h3 className="font-serif text-2xl text-red-800">Delete event</h3>
            <p className="mt-2 text-sm text-slate-600">
              Deletion is asynchronous and removes originals, derivatives, face records, and event
              data.
            </p>
            <button
              onClick={() => {
                if (window.confirm(`Permanently delete ${event.data.title}?`)) remove.mutate();
              }}
              className="mt-5 rounded-lg bg-red-700 px-4 py-2.5 text-sm text-white"
            >
              Delete event
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
