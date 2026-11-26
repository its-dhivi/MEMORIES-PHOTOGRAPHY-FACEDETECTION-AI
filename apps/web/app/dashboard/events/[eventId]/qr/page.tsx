'use client';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Download, Printer } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { EventTabs } from '@/components/event-tabs';
import { eventsApi } from '@/lib/api';

function download(data: string, filename: string): void {
  const link = document.createElement('a');
  link.href = data;
  link.download = filename;
  link.click();
}
export default function EventQrPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [copied, setCopied] = useState(false);
  const event = useQuery({ queryKey: ['event', eventId], queryFn: () => eventsApi.get(eventId) });
  const qr = useQuery({ queryKey: ['event', eventId, 'qr'], queryFn: () => eventsApi.qr(eventId) });
  const svgData = qr.data
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.data.svg)}`
    : '';
  return (
    <div className="space-y-8">
      <section>
        <div className="border-b border-[#ded8cf] pb-7">
          <p className="text-xs uppercase tracking-[0.2em] text-gold">{event.data?.title}</p>
          <h1 className="mt-2 font-serif text-6xl">Share the collection</h1>
          <p className="mt-2 text-sm text-slate-500">
            The code always resolves from the configured public application URL.
          </p>
        </div>
        <EventTabs eventId={eventId} />
      </section>
      {qr.isLoading ? (
        <div className="h-[620px] animate-pulse rounded-xl bg-stone-200" />
      ) : qr.data ? (
        <section className="grid gap-10 lg:grid-cols-[minmax(320px,650px)_1fr] lg:items-center">
          <div className="overflow-hidden border border-[#d9d2c8] bg-[#f1ece4] p-5 text-[#252522] shadow-[0_30px_80px_rgba(52,43,33,.12)] sm:p-10">
            <div className="mb-7 text-center">
              <p className="font-serif text-4xl">Memories Photography</p>
              <p className="mt-2 text-xs uppercase tracking-[.24em] text-black/45">
                {qr.data.eventTitle}
              </p>
            </div>
            <img
              src={qr.data.pngDataUrl}
              alt={`QR code for ${qr.data.eventTitle}`}
              className="mx-auto w-full max-w-lg bg-white p-4"
            />
            <p className="mt-6 text-center text-sm text-black/55">
              Scan to privately find your event photographs
            </p>
          </div>
          <div>
            <p className="eyebrow">Invitation tools</p>
            <h2 className="mt-3 font-serif text-5xl">Ready for your guests.</h2>
            <p className="mt-6 break-all border-y border-[#ded8cf] py-4 text-sm text-[#6e6962]">
              {qr.data.url}
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(qr.data.url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="button-secondary"
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}Copy event URL
              </button>
              <button
                onClick={() =>
                  download(qr.data.pngDataUrl, `${event.data?.publicSlug ?? 'event'}-qr.png`)
                }
                className="button-secondary"
              >
                <Download size={17} />
                Download PNG
              </button>
              <button
                onClick={() => download(svgData, `${event.data?.publicSlug ?? 'event'}-qr.svg`)}
                className="button-secondary"
              >
                <Download size={17} />
                Download SVG
              </button>
              <button onClick={() => window.print()} className="button-primary">
                <Printer size={17} />
                Print layout
              </button>
            </div>
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              If the public slug or configured application URL changes, download a fresh QR code.
            </div>
          </div>
        </section>
      ) : (
        <div role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">
          {qr.error?.message}
        </div>
      )}
    </div>
  );
}
