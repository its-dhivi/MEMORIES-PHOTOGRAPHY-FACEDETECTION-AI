import { eventPublicUrl } from './qr.service';

describe('eventPublicUrl', () => {
  it('uses the configured public origin without duplicating slashes', () => {
    expect(eventPublicUrl('https://photos.memories.test/', 'arun-priya-wedding')).toBe(
      'https://photos.memories.test/e/arun-priya-wedding',
    );
  });
});
