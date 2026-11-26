import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiFace {
  boundingBox: { x: number; y: number; width: number; height: number };
  detectionConfidence: number;
  qualityScore: number;
  qualityStatus: string;
  embedding: number[] | null;
}

export interface AiAnalysis {
  modelName: string;
  modelVersion: string;
  embeddingDimension: number;
  width: number;
  height: number;
  faces: AiFace[];
}

export interface AiReadiness {
  ready: boolean;
  modelVersion?: string | undefined;
  providers?: string[] | undefined;
}

@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  analyzePhoto(image: Uint8Array, mimeType: string, filename: string): Promise<AiAnalysis> {
    return this.request('/internal/v1/faces/analyze', image, mimeType, filename);
  }

  embedSelfie(image: Uint8Array, mimeType: string, filename: string): Promise<AiAnalysis> {
    return this.request('/internal/v1/faces/embed-selfie', image, mimeType, filename);
  }

  async readiness(): Promise<AiReadiness> {
    try {
      const response = await fetch(`${this.baseUrl()}/health/ready`, {
        signal: AbortSignal.timeout(this.timeoutMs()),
      });
      if (!response.ok) return { ready: false };
      const body = (await response.json()) as {
        ready?: boolean;
        model_version?: string;
        providers?: string[];
      };
      return {
        ready: body.ready === true,
        modelVersion: body.model_version,
        providers: body.providers,
      };
    } catch {
      return { ready: false };
    }
  }

  private async request(
    path: string,
    image: Uint8Array,
    mimeType: string,
    filename: string,
  ): Promise<AiAnalysis> {
    const form = new FormData();
    const owned = new Uint8Array(image).buffer;
    form.append('file', new Blob([owned], { type: mimeType }), filename);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}${path}`, {
        method: 'POST',
        headers: { 'X-Internal-Token': this.config.getOrThrow<string>('AI_INTERNAL_TOKEN') },
        body: form,
        signal: AbortSignal.timeout(this.timeoutMs()),
      });
    } catch {
      throw new ServiceUnavailableException('AI service is unavailable');
    }
    if (response.status === 422 || response.status === 413 || response.status === 415) {
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      throw new UnprocessableEntityException(
        body?.detail ?? 'Image is unsuitable for face processing',
      );
    }
    if (!response.ok)
      throw new ServiceUnavailableException('AI service could not process the image');
    const analysis = (await response.json()) as AiAnalysis;
    if (analysis.embeddingDimension !== 512 || !Array.isArray(analysis.faces)) {
      throw new ServiceUnavailableException('AI service returned an incompatible model response');
    }
    return analysis;
  }

  private baseUrl(): string {
    return this.config.getOrThrow<string>('AI_SERVICE_URL').replace(/\/$/, '');
  }

  private timeoutMs(): number {
    return this.config.get<number>('FACE_INFERENCE_TIMEOUT_SECONDS', 60) * 1000;
  }
}
