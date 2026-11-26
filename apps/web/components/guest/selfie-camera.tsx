'use client';
import { Camera, RotateCcw, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function SelfieCamera({ onReady }: { onReady: (file: File | null) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const stop = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  useEffect(
    () => () => {
      stop();
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function openCamera() {
    setError(undefined);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable in this browser. Upload a selfie instead.');
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
    } catch {
      setError(
        'Camera permission was denied or the camera is unavailable. You can upload a selfie instead.',
      );
    }
  }
  function selectFile(file?: File) {
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      setError('Choose a JPEG, PNG, or WebP image smaller than 15 MB.');
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      if (image.naturalWidth < 320 || image.naturalHeight < 320) {
        URL.revokeObjectURL(url);
        setError('Choose an image at least 320 × 320 pixels.');
        return;
      }
      setPreview(url);
      stop();
      onReady(file);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setError('This image could not be decoded.');
    };
    image.src = url;
  }
  function capture() {
    if (!video.current?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext('2d')?.drawImage(video.current, 0, 0);
    canvas.toBlob(
      (blob) => blob && selectFile(new File([blob], 'selfie.jpg', { type: 'image/jpeg' })),
      'image/jpeg',
      0.9,
    );
  }
  function retake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(undefined);
    onReady(null);
    void openCamera();
  }
  return (
    <div className="space-y-4">
      <div className="relative aspect-[3/4] max-h-[66vh] overflow-hidden border border-[#ded8cf] bg-[#252522] shadow-[0_24px_70px_rgba(55,45,34,.14)]">
        {preview ? (
          <img src={preview} alt="Your selected selfie" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={video}
            muted
            playsInline
            className="h-full w-full scale-x-[-1] object-cover"
            aria-label="Front camera preview"
          />
        )}
        {!preview && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 aspect-[3/4] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[48%] border border-white/35 shadow-[0_0_0_999px_rgba(0,0,0,.18)]"
          >
            <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/45 px-3 py-1 text-xs text-white/70 backdrop-blur">
              Positioning guide — not face detection
            </span>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {!preview && (
          <button onClick={openCamera} className="button-primary">
            <Camera size={18} />
            Open camera
          </button>
        )}
        {!preview && (
          <button
            onClick={capture}
            className="min-h-12 rounded-full border border-[#d8d1c8] bg-white px-4 font-medium"
          >
            Capture selfie
          </button>
        )}
        {preview && (
          <button
            onClick={retake}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-neutral-300"
          >
            <RotateCcw size={18} />
            Retake
          </button>
        )}
        <button
          onClick={() => input.current?.click()}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#d8d1c8] bg-white"
        >
          <Upload size={18} />
          Upload portrait
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => selectFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
