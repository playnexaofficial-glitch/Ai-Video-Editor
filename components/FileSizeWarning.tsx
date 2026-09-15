'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { MediaItem, formatFileSize } from '@/lib/db';

interface FileSizeWarningProps {
  items: MediaItem[];
  thresholdMB?: number;
}

export function FileSizeWarning({ items, thresholdMB = 150 }: FileSizeWarningProps) {
  const thresholdBytes = thresholdMB * 1024 * 1024;
  const oversizedItems = items.filter((item) => item.size > thresholdBytes);

  if (oversizedItems.length === 0) {
    return null;
  }

  return (
    <div
      id="file-size-warning-banner"
      className="w-full rounded-xl bg-[#231A0F] border border-[#593E1A] p-3.5 mb-4 text-[#FBBF24]"
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-[#F59E0B] mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-amber-200">
            Large File Size Warning ({thresholdMB}MB Threshold)
          </p>
          <p className="text-amber-300/90 leading-relaxed">
            The following {oversizedItems.length === 1 ? 'file is' : 'files are'} larger than {thresholdMB}MB. Very large files may not work well or may experience high memory usage in this browser-based editor on mobile devices:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-200/90 font-mono text-[11px] pt-1">
            {oversizedItems.map((item) => (
              <li key={item.id} className="truncate">
                <span className="font-medium">{item.name}</span> ({formatFileSize(item.size)})
              </li>
            ))}
          </ul>
          <p className="text-amber-400/80 text-[11px] pt-1 italic">
            Note: Your upload is NOT blocked. You can still proceed, but performance might be affected during rendering.
          </p>
        </div>
      </div>
    </div>
  );
}
