'use client';
import { useQuery } from '@tanstack/react-query';
import {
  Camera,
  Check,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SelfieCamera } from '@/components/guest/selfie-camera';
import { guestApi, type SearchResults } from '@/lib/guest-api';

type Stage = 'welcome' | 'access' | 'consent' | 'selfie' | 'searching' | 'results' | 'error';
export default function BoothPage() {
  const { slug } = useParams<{ slug: string }>();
  const event = useQuery({
    queryKey: ['booth-event', slug],
    queryFn: () => guestApi.event(slug),
    retry: false,
  });
  const [stage, setStage] = useState<Stage>('welcome');
  const [pin, setPin] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<SearchResults>();
  const [error, setError] = useState<string>();
  const finish = useCallback(async () => {
    if (event.data) {
      await guestApi.consent(slug, event.data.consentVersion, false).catch(() => undefined);
    }
    setFile(null);
    setResults(undefined);
    setPin('');
    setAccepted(false);
    setError(undefined);
    setStage('welcome');
    window.history.replaceState(null, '', `/booth/${slug}`);
  }, [event.data, slug]);
  useEffect(() => {
    const onPageHide = () => {
      if (stage !== 'welcome') void finish();
    };
    const onBack = () => {
      if (stage !== 'welcome') void finish();
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('popstate', onBack);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('popstate', onBack);
    };
  }, [finish, stage]);
  async function start() {
    if (!event.data?.finderAvailable) return;
    setStage(event.data.pinRequired ? 'access' : 'consent');
    if (!event.data.pinRequired) {
      try {
        await guestApi.createSession(slug);
      } catch {
        setError('The kiosk could not create a private session.');
        setStage('error');
      }
    }
  }
  async function unlock() {
    try {
      await guestApi.createSession(slug, pin);
      setStage('consent');
    } catch {
      setError('The event PIN was not accepted.');
    }
  }
  async function grant() {
    if (!accepted || !event.data) return;
    try {
      await guestApi.consent(slug, event.data.consentVersion, true);
      setStage('selfie');
    } catch {
      setError('Consent could not be recorded. Start a fresh session.');
      setStage('error');
    }
  }
  async function search() {
    if (!file) return;
    setStage('searching');
    try {
      const found = await guestApi.search(slug, file);
      setResults(await guestApi.results(found.searchId));
      setFile(null);
      setStage('results');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Search failed');
      setStage('error');
    }
  }
  return (
    <main className="booth-shell flex min-h-screen flex-col bg-[#f5f1eb] text-[#252522]">
      <header className="flex h-20 items-center justify-between border-b border-[#ddd7ce] px-6 sm:px-10">
        <div>
          <p className="font-serif text-xl">Memories Photography</p>
          <p className="text-xs uppercase tracking-[.22em] text-[#a58b68]">Event photo booth</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#77746e]">
          <ShieldCheck size={16} />
          Private guest session
        </div>
      </header>
      <section className="flex flex-1 items-center justify-center p-5 sm:p-8">
        {stage === 'welcome' && (
          <div className="grid h-full min-h-[620px] w-full max-w-[1500px] overflow-hidden bg-white shadow-[0_30px_90px_rgba(52,43,33,.12)] lg:grid-cols-[1.15fr_.85fr]">
            <div className="relative min-h-[45vh] overflow-hidden bg-[#ded6cc]">
              {event.data?.coverUrl ? (
                <img
                  src={event.data.coverUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <Camera
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#9c9489]"
                  size={64}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <p className="absolute bottom-7 left-7 text-sm uppercase tracking-[.2em] text-white">
                {event.data?.title ?? 'Event photo experience'}
              </p>
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-14">
              <p className="eyebrow">Welcome to the celebration</p>
              <h1 className="mt-5 font-serif text-6xl font-medium leading-[.82] sm:text-8xl">
                Find your moments.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[#77746e]">
                One quick selfie reveals photographs of you from this event. Your private session
                clears when you finish.
              </p>
              <button
                disabled={!event.data?.finderAvailable}
                onClick={() => void start()}
                aria-label="Start photo search"
                className="button-primary mt-10 min-h-20 w-full px-10 text-lg disabled:opacity-40"
              >
                Begin
              </button>
              {event.data && !event.data.finderAvailable && (
                <p className="mt-5 text-sm text-[#9a6b2f]">{event.data.finderMessage}</p>
              )}
              <div className="mt-8 flex items-center gap-3 text-sm text-[#77746e]">
                <ShieldCheck size={18} />
                Private and reset after every guest
              </div>
            </div>
          </div>
        )}
        {stage === 'access' && (
          <div className="glass w-full max-w-xl rounded-[2rem] p-8 text-center sm:p-12">
            <LockKeyhole className="mx-auto text-[#d6b78a]" size={32} />
            <h1 className="mt-6 font-serif text-5xl">Enter event PIN</h1>
            <input
              aria-label="Event PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              type="password"
              inputMode="numeric"
              className="mt-8 h-16 w-full rounded-2xl border border-white/10 bg-white/[.05] px-5 text-center text-2xl tracking-[.3em]"
            />
            {error && (
              <p role="alert" className="mt-3 text-rose-300">
                {error}
              </p>
            )}
            <button onClick={() => void unlock()} className="button-primary mt-5 w-full min-h-14">
              Continue
            </button>
          </div>
        )}
        {stage === 'consent' && (
          <div className="glass w-full max-w-2xl rounded-[2rem] p-8 sm:p-12">
            <p className="eyebrow">Biometric consent</p>
            <h1 className="mt-4 font-serif text-5xl">Your privacy comes first.</h1>
            <p className="mt-5 text-base leading-7 text-white/52">
              Your selfie and facial features are processed only against this event. The selfie is
              not permanently stored by default, results expire, and matching can be incomplete or
              incorrect.
            </p>
            <label className="mt-8 flex cursor-pointer items-start gap-4 rounded-2xl border border-white/10 bg-white/[.04] p-5">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 h-6 w-6 accent-violet-500"
              />
              <span>I agree to biometric processing for this event photo search.</span>
            </label>
            <button
              disabled={!accepted}
              onClick={() => void grant()}
              className="button-primary mt-6 w-full min-h-14 disabled:opacity-40"
            >
              <Check size={19} />
              Agree and continue
            </button>
          </div>
        )}
        {stage === 'selfie' && (
          <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
            <div>
              <p className="eyebrow">Photo booth</p>
              <h1 className="mt-4 font-serif text-6xl">Look into the camera.</h1>
              <p className="mt-5 text-lg leading-8 text-white/50">
                Use even lighting, remove sunglasses, and keep only your face inside the positioning
                guide.
              </p>
              <button
                disabled={!file}
                onClick={() => void search()}
                className="button-primary mt-8 min-h-14 w-full disabled:opacity-40"
              >
                <Sparkles size={19} />
                Find my photos
              </button>
            </div>
            <SelfieCamera onReady={setFile} />
          </div>
        )}
        {stage === 'searching' && (
          <div className="text-center">
            <div className="relative mx-auto h-40 w-52 overflow-hidden bg-[#ded6cc]">
              <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-[#d9c9b3] to-[#f1ece5] motion-reduce:animate-none" />
              <LoaderCircle
                className="absolute inset-0 m-auto animate-spin text-[#7e6950] motion-reduce:animate-none"
                size={28}
              />
            </div>
            <h1 className="mt-8 font-serif text-6xl">Finding your photographs</h1>
            <p className="mt-4 text-lg text-[#77746e]">
              Searching this event for moments featuring you.
            </p>
          </div>
        )}
        {stage === 'results' && results && (
          <div className="w-full max-w-7xl">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Private results</p>
                <h1 className="mt-3 font-serif text-6xl">
                  {results.items.length} {results.items.length === 1 ? 'memory' : 'memories'} found.
                </h1>
              </div>
              <button onClick={() => void finish()} className="button-primary min-h-14 px-8">
                Finish and clear session
              </button>
            </div>
            <div className="mt-9 grid max-h-[62vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-5">
              {results.items.map((item) => (
                <img
                  key={item.photoId}
                  src={item.thumbnailUrl ?? item.previewUrl ?? ''}
                  alt={item.filename}
                  className="aspect-[4/5] w-full rounded-2xl object-cover"
                />
              ))}
            </div>
          </div>
        )}
        {stage === 'error' && (
          <div className="glass max-w-xl rounded-[2rem] p-10 text-center">
            <RotateCcw className="mx-auto text-rose-300" size={34} />
            <h1 className="mt-6 font-serif text-5xl">Let’s start fresh.</h1>
            <p role="alert" className="mt-4 text-white/55">
              {error}
            </p>
            <button onClick={() => void finish()} className="button-primary mt-7">
              Reset photo booth
            </button>
          </div>
        )}
      </section>
      <footer className="px-6 py-4 text-center text-xs text-[#918c85]">
        Each completed booth session is revoked before the next guest begins.
      </footer>
    </main>
  );
}
