'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { photosApi } from '@/lib/api';

const explanations: Record<string, string> = {
  DERIVATIVE_MISSING: 'The AI image is missing, so this photograph has not been analyzed.',
  DETECTION_FAILURE: 'No face was detected in the AI image.',
  QUALITY_REJECTION: 'Faces were detected, but all failed a quality check.',
  INDEXING_FAILURE: 'A face was usable, but its embedding is not in the index.',
  NO_COMPATIBLE_EMBEDDING: 'No embedding matches this selfie model and preprocessing version.',
  SIMILARITY_REJECTION: 'The best face score is below the approved event threshold.',
  ACCEPTED: 'The expected photograph passes the event threshold.',
};

export default function FaceDiagnosticsPage() {
  const { eventId, photoId } = useParams<{ eventId: string; photoId: string }>();
  const [selfie, setSelfie] = useState<File | null>(null);
  const diagnostic = useQuery({
    queryKey: ['face-diagnostic', eventId, photoId],
    queryFn: () => photosApi.diagnostics(eventId, photoId),
  });
  const probe = useMutation({
    mutationFn: (file: File) => photosApi.probe(eventId, photoId, file),
  });
  const data = diagnostic.data;
  return (
    <main className="space-y-8">
      <Link href={`/dashboard/events/${eventId}/photos`} className="text-sm underline">
        Back to photographs
      </Link>
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Private diagnostic</p>
        <h1 className="mt-2 font-serif text-5xl">Face recognition review</h1>
        <p className="mt-2 text-sm text-stone-600">
          Inspect detection and indexing, then compare an authorized test selfie. Selfies are
          processed in memory and are not saved.
        </p>
      </header>
      {diagnostic.isLoading && <p>Analyzing the photograph…</p>}
      {diagnostic.isError && (
        <p role="alert" className="rounded bg-red-50 p-4 text-red-800">
          {diagnostic.error.message}
        </p>
      )}
      {data && (
        <>
          <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <div>
              <div className="relative inline-block max-w-full bg-stone-900">
                {data.previewUrl && (
                  <img
                    src={data.previewUrl}
                    alt={data.filename}
                    className="block max-h-[70vh] max-w-full"
                  />
                )}
                {data.observation &&
                  data.observation.faces.map((face, index) => (
                    <div
                      key={index}
                      className="absolute border-2 border-lime-300"
                      style={{
                        left: `${(face.boundingBox.x / data.observation!.width) * 100}%`,
                        top: `${(face.boundingBox.y / data.observation!.height) * 100}%`,
                        width: `${(face.boundingBox.width / data.observation!.width) * 100}%`,
                        height: `${(face.boundingBox.height / data.observation!.height) * 100}%`,
                      }}
                    >
                      <span className="bg-lime-300 px-1 text-xs text-black">{index + 1}</span>
                      {face.landmarks?.map(([x, y], point) => (
                        <span
                          key={point}
                          className="absolute h-1.5 w-1.5 rounded-full bg-cyan-300"
                          style={{
                            left: `${(((x ?? 0) - face.boundingBox.x) / face.boundingBox.width) * 100}%`,
                            top: `${(((y ?? 0) - face.boundingBox.y) / face.boundingBox.height) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                  ))}
              </div>
              <p className="mt-2 text-sm text-stone-600">{data.filename}</p>
              <a
                href={data.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline"
              >
                Open authorized original
              </a>
            </div>
            <div className="space-y-3 rounded border border-stone-200 bg-white p-5 text-sm">
              <h2 className="font-serif text-2xl">Index status</h2>
              <p>Photo: {data.status}</p>
              <p>Derivative: {data.derivativeStatus}</p>
              <p>Indexed faces: {data.indexedFaces.length}</p>
              <p>Model: {data.modelVersion ?? 'none'}</p>
              <p>Detection pipeline: {data.detectionVersion ?? 'legacy'}</p>
              {data.failureCode && <p>Failure: {data.failureCode}</p>}
              {data.reason && (
                <p className="rounded bg-amber-50 p-3 text-amber-900">
                  {explanations[data.reason] ?? data.reason}
                </p>
              )}
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="font-serif text-3xl">Detected faces</h2>
            {data.observation?.faces.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {data.observation.faces.map((face, index) => (
                  <article
                    key={index}
                    className="rounded border border-stone-200 bg-white p-4 text-sm"
                  >
                    {face.alignedPreview && (
                      <img
                        src={face.alignedPreview}
                        alt={`Aligned face ${index + 1}`}
                        width={112}
                        height={112}
                      />
                    )}
                    <h3 className="mt-2 font-semibold">Face {index + 1}</h3>
                    <p>Confidence: {face.detectionConfidence.toFixed(3)}</p>
                    <p>
                      Size: {face.boundingBox.width} × {face.boundingBox.height} px
                    </p>
                    <p>
                      Quality: {face.qualityStatus} ({face.qualityScore.toFixed(3)})
                    </p>
                    <p>Embedding: {face.embeddingStatus}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p>No faces detected in the AI image.</p>
            )}
          </section>
          <section className="max-w-xl space-y-3 rounded border border-stone-200 bg-white p-5">
            <h2 className="font-serif text-3xl">Expected match test</h2>
            <p className="text-sm text-stone-600">
              Use a consented reference selfie to see the exact score for this photograph.
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setSelfie(event.target.files?.[0] ?? null)}
            />
            <button
              className="button-primary"
              disabled={!selfie || probe.isPending}
              onClick={() => selfie && probe.mutate(selfie)}
            >
              Compare selfie
            </button>
            {probe.isError && (
              <p role="alert" className="text-red-700">
                {probe.error.message}
              </p>
            )}
            {probe.data && (
              <div className="space-y-1 text-sm">
                <p>Similarity: {probe.data.similarity?.toFixed(4) ?? 'no compatible embedding'}</p>
                <p>Approved threshold: {probe.data.threshold.toFixed(3)}</p>
                <p>Decision: {explanations[probe.data.reason] ?? probe.data.reason}</p>
                <p>Model: {probe.data.modelVersion}</p>
                <p>Recognition preprocessing: {probe.data.preprocessingVersion}</p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
