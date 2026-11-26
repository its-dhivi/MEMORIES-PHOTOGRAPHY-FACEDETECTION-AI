import { plainToInstance } from 'class-transformer';
import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateEventDto } from './events.dto';

describe('CreateEventDto', () => {
  it('rejects an empty event name and malformed slug', async () => {
    const input = plainToInstance(CreateEventDto, {
      title: '',
      type: 'WEDDING',
      eventDate: '2026-11-20T12:00:00.000Z',
      publicSlug: '../private',
    });
    const errors = await validate(input);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['title', 'publicSlug']),
    );
  });

  it('accepts a valid event contract', async () => {
    const input = plainToInstance(CreateEventDto, {
      title: 'Arun & Priya Wedding',
      type: 'WEDDING',
      eventDate: '2026-11-20T12:00:00.000Z',
      publicSlug: 'arun-priya-wedding',
    });
    await expect(validate(input)).resolves.toHaveLength(0);
  });
});
