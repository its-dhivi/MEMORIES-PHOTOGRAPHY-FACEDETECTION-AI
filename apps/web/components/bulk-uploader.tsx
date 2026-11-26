'use client';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  FileImage,
  FolderOpen,
  Pause,
  Play,
  RefreshCw,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { createSHA256 } from 'hash-wasm';
import { useEffect, useRef, useState } from 'react';
import { photosApi } from '@/lib/api';

type UploadState =
  | 'queued'
  | 'hashing'
  | 'uploading'
  | 'verifying'
  | 'complete'
  | 'duplicate'
  | 'failed'
  | 'paused'
  | 'cancelled';
interface UploadItem {
  id: string;
  file: File;
  state: UploadState;
  progress: number;
  error?: string | undefined;
  uploadSessionId?: string | undefined;
}
const rawTypes: Record<string, string> = {
  cr2: 'image/x-canon-cr2',
  cr3: 'image/x-canon-cr3',
  nef: 'image/x-nikon-nef',
  arw: 'image/x-sony-arw',
  dng: 'image/x-adobe-dng',
  raf: 'image/x-fuji-raf',
};
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', ...Object.values(rawTypes)]);
const maximumBytes = 524_288_000;

function uploadType(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return rawTypes[extension] ?? file.type;
}

async function sha256(file: File): Promise<string> {
  const hasher = await createSHA256();
  const chunkSize = 16 * 1024 * 1024;
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    hasher.update(new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer()));
  }
  return hasher.digest('hex');
}

async function checksumBase64(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function BulkUploader({ eventId }: { eventId: string }) {
  const client = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [running, setRunning] = useState(false);
  const requests = useRef(new Map<string, XMLHttpRequest>());
  const paused = useRef(new Set<string>());
  const directoryInput = useRef<HTMLInputElement>(null);
  useEffect(() => directoryInput.current?.setAttribute('webkitdirectory', ''), []);
  const update = (id: string, change: Partial<UploadItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
  const addFiles = (files: FileList | File[]) => {
    const next = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      state:
        allowed.has(uploadType(file)) && file.size <= maximumBytes
          ? ('queued' as const)
          : ('failed' as const),
      progress: 0,
      ...(!allowed.has(uploadType(file))
        ? { error: 'Unsupported file. Use JPEG, PNG, WebP, CR2, CR3, NEF, ARW, DNG, or RAF.' }
        : file.size > maximumBytes
          ? { error: 'File exceeds the 500 MiB limit' }
          : {}),
    }));
    setItems((current) => [...current, ...next]);
  };
  const chooseDirectory = async () => {
    const picker = (
      window as typeof window & {
        showDirectoryPicker?: () => Promise<{
          values: () => AsyncIterableIterator<unknown>;
        }>;
      }
    ).showDirectoryPicker;
    if (!picker) {
      directoryInput.current?.click();
      return;
    }
    const root = await picker();
    const files: File[] = [];
    const scan = async (directory: { values: () => AsyncIterableIterator<unknown> }) => {
      for await (const entry of directory.values()) {
        const item = entry as {
          kind: 'file' | 'directory';
          getFile?: () => Promise<File>;
          values?: () => AsyncIterableIterator<unknown>;
        };
        if (item.kind === 'file' && item.getFile) files.push(await item.getFile());
        else if (item.kind === 'directory' && item.values) await scan({ values: item.values });
        if (files.length % 100 === 0) await new Promise(requestAnimationFrame);
      }
    };
    await scan(root);
    addFiles(files);
  };
  const putPart = (
    item: UploadItem,
    url: string,
    headers: Record<string, string>,
    body: Blob,
    baseProgress: number,
  ) =>
    new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      requests.current.set(`${item.id}:${baseProgress}`, xhr);
      xhr.open('PUT', url);
      for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          update(item.id, {
            progress: Math.min(
              95,
              Math.round(((baseProgress + event.loaded) / item.file.size) * 95),
            ),
          });
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300)
          reject(new Error(`Storage upload failed (${xhr.status})`));
        else resolve(xhr.getResponseHeader('ETag') ?? '');
      };
      xhr.onerror = () => reject(new Error('Network error while uploading'));
      xhr.onabort = () => reject(new DOMException('Upload paused', 'AbortError'));
      xhr.send(body);
    });
  const uploadOne = async (item: UploadItem) => {
    try {
      update(item.id, { state: 'hashing', error: undefined, progress: 0 });
      const hash = await sha256(item.file);
      const authorization = await photosApi.initialize(eventId, {
        filename: item.file.name,
        mimeType: uploadType(item.file),
        byteSize: item.file.size,
        sha256: hash,
        idempotencyKey: item.id,
      });
      if (authorization.duplicate) {
        update(item.id, { state: 'duplicate', progress: 100 });
        return;
      }
      if (!authorization.uploadSessionId) throw new Error('Upload authorization is incomplete');
      update(item.id, { uploadSessionId: authorization.uploadSessionId });
      update(item.id, { state: 'uploading' });
      if (authorization.uploadMode === 'MULTIPART') {
        const partSize = authorization.partSize ?? 16 * 1024 * 1024;
        const existing = await photosApi.uploadState(eventId, authorization.uploadSessionId);
        const completed = new Map(existing.parts.map((part) => [part.partNumber, part]));
        const pending = Array.from(
          { length: Math.ceil(item.file.size / partSize) },
          (_, index) => index + 1,
        ).filter((partNumber) => !completed.has(partNumber));
        let cursor = 0;
        await Promise.all(
          Array.from({ length: Math.min(3, pending.length) }, async () => {
            while (cursor < pending.length) {
              if (paused.current.has(item.id))
                throw new DOMException('Upload paused', 'AbortError');
              const partNumber = pending[cursor++];
              if (!partNumber) continue;
              const start = (partNumber - 1) * partSize;
              const blob = item.file.slice(start, Math.min(item.file.size, start + partSize));
              const checksumSHA256 = await checksumBase64(blob);
              const signed = await photosApi.partUrl(eventId, {
                uploadSessionId: authorization.uploadSessionId,
                partNumber,
                checksumSHA256,
              });
              const etag = await putPart(item, signed.uploadUrl, signed.headers, blob, start);
              completed.set(partNumber, {
                partNumber,
                etag,
                size: blob.size,
                checksumSHA256,
              });
            }
          }),
        );
        update(item.id, { state: 'verifying', progress: 97 });
        await photosApi.complete(
          eventId,
          authorization.uploadSessionId,
          [...completed.values()]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map(({ partNumber, etag, checksumSHA256 }) => ({
              partNumber,
              etag,
              ...(checksumSHA256 ? { checksumSHA256 } : {}),
            })),
        );
      } else {
        if (!authorization.uploadUrl) throw new Error('Upload authorization is incomplete');
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          requests.current.set(item.id, xhr);
          xhr.open('PUT', authorization.uploadUrl as string);
          for (const [name, value] of Object.entries(authorization.headers ?? {}))
            xhr.setRequestHeader(name, value);
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable)
              update(item.id, { progress: Math.round((event.loaded / event.total) * 95) });
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Storage upload failed (${xhr.status})`));
          xhr.onerror = () => reject(new Error('Network error while uploading'));
          xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
          xhr.send(item.file);
        });
        update(item.id, { state: 'verifying', progress: 97 });
        await photosApi.complete(eventId, authorization.uploadSessionId);
      }
      requests.current.delete(item.id);
      update(item.id, { state: 'complete', progress: 100 });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['photos', eventId] }),
        client.invalidateQueries({ queryKey: ['event', eventId] }),
        client.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    } catch (error) {
      requests.current.delete(item.id);
      if (error instanceof DOMException && error.name === 'AbortError')
        update(item.id, { state: 'paused', error: 'Paused. Select resume when ready.' });
      else
        update(item.id, {
          state: 'failed',
          error: error instanceof Error ? error.message : 'Upload failed',
        });
    }
  };
  const start = async () => {
    if (running) return;
    setRunning(true);
    const queue = items.filter(
      (item) => item.state === 'queued' || item.state === 'failed' || item.state === 'cancelled',
    );
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(2, queue.length) }, async () => {
        while (cursor < queue.length) {
          const item = queue[cursor++];
          if (item) await uploadOne(item);
        }
      }),
    );
    setRunning(false);
  };
  const completed = items.filter(
    (item) => item.state === 'complete' || item.state === 'duplicate',
  ).length;
  const totalProgress = items.length
    ? Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length)
    : 0;
  return (
    <section className="grid overflow-hidden border border-[#ded8cf] bg-white lg:grid-cols-[1fr_.8fr]">
      <div className="p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Add to the collection</p>
            <h2 className="mt-2 font-serif text-4xl">Upload photographs</h2>
            <p className="mt-1 text-sm text-slate-500">
              Resumable private uploads up to 500 MiB. Two files and three parts upload
              concurrently.
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={start}
              disabled={running}
              className="button-primary disabled:opacity-50"
            >
              {running ? 'Uploading…' : 'Upload queue'}
            </button>
          )}
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => void chooseDirectory()} className="button-secondary">
            <FolderOpen size={18} /> Import SD card / folder
          </button>
          <label className="button-secondary cursor-pointer">
            <FileImage size={18} /> Select files
            <input
              className="sr-only"
              type="file"
              multiple
              onChange={(event) => event.target.files && addFiles(event.target.files)}
            />
          </label>
          <div className="border border-[#ded8cf] px-4 py-3 text-xs text-[#696660]">
            Connect the SD card, then choose its DCIM folder.
          </div>
          <input
            ref={directoryInput}
            className="sr-only"
            type="file"
            multiple
            onChange={(event) => event.target.files && addFiles(event.target.files)}
          />
        </div>
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
          className="mt-7 flex min-h-64 cursor-pointer flex-col items-center justify-center border border-dashed border-[#bfb6aa] bg-[#faf9f6] p-6 text-center transition hover:border-[#8b7356] hover:bg-[#f5f1eb]"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[#d8d1c8] bg-white">
            <UploadCloud className="text-[#8b7356]" size={25} />
          </span>
          <span className="mt-3 text-sm font-medium">Drop photographs here or choose files</span>
          <span className="mt-1 text-xs text-slate-500">
            JPEG, PNG, WebP and common camera RAW originals
          </span>
          <input
            aria-label="Choose photographs"
            className="sr-only"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,.cr2,.cr3,.nef,.arw,.dng,.raf"
            onChange={(event) => event.target.files && addFiles(event.target.files)}
          />
        </label>
      </div>
      <div className="border-t border-[#ded8cf] bg-[#f3f0eb] p-5 sm:p-8 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#8b7356]">
              Transfer queue
            </p>
            <p className="mt-2 text-sm text-[#77746e]">Upload and indexing are separate stages.</p>
          </div>
          {items.length > 0 && <span className="font-serif text-3xl">{totalProgress}%</span>}
        </div>
        {items.length > 0 ? (
          <>
            <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
              <span>
                {completed} of {items.length} completed
              </span>
              <span>{totalProgress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full bg-gold transition-[width]"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
            <div className="mt-5 max-h-[360px] space-y-2 overflow-auto">
              {items.slice(0, 250).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-[#d8d1c8] bg-white p-3"
                >
                  <FileImage className="h-5 w-5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <p className="truncate text-sm font-medium">{item.file.name}</p>
                      <span className="text-[10px] uppercase text-slate-500">{item.state}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`h-full ${item.state === 'failed' ? 'bg-red-500' : 'bg-gold'}`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    {item.error && <p className="mt-1 text-xs text-red-700">{item.error}</p>}
                  </div>
                  {item.state === 'uploading' ? (
                    <button
                      title="Pause upload"
                      onClick={() => {
                        paused.current.add(item.id);
                        for (const [key, request] of requests.current)
                          if (key.startsWith(item.id)) request.abort();
                      }}
                    >
                      <Pause size={18} />
                    </button>
                  ) : item.state === 'failed' ||
                    item.state === 'cancelled' ||
                    item.state === 'paused' ? (
                    <button
                      title="Resume upload"
                      onClick={() => {
                        paused.current.delete(item.id);
                        void uploadOne(item);
                      }}
                    >
                      {item.state === 'paused' ? <Play size={17} /> : <RefreshCw size={17} />}
                    </button>
                  ) : item.state === 'complete' || item.state === 'duplicate' ? (
                    <CheckCircle2 className="text-emerald-600" size={19} />
                  ) : null}
                  <button
                    title="Remove from list"
                    onClick={() => {
                      const current = items.find((entry) => entry.id === item.id);
                      if (current?.uploadSessionId && current.state !== 'complete')
                        void photosApi.cancelUpload(eventId, current.uploadSessionId);
                      setItems((current) => current.filter((entry) => entry.id !== item.id));
                    }}
                  >
                    <XCircle size={17} className="text-slate-400" />
                  </button>
                </div>
              ))}
              {items.length > 250 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Showing the first 250 of {items.length.toLocaleString()} files. All selected files
                  remain in the upload queue.
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex min-h-64 items-center justify-center text-center text-sm leading-6 text-[#8b867f]">
            Selected photographs will appear here with real transfer progress.
          </div>
        )}
      </div>
    </section>
  );
}
