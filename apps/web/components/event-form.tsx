'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@memories/ui/button';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  title: z.string().trim().min(1, 'Event name is required').max(180),
  type: z.enum(['WEDDING', 'RECEPTION', 'BIRTHDAY', 'CORPORATE', 'OTHER']),
  description: z.string().max(5000).optional(),
  eventDate: z.string().min(1, 'Event date is required'),
  location: z.string().max(240).optional(),
  publicSlug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens'),
});
export type EventFormValues = z.infer<typeof schema>;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

export function EventForm({
  initial,
  submitting,
  error,
  submitLabel = 'Create event',
  onSubmit,
}: {
  initial?: Partial<EventFormValues>;
  submitting: boolean;
  error?: string | undefined;
  submitLabel?: string;
  onSubmit: (values: EventFormValues) => void;
}) {
  const form = useForm<EventFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      type: 'WEDDING',
      description: '',
      eventDate: '',
      location: '',
      publicSlug: '',
      ...initial,
    },
  });
  const slugDirty = form.formState.dirtyFields.publicSlug;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Event name
          <input
            {...form.register('title', {
              onChange: (event) => {
                if (!slugDirty)
                  form.setValue('publicSlug', slugify(event.target.value as string), {
                    shouldValidate: true,
                  });
              },
            })}
            className="mt-2 h-12 w-full rounded-none border-0 border-b border-[#d8d1c8] bg-transparent px-0 outline-none focus:border-[#8b7356]"
          />
          {form.formState.errors.title && (
            <span className="mt-1 block text-xs text-red-700">
              {form.formState.errors.title.message}
            </span>
          )}
        </label>
        <label className="text-sm font-medium">
          Event type
          <select
            {...form.register('type')}
            className="mt-2 h-12 w-full rounded-none border-0 border-b border-[#d8d1c8] bg-transparent px-0"
          >
            <option value="WEDDING">Wedding</option>
            <option value="RECEPTION">Reception</option>
            <option value="BIRTHDAY">Birthday</option>
            <option value="CORPORATE">Corporate</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Event date
          <input
            type="datetime-local"
            {...form.register('eventDate')}
            className="mt-2 h-12 w-full rounded-none border-0 border-b border-[#d8d1c8] bg-transparent px-0"
          />
          {form.formState.errors.eventDate && (
            <span className="mt-1 block text-xs text-red-700">
              {form.formState.errors.eventDate.message}
            </span>
          )}
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Location
          <input
            {...form.register('location')}
            className="mt-2 h-12 w-full rounded-none border-0 border-b border-[#d8d1c8] bg-transparent px-0"
          />
        </label>
        <div className="text-sm font-medium sm:col-span-2">
          <label htmlFor="event-public-slug">Public slug</label>
          <div className="mt-2 flex items-center border-b border-[#d8d1c8] bg-transparent px-0">
            <span className="text-sm text-slate-400">/e/</span>
            <input
              id="event-public-slug"
              {...form.register('publicSlug')}
              className="h-11 min-w-0 flex-1 px-1 outline-none"
            />
          </div>
          {form.formState.errors.publicSlug && (
            <span className="mt-1 block text-xs text-red-700">
              {form.formState.errors.publicSlug.message}
            </span>
          )}
        </div>
        <label className="text-sm font-medium sm:col-span-2">
          Description
          <textarea
            {...form.register('description')}
            rows={5}
            className="mt-2 w-full rounded-none border border-[#d8d1c8] bg-white p-4"
          />
        </label>
      </div>
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      <Button
        type="submit"
        disabled={submitting}
        className="min-h-12 rounded-full bg-[#252522] px-6 text-white hover:bg-[#4a443d]"
      >
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
