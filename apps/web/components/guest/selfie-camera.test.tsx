import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SelfieCamera } from './selfie-camera';

describe('SelfieCamera', () => {
  it('shows an upload alternative when camera permission is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied')) },
    });
    render(<SelfieCamera onReady={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /open camera/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/permission was denied/i),
    );
    expect(screen.getByRole('button', { name: /upload/i })).toBeEnabled();
  });

  it('rejects unsupported uploads before submission', () => {
    render(<SelfieCamera onReady={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'selfie.gif', { type: 'image/gif' })] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/JPEG, PNG, or WebP/i);
  });
});
