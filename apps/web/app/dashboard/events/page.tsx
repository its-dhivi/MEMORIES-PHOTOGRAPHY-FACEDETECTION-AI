'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Camera, Grid3X3, List, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { eventsApi } from '@/lib/api';

export default function EventsPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('desc');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [openMenu, setOpenMenu] = useState<string>();
  const events = useQuery({
    queryKey: ['events', { search, status, type, sort, page }],
    queryFn: () => eventsApi.list({ search, status, type, sort, page, pageSize: 12 }),
  });
  const archive = useMutation({
    mutationFn: (id: string) => eventsApi.update(id, { status: 'ARCHIVED' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['events'] }),
  });
  const remove = useMutation({
    mutationFn: eventsApi.remove,
    onSuccess: () => client.invalidateQueries({ queryKey: ['events'] }),
  });

  return (
    <div className="space-y-10">
      <header className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="eyebrow">Your archive of moments</p>
          <h1 className="mt-3 font-serif text-6xl font-medium leading-none sm:text-7xl">
            Event library
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#77746e]">
            Browse active collections, return to works in progress, or begin something new.
          </p>
        </div>
        <Link href="/dashboard/events/new" className="button-primary w-fit">
          <Plus size={17} /> Create an event
        </Link>
      </header>

      <section className="flex flex-col gap-4 border-y border-[#ded8cf] py-4 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute left-0 top-3 h-4 w-4 text-[#8b867f]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by event name or location"
            className="h-10 w-full border-0 border-b border-transparent bg-transparent pl-7 pr-3 text-sm outline-none focus:border-[#a58b68]"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-full px-4 text-sm"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <select
            aria-label="Event type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 rounded-full px-4 text-sm"
          >
            <option value="">All event types</option>
            <option value="WEDDING">Wedding</option>
            <option value="RECEPTION">Reception</option>
            <option value="BIRTHDAY">Birthday</option>
            <option value="CORPORATE">Corporate</option>
            <option value="OTHER">Other</option>
          </select>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-10 rounded-full px-4 text-sm"
          >
            <option value="desc">Newest date</option>
            <option value="asc">Oldest date</option>
          </select>
          <div className="flex justify-end gap-1 rounded-full border border-[#e3ded6] bg-white p-1">
            <button
              aria-label="Grid view"
              onClick={() => setView('grid')}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${view === 'grid' ? 'bg-[#252522] text-white' : 'text-[#77746e]'}`}
            >
              <Grid3X3 size={15} />
            </button>
            <button
              aria-label="List view"
              onClick={() => setView('list')}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${view === 'list' ? 'bg-[#252522] text-white' : 'text-[#77746e]'}`}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </section>

      {events.isError && (
        <div
          role="alert"
          className="border-l-2 border-[#9d4848] bg-white p-5 text-sm text-[#7e3636]"
        >
          {events.error.message}
        </div>
      )}
      {events.isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="shimmer aspect-[4/5]" />
          ))}
        </div>
      ) : events.data?.items.length ? (
        <div
          className={
            view === 'grid'
              ? 'grid gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3'
              : 'divide-y divide-[#ded8cf] border-y border-[#ded8cf]'
          }
        >
          {events.data.items.map((item, index) =>
            view === 'grid' ? (
              <article key={item.id} className="group relative">
                <Link href={`/dashboard/events/${item.id}`} className="block">
                  <div
                    className={`relative overflow-hidden bg-[#eeeae4] ${index % 3 === 0 ? 'aspect-[4/5]' : 'aspect-[5/6]'}`}
                  >
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt=""
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                      />
                    ) : (
                      <Camera
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 text-[#aaa39a]"
                        size={44}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    <span className="absolute left-5 top-5 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.13em]">
                      {item.status === 'EXPIRED' ? 'Completed' : item.status}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                      <p className="text-xs uppercase tracking-[.16em] text-white/65">
                        {new Date(item.eventDate).toLocaleDateString()} · {item.type}
                      </p>
                      <h2 className="mt-2 font-serif text-4xl leading-none">{item.title}</h2>
                      <div className="mt-5 flex justify-between text-xs text-white/75">
                        <span>{item.photoCount.toLocaleString()} photographs</span>
                        <span>{item.processing.percent}% ready</span>
                      </div>
                    </div>
                  </div>
                </Link>
                <button
                  aria-label={`More actions for ${item.title}`}
                  onClick={() => setOpenMenu(openMenu === item.id ? undefined : item.id)}
                  className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm"
                >
                  <MoreHorizontal size={18} />
                </button>
                {openMenu === item.id && (
                  <div className="absolute right-4 top-14 z-10 w-44 border border-[#e3ded6] bg-white p-2 shadow-xl">
                    <button
                      onClick={() => archive.mutate(item.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[#f3f0eb]"
                    >
                      <Archive size={15} /> Archive
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${item.title}? Photographs will be removed asynchronously.`,
                          )
                        )
                          remove.mutate(item.id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#9d4848] hover:bg-[#f7eeee]"
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                )}
              </article>
            ) : (
              <Link
                key={item.id}
                href={`/dashboard/events/${item.id}`}
                className="grid gap-4 py-5 hover:bg-white sm:grid-cols-[96px_1fr_auto] sm:items-center sm:px-3"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[#eeeae4]">
                  {item.coverUrl && (
                    <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div>
                  <h2 className="font-serif text-2xl">{item.title}</h2>
                  <p className="mt-1 text-sm text-[#77746e]">
                    {new Date(item.eventDate).toLocaleDateString()} ·{' '}
                    {item.location || 'Location not set'}
                  </p>
                </div>
                <div className="text-sm text-[#77746e] sm:text-right">
                  <p>{item.photoCount.toLocaleString()} photos</p>
                  <p>{item.processing.percent}% ready</p>
                </div>
              </Link>
            ),
          )}
        </div>
      ) : (
        <div className="border-y border-dashed border-[#cfc8be] py-20 text-center">
          <Camera className="mx-auto text-[#a58b68]" />
          <h2 className="mt-5 font-serif text-4xl">No collections found</h2>
          <p className="mt-2 text-sm text-[#77746e]">Adjust the filters or create a new event.</p>
        </div>
      )}

      {events.data && events.data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            disabled={page === 1}
            onClick={() => setPage((v) => v - 1)}
            className="button-secondary disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-[#77746e]">
            {page} / {events.data.totalPages}
          </span>
          <button
            disabled={page === events.data.totalPages}
            onClick={() => setPage((v) => v + 1)}
            className="button-secondary disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
