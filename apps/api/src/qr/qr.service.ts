import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { EventsService } from '../events/events.service';

export function eventPublicUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/$/, '')}/e/${slug}`;
}

@Injectable()
export class QrService {
  constructor(
    private readonly events: EventsService,
    private readonly config: ConfigService,
  ) {}

  async generate(userId: string, eventId: string) {
    const event = await this.events.get(userId, eventId);
    const url = eventPublicUrl(this.config.getOrThrow<string>('PUBLIC_APP_URL'), event.publicSlug);
    const qr = await QRCode.toString(url, {
      type: 'svg',
      width: 1200,
      margin: 3,
      color: { dark: '#171717', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });
    const title = this.escapeXml(event.title);
    const brandedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1650" viewBox="0 0 1400 1650">
      <rect width="1400" height="1650" fill="#ffffff" rx="32"/>
      <svg x="100" y="70" width="1200" height="1200">${qr}</svg>
      <text x="700" y="1375" text-anchor="middle" font-family="Georgia,serif" font-size="58" fill="#171717">${title}</text>
      <text x="700" y="1465" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" letter-spacing="7" fill="#a98a4c">MEMORIES PHOTOGRAPHY</text>
      <text x="700" y="1540" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#475569">Scan to find your photographs</text>
    </svg>`;
    const png = await sharp(Buffer.from(brandedSvg)).png({ compressionLevel: 9 }).toBuffer();
    return {
      eventId,
      eventTitle: event.title,
      url,
      svg: brandedSvg,
      pngDataUrl: `data:image/png;base64,${png.toString('base64')}`,
    };
  }

  private escapeXml(value: string): string {
    return value.replace(/[<>&'"]/g, (character) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      };
      return entities[character] ?? character;
    });
  }
}
