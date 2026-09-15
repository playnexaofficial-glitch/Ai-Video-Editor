'use client';

import React from 'react';
import { X, Play, Music, Film, FileImage, Clock, HardDrive } from 'lucide-react';
import { MediaItem, formatFileSize, formatDuration, MediaType } from '@/lib/db';

interface MediaPreviewListProps {
  items: MediaItem[];
  type: MediaType;
  onRemove: (id: string) => void;
}

export function MediaPreviewList({ items, type, onRemove }: MediaPreviewListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2" id={`preview-list-${type}`}>
      {items.map((item, index) => {
        const isOversized = item.size > 150 * 1024 * 1024;

        return (
          <div
            key={item.id}
            id={`media-item-${item.id}`}
            className="w-full bg-[#1A1A2E] border border-[#2D2D44] rounded-xl p-2.5 flex items-center justify-between gap-3"
          >
            {/* Left side: Thumbnail / Icon + Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Thumbnail Container */}
              <div className="relative w-14 h-14 rounded-lg bg-[#0D0D0D] border border-[#2D2D44] flex-shrink-0 overflow-hidden flex items-center justify-center">
                {type === 'video' && (
                  <>
                    {item.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailDataUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-purple-400">
                        <Film className="w-5 h-5" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                      <Play className="w-4 h-4 text-white/90 fill-white/80" />
                    </div>
                  </>
                )}

                {type === 'image' && (
                  <>
                    {item.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailDataUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileImage className="w-6 h-6 text-blue-400" />
                    )}
                  </>
                )}

                {type === 'audio' && (
                  <div className="w-full h-full bg-[#10221B] flex flex-col items-center justify-center text-emerald-400">
                    <Music className="w-6 h-6" />
                  </div>
                )}

                {/* Index tag */}
                <span className="absolute top-1 left-1 px-1 py-0.2 bg-black/70 text-[9px] font-mono text-white/90 rounded">
                  #{index + 1}
                </span>
              </div>

              {/* Text Info */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate" title={item.name}>
                  {item.name}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-[#9CA3AF]">
                  {/* File size badge */}
                  <span
                    className={`inline-flex items-center gap-1 font-mono px-1.5 py-0.5 rounded ${
                      isOversized
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-700/60'
                        : 'bg-[#0D0D0D] text-[#9CA3AF]'
                    }`}
                  >
                    <HardDrive className="w-3 h-3 flex-shrink-0" />
                    {formatFileSize(item.size)}
                  </span>

                  {/* Duration badge if available */}
                  {item.duration !== undefined && item.duration > 0 && (
                    <span className="inline-flex items-center gap-1 font-mono bg-[#0D0D0D] px-1.5 py-0.5 rounded text-purple-300">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      {formatDuration(item.duration)}
                    </span>
                  )}

                  {/* Dimensions if available */}
                  {item.width && item.height ? (
                    <span className="text-[10px] font-mono text-gray-500 hidden sm:inline">
                      {item.width}x{item.height}
                    </span>
                  ) : null}
                </div>

                {isOversized && (
                  <p className="text-[10px] text-amber-400 mt-0.5 truncate">
                    ⚠️ Large file (&gt;150MB)
                  </p>
                )}
              </div>
            </div>

            {/* Right side: Accessible Remove Button */}
            <button
              id={`remove-media-${item.id}`}
              type="button"
              onClick={() => onRemove(item.id)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-[#0D0D0D] border border-[#2D2D44] text-[#9CA3AF] hover:text-red-400 hover:border-red-900/50 active:opacity-60 transition-colors duration-150 flex-shrink-0"
              aria-label={`Remove ${item.name}`}
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
