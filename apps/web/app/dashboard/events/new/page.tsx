'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EventForm, type EventFormValues } from '@/components/event-form';
import { eventsApi } from '@/lib/api';

export default function NewEventPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: (values: EventFormValues) =>
      eventsApi.create({ ...values, eventDate: new Date(values.eventDate).toISOString() }),
    onSuccess: async (event) => {
      await queryClient.invalidateQueries({ queryKey: ['events'] });
      router.push(`/dashboard/events/${event.id}`);
    },
  });
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/events" className="text-sm text-[#77746e]">
        ← Back to events
      </Link>
      <div className="mt-9 grid gap-10 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow">New collection</p>
          <h1 className="mt-4 font-serif text-5xl font-medium leading-[.9]">
            Give the event its identity.
          </h1>
          <p className="mt-5 text-sm leading-6 text-[#77746e]">
            Begin with the essentials. Cover photography, privacy, and sharing can be refined in the
            event workspace.
          </p>
          <ol className="mt-9 space-y-1" aria-label="Event creation steps">
            {['Identity', 'Date & place', 'Cover & privacy', 'Review & publish'].map(
              (step, index) => (
                <li
                  key={step}
                  className={`flex items-center gap-3 border-l-2 px-4 py-3 text-sm ${index === 0 ? 'border-[#a58b68] bg-white text-[#252522]' : 'border-[#ded8cf] text-[#99938b]'}`}
                >
                  <span className="text-xs">0{index + 1}</span>
                  {step}
                </li>
              ),
            )}
          </ol>
        </aside>
        <section className="border-t border-[#ded8cf] pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <h2 className="font-serif text-4xl">Event details</h2>
          <p className="mb-8 mt-2 text-sm text-[#77746e]">
            Guest access remains private until you choose to activate it.
          </p>
          <EventForm
            submitting={create.isPending}
            error={create.error?.message}
            onSubmit={(values) => create.mutate(values)}
          />
        </section>
      </div>
    </div>
  );
}
