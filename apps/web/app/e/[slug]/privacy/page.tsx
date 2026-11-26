'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { GuestShell } from '@/components/guest/guest-shell';
import { guestApi } from '@/lib/guest-api';
export default function PrivacyPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  const event = useQuery({ queryKey: ['guest-event', slug], queryFn: () => guestApi.event(slug) });
  async function withdraw() {
    if (!event.data) return;
    try {
      await guestApi.consent(slug, event.data.consentVersion, false);
      sessionStorage.removeItem(`memories-search:${slug}`);
      setMessage('Consent withdrawn. Your session and search access have been revoked.');
    } catch {
      setMessage('No active consented session was found, or it has already expired.');
    }
  }
  return (
    <GuestShell slug={slug}>
      <article className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8">
        <header className="grid gap-6 border-b border-[#ded8cf] pb-10 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="eyebrow">Privacy, in plain language</p>
            <h1 className="mt-4 font-serif text-6xl leading-[.85] sm:text-7xl">
              How your private search works.
            </h1>
          </div>
          <p className="max-w-xl self-end text-base leading-7 text-[#696660]">
            You decide whether to use face matching, and you can withdraw that permission at any
            time during an active session.
          </p>
        </header>
        <div className="mt-12 grid gap-9 leading-7 text-neutral-700 sm:grid-cols-2">
          <section>
            <h2 className="font-serif text-2xl text-neutral-900">What is processed</h2>
            <p className="mt-2">
              With your explicit consent, your selfie and facial features are processed to compare
              them only with indexed photographs from this event. Raw face embeddings are never sent
              to your browser.
            </p>
          </section>
          <section>
            <h2 className="font-serif text-2xl text-neutral-900">Retention and access</h2>
            <p className="mt-2">
              The selfie is not permanently stored by default. Search results and private guest
              sessions expire automatically. Event photographs remain controlled by the photography
              studio.
            </p>
          </section>
          <section>
            <h2 className="font-serif text-2xl text-neutral-900">Accuracy</h2>
            <p className="mt-2">
              Face matching can produce incomplete or incorrect results. The service uses a
              conservative event-specific threshold and never searches unrelated events or external
              identity databases.
            </p>
          </section>
          <section>
            <h2 className="font-serif text-2xl text-neutral-900">Contact</h2>
            <p className="mt-2">
              For privacy questions, contact the studio using the contact details supplied with your
              event invitation. No contact details are invented or published here.
            </p>
          </section>
        </div>
        <div className="mt-12 border-y border-red-200 bg-white py-7">
          <h2 className="font-medium">Withdraw biometric consent</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            This revokes the current session, expires its searches, and prevents further downloads.
            It does not delete event photographs.
          </p>
          <button
            onClick={() => void withdraw()}
            className="mt-4 min-h-12 rounded-full border border-red-300 px-5 text-sm text-red-800"
          >
            Withdraw consent and revoke access
          </button>
          {message && (
            <p role="status" className="mt-3 text-sm text-neutral-700">
              {message}
            </p>
          )}
        </div>
        <button onClick={() => router.back()} className="mt-8 text-sm underline">
          Go back
        </button>
      </article>
    </GuestShell>
  );
}
