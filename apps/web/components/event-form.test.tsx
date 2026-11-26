import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';
import { EventForm } from './event-form';

it('validates required event fields and generates a readable slug', async () => {
  const submit = vi.fn();
  render(<EventForm submitting={false} onSubmit={submit} />);
  fireEvent.change(screen.getByLabelText('Event name'), {
    target: { value: 'Arun & Priya Wedding' },
  });
  expect(screen.getByLabelText('Public slug')).toHaveValue('arun-priya-wedding');
  fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
  await waitFor(() => expect(screen.getByText('Event date is required')).toBeInTheDocument());
  expect(submit).not.toHaveBeenCalled();
});
