'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { GuestShell } from '@/components/guest/guest-shell';
import { GuestApiError, guestApi } from '@/lib/guest-api';
const schema = z.object({ pin: z.string().min(1, 'Enter the event PIN').max(32) });
type Values = z.infer<typeof schema>;
export default function EventAccessPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { pin: '' } });
  const submit = form.handleSubmit(async ({ pin }) => {
    try {
      await guestApi.createSession(slug, pin);
      router.replace(`/e/${slug}/selfie`);
    } catch (error) {
      form.setError('pin', {
        message:
          error instanceof GuestApiError && error.status === 401
            ? 'That PIN is incorrect. Please try again.'
            : 'Event access is unavailable.',
      });
    }
  });
  return (
    <GuestShell slug={slug}>
      <section className="mx-auto grid min-h-[calc(100vh-72px)] max-w-5xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Private invitation</p>
          <h1 className="mt-4 font-serif text-6xl leading-[.85] sm:text-7xl">
            A small key to a private collection.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-neutral-600">
            The photographer provided this PIN with your invitation.
          </p>
        </div>
        <form onSubmit={submit} className="border-y border-[#ded8cf] bg-white px-5 py-9 sm:px-10">
          <label className="block text-sm font-medium" htmlFor="pin">
            Event PIN
          </label>
          <input
            id="pin"
            type="password"
            autoComplete="one-time-code"
            inputMode="numeric"
            {...form.register('pin')}
            className="mt-4 min-h-16 w-full border-0 border-b border-neutral-300 bg-white px-0 text-center text-2xl tracking-[.25em] focus:border-[#765f45] focus:outline-none"
          />
          {form.formState.errors.pin && (
            <p role="alert" className="text-sm text-red-700">
              {form.formState.errors.pin.message}
            </p>
          )}
          <button
            disabled={form.formState.isSubmitting}
            className="button-primary mt-6 min-h-14 w-full disabled:opacity-50"
          >
            {form.formState.isSubmitting ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </section>
    </GuestShell>
  );
}
