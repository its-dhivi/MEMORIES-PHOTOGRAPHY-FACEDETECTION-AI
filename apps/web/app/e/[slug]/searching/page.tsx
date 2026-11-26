'use client';
import { LoaderCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GuestShell } from '@/components/guest/guest-shell';
import { GuestApiError, guestApi } from '@/lib/guest-api';
import { takePendingSelfie } from '@/lib/pending-selfie';

function friendly(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/multiple/i.test(message)) return 'Please take a selfie with only your face visible.';
  if (/no face|usable face/i.test(message))
    return "We couldn't detect a face. Please try another selfie.";
  if (/blur/i.test(message)) return 'Your selfie is a little blurry. Try again in better lighting.';
  if (/TOO_DARK/i.test(message))
    return 'Your face is too dark. Face a window or move into even light, then try again.';
  if (/TOO_BRIGHT/i.test(message))
    return 'Your face is overexposed. Move out of direct light and try again.';
  if (/FACE_TOO_SMALL/i.test(message))
    return 'Your face is too small in the image. Move closer and keep your full face in view.';
  if (error instanceof GuestApiError && error.status === 401)
    return 'Your session expired. Please start again.';
  return 'Photo matching is unavailable right now. Please try again later.';
}
export default function SearchingPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const file = takePendingSelfie();
    if (!file) {
      queueMicrotask(() =>
        setError('Your selfie is no longer available. Please take another one.'),
      );
      return;
    }
    guestApi
      .search(slug, file)
      .then((result) => {
        sessionStorage.setItem(`memories-search:${slug}`, result.searchId);
        router.replace(`/e/${slug}/results`);
      })
      .catch((value) => setError(friendly(value)));
  }, [router, slug]);
  return (
    <GuestShell slug={slug}>
      <section className="mx-auto flex min-h-[72vh] max-w-2xl flex-col items-center justify-center px-5 text-center">
        {error ? (
          <>
            <h1 className="font-serif text-4xl">We couldn’t complete the search</h1>
            <p role="alert" className="mt-4 text-neutral-600">
              {error}
            </p>
            <button
              onClick={() => router.replace(`/e/${slug}/selfie`)}
              className="button-primary mt-7"
            >
              Try another selfie
            </button>
          </>
        ) : (
          <>
            <div className="relative h-48 w-64 overflow-hidden bg-[#e9e2d8]">
              <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-[#d5c2a9] via-[#eee8df] to-[#faf9f6] motion-reduce:animate-none" />
              <div className="absolute inset-x-0 bottom-0 h-px animate-pulse bg-[#8d7457] motion-reduce:animate-none" />
              <LoaderCircle
                className="absolute inset-0 m-auto animate-spin text-[#766149] motion-reduce:animate-none"
                size={28}
              />
            </div>
            <p className="eyebrow mt-9">Private event search</p>
            <h1 className="mt-4 font-serif text-5xl sm:text-6xl">Finding your photographs</h1>
            <p className="mt-3 text-neutral-600">
              We’re securely searching this event’s photographs for you.
            </p>
            <p className="mt-4 text-xs text-[#9a958e]">This usually takes only a moment.</p>
          </>
        )}
      </section>
    </GuestShell>
  );
}
