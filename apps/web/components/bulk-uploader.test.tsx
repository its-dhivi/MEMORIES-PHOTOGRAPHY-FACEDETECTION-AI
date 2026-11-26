import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { BulkUploader } from './bulk-uploader';

it('shows a clear error for unsupported files before upload', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BulkUploader eventId="event-a" />
    </QueryClientProvider>,
  );
  const input = screen.getByLabelText('Choose photographs');
  fireEvent.change(input, {
    target: { files: [new File(['bad'], 'notes.txt', { type: 'text/plain' })] },
  });
  expect(
    screen.getByText('Unsupported file. Use JPEG, PNG, WebP, CR2, CR3, NEF, ARW, DNG, or RAF.'),
  ).toBeInTheDocument();
});

it('offers folder import and an ordinary file-selection fallback', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BulkUploader eventId="event-a" />
    </QueryClientProvider>,
  );
  expect(screen.getByRole('button', { name: /import sd card \/ folder/i })).toBeInTheDocument();
  expect(screen.getByText('Select files')).toBeInTheDocument();
  expect(screen.getByLabelText('Choose photographs')).toHaveAttribute(
    'accept',
    expect.stringContaining('.nef'),
  );
});
