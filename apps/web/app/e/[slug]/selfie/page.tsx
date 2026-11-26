'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { GuestShell } from '@/components/guest/guest-shell';
import { SelfieCamera } from '@/components/guest/selfie-camera';
import { guestApi } from '@/lib/guest-api';
import { setPendingSelfie } from '@/lib/pending-selfie';
export default function SelfiePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const event = useQuery({ queryKey: ['guest-event', slug], queryFn: () => guestApi.event(slug) });
  const session = useQuery({
    queryKey: ['guest-session', slug],
    queryFn: () => guestApi.session(slug),
    retry: false,
  });
  async function grant() {
    if (!event.data || !accepted) return;
    setBusy(true);
    setError(undefined);
    try {
      await guestApi.consent(slug, event.data.consentVersion, true);
      setConsented(true);
    } catch {
      setError('Your session expired. Return to the event and start again.');
    } finally {
      setBusy(false);
    }
  }
  function continueSearch() {
    if (!file) return;
    setPendingSelfie(file);
    router.push(`/e/${slug}/searching`);
  }
  if (session.isError)
    return (
      <GuestShell slug={slug}>
        <section className="mx-auto max-w-md px-5 py-20 text-center">
          <h1 className="font-serif text-4xl">Session expired</h1>
          <p className="mt-3 text-neutral-600">Start again to create a private event session.</p>
          <button
            onClick={() => router.replace(`/e/${slug}`)}
            className="mt-6 min-h-12 rounded-xl bg-[#171717] px-6 text-white"
          >
            Return to event
          </button>
        </section>
      </GuestShell>
    );
  const hasConsent = consented || session.data?.consented;
  return (
    <GuestShell slug={slug}>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8">
        {!hasConsent ? (
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <p className="text-xs uppercase tracking-[.25em] text-[#B89B72]">Your privacy</p>
              <h1 className="mt-3 font-serif text-5xl leading-none sm:text-6xl">
                A private search, with your permission.
              </h1>
              <p className="mt-5 text-base leading-7 text-[#77746e]">
                You stay in control of how your selfie is used.
              </p>
            </div>
            <div className="border-t border-[#ded8cf] pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-2">
              <div className="mt-5 space-y-3 text-sm leading-6 text-neutral-600">
                <p>
                  Your selfie and facial features are processed only to find you in this event. The
                  selfie is not permanently stored by default, and results expire.
                </p>
                <p>
                  Face matching may be incorrect or incomplete. You can withdraw consent from the
                  privacy page.
                </p>
              </div>
              <label className="mt-7 flex items-start gap-3 border-y border-neutral-200 bg-white p-5">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-[#171717]"
                />
                <span className="text-sm">
                  I agree to the processing of my selfie and facial features to find photographs of
                  me in this event.
                </span>
              </label>
              {error && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                onClick={() => void grant()}
                disabled={!accepted || busy}
                className="button-primary mt-6 min-h-14 w-full disabled:opacity-40"
              >
                {busy ? 'Recording consent…' : 'I agree — continue'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
            <div>
              <p className="eyebrow">Your portrait</p>
              <h1 className="mt-4 font-serif text-5xl leading-none sm:text-6xl">
                Look into the camera.
              </h1>
              <p className="mt-5 text-base leading-7 text-neutral-600">
                Face a window or soft light, keep the camera steady at arm&apos;s length, and center
                one unobstructed face. Avoid strong backlight. You can upload a portrait instead.
              </p>
              <button
                onClick={continueSearch}
                disabled={!file}
                className="button-primary mt-7 min-h-14 w-full disabled:opacity-40"
              >
                Find my photos
              </button>
            </div>
            <div>
              <SelfieCamera onReady={setFile} />
            </div>
          </div>
        )}
      </section>
    </GuestShell>
  );
}
