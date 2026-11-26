'use client';
import { ChevronLeft, ChevronRight, Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { SearchResults } from '@/lib/guest-api';
type Item = SearchResults['items'][number];
export function PhotoViewer({
  items,
  index,
  onIndex,
  onClose,
  onDownload,
}: {
  items: Item[];
  index: number;
  onIndex: (value: number) => void;
  onClose: () => void;
  onDownload: (item: Item) => void;
}) {
  const item = items[index];
  const dialog = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
      if (event.key === 'ArrowRight') onIndex(Math.min(items.length - 1, index + 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [index, items.length, onClose, onIndex]);
  useEffect(() => {
    queueMicrotask(() => setZoom(1));
  }, [index]);
  if (!item) return null;
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Photograph preview"
      ref={dialog}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex bg-black/95 text-white backdrop-blur-xl"
    >
      <button
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-3"
      >
        <X />
      </button>
      <button
        disabled={index === 0}
        onClick={() => onIndex(index - 1)}
        aria-label="Previous photograph"
        className="absolute left-3 top-1/2 z-10 rounded-full bg-black/40 p-3 disabled:opacity-20"
      >
        <ChevronLeft />
      </button>
      <motion.img
        src={item.previewUrl ?? item.thumbnailUrl ?? ''}
        alt={item.filename}
        animate={{ scale: zoom }}
        drag={zoom > 1}
        dragConstraints={{ left: -180, right: 180, top: -180, bottom: 180 }}
        className="m-auto max-h-screen max-w-full object-contain p-3 sm:p-12"
      />
      <button
        disabled={index === items.length - 1}
        onClick={() => onIndex(index + 1)}
        aria-label="Next photograph"
        className="absolute right-3 top-1/2 z-10 rounded-full bg-black/40 p-3 disabled:opacity-20"
      >
        <ChevronRight />
      </button>
      <div className="absolute bottom-5 right-5 flex gap-2">
        <button
          onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
          aria-label="Zoom out"
          className="rounded-full bg-white/10 p-3 disabled:opacity-30"
          disabled={zoom === 1}
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
          aria-label="Zoom in"
          className="rounded-full bg-white/10 p-3 disabled:opacity-30"
          disabled={zoom === 2.5}
        >
          <ZoomIn size={18} />
        </button>
      </div>
      <button
        onClick={() => onDownload(item)}
        className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black"
      >
        <Download size={18} />
        Download
      </button>
    </motion.div>
  );
}
