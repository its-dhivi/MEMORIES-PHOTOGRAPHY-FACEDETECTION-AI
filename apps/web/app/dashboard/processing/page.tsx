'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, Server } from 'lucide-react';
import { useState } from 'react';
import { processingApi } from '@/lib/api';

export default function ProcessingPage() {
  const client = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const stats = useQuery({
    queryKey: ['processing', 'stats'],
    queryFn: processingApi.stats,
    refetchInterval: 15_000,
  });
  const jobs = useQuery({
    queryKey: ['processing', 'jobs', status, page],
    queryFn: () => processingApi.jobs({ status, page, pageSize: 30 }),
    refetchInterval: 15_000,
  });
  const retry = useMutation({
    mutationFn: processingApi.retry,
    onSuccess: () => client.invalidateQueries({ queryKey: ['processing'] }),
  });
  const cards = [
    { label: 'Queued', value: stats.data?.counts.PENDING ?? 0, icon: Clock3 },
    { label: 'Active', value: stats.data?.counts.ACTIVE ?? 0, icon: Activity },
    { label: 'Completed', value: stats.data?.counts.COMPLETED ?? 0, icon: CheckCircle2 },
    {
      label: 'Failed',
      value: (stats.data?.counts.FAILED ?? 0) + (stats.data?.counts.DEAD_LETTER ?? 0),
      icon: AlertTriangle,
    },
    { label: 'Retry attempts', value: stats.data?.retryAttempts ?? 0, icon: RefreshCw },
  ];
  return (
    <div className="space-y-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">Background work</p>
          <h1 className="mt-2 font-serif text-6xl leading-none">Processing activity</h1>
          <p className="mt-2 text-sm text-slate-500">
            Updates every 15 seconds. AI success is never inferred without a worker result.
          </p>
        </div>
        <button
          onClick={() => client.invalidateQueries({ queryKey: ['processing'] })}
          className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      <section className="grid border-y border-[#ded8cf] sm:grid-cols-5 sm:divide-x sm:divide-[#ded8cf]">
        {cards.map(({ label, value, icon: Icon }) => (
          <article
            key={label}
            className="border-b border-[#ded8cf] py-6 sm:border-b-0 sm:px-6 first:pl-0 last:pr-0"
          >
            <Icon className="text-gold" size={18} />
            <p className="mt-5 font-serif text-4xl">{value}</p>
            <p className="text-sm text-slate-500">{label}</p>
          </article>
        ))}
      </section>
      <div className="grid gap-px overflow-hidden border border-[#ded8cf] bg-[#ded8cf] sm:grid-cols-3 xl:grid-cols-6">
        {[
          ['Total photos', stats.data?.photos.total ?? 0],
          ['Indexed', stats.data?.photos.indexed ?? 0],
          ['With faces', stats.data?.photos.withFaces ?? 0],
          ['No faces', stats.data?.photos.noFaces ?? 0],
          ['Index failures', stats.data?.photos.failed ?? 0],
          ['Average duration', `${stats.data?.photos.averageProcessingDurationMs ?? 0} ms`],
        ].map(([label, value]) => (
          <article key={label} className="bg-white p-4">
            <p className="text-xl font-semibold">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </article>
        ))}
      </div>
      <section
        className={`rounded-xl border p-5 ${stats.data?.workers.aiAvailable ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
      >
        <div className="flex items-center gap-3">
          <Server size={20} />
          <div>
            <p className="font-medium">
              {stats.data?.workers.aiAvailable
                ? 'AI recognition model configured.'
                : 'AI recognition model not configured.'}
            </p>
            <p className="text-sm opacity-75">
              Thumbnail workers: {stats.data?.workers.thumbnail ?? 0} · AI workers:{' '}
              {stats.data?.workers.ai ?? 0} · Deletion workers: {stats.data?.workers.deletion ?? 0}
              {stats.data?.model.modelVersion ? ` · Model: ${stats.data.model.modelVersion}` : ''}
            </p>
          </div>
        </div>
      </section>
      <section className="overflow-hidden border-y border-[#ded8cf] bg-white">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h3 className="font-serif text-2xl">Recent activity</h3>
            <p className="text-sm text-slate-500">Errors are sanitized before display.</p>
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="DEAD_LETTER">Dead letter</option>
          </select>
        </div>
        {jobs.isLoading ? (
          <div className="h-64 animate-pulse bg-stone-100" />
        ) : jobs.data?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-4">Event / photograph</th>
                  <th className="p-4">Job</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Attempts</th>
                  <th className="p-4">Error</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.data.items.map((job) => (
                  <tr key={job.id}>
                    <td className="p-4">
                      <p className="font-medium">{job.event.title}</p>
                      <p className="text-xs text-slate-500">
                        {job.photo?.originalFilename ?? 'Event operation'}
                      </p>
                    </td>
                    <td className="p-4">{job.type}</td>
                    <td className="p-4">
                      <span className="rounded-full bg-stone-100 px-2 py-1 text-xs">
                        {job.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="max-w-xs p-4 text-xs text-red-700">{job.errorSummary ?? '—'}</td>
                    <td className="p-4">
                      {['FAILED', 'DEAD_LETTER', 'RETRYING'].includes(job.status) && (
                        <button
                          onClick={() => retry.mutate(job.id)}
                          className="rounded border px-3 py-1.5 text-xs"
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-sm text-slate-500">
            No processing jobs match this filter.
          </div>
        )}
      </section>
    </div>
  );
}
