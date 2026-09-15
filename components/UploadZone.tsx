'use client';

import React, { useRef, useState } from 'react';
import { Video, Image as ImageIcon, Music, Upload, Plus } from 'lucide-react';
import { MediaType } from '@/lib/db';

interface UploadZoneProps {
  type: MediaType;
  title: string;
  badge: string;
  badgeType?: 'required' | 'optional';
  accept: string;
  multiple?: boolean;
  hint: string;
  isProcessing?: boolean;
  onFilesSelected: (files: FileList | File[]) => void;
  count?: number;
}

export function UploadZone({
  type,
  title,
  badge,
  badgeType = 'optional',
  accept,
  multiple = true,
  hint,
  isProcessing = false,
  onFilesSelected,
  count = 0,
}: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = () => {
    if (fileInputRef.current && !isProcessing) {
      // Clear value so re-selecting same file triggers change
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'video':
        return <Video className="w-6 h-6 text-purple-400" />;
      case 'image':
        return <ImageIcon className="w-6 h-6 text-blue-400" />;
      case 'audio':
        return <Music className="w-6 h-6 text-emerald-400" />;
    }
  };

  return (
    <div className="w-full">
      {/* Zone Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-white">{title}</span>
          {count > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#7C3AED]/30 text-purple-300 font-mono">
              {count} {count === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded ${
            badgeType === 'required'
              ? 'bg-purple-900/60 text-purple-200 border border-purple-700/50'
              : 'bg-[#2D2D44] text-[#9CA3AF]'
          }`}
        >
          {badge}
        </span>
      </div>

      {/* Upload Drop Zone / Tap Target */}
      <div
        id={`upload-zone-${type}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        className={`w-full min-h-[96px] rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-150 ${
          isDragging
            ? 'border-[#7C3AED] bg-[#1A1A2E]'
            : 'border-[#2D2D44] bg-[#141424] hover:border-[#7C3AED]/70 hover:bg-[#1A1A2E]'
        } active:opacity-60`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={isProcessing}
          aria-label={`Upload ${title}`}
        />

        {isProcessing ? (
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <div className="w-4 h-4 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
            <span>Processing and storing {title.toLowerCase()}...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 pointer-events-none">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-[#1A1A2E] border border-[#2D2D44] flex items-center justify-center">
                {getIcon()}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <span>Tap to browse or drop {type}</span>
                  <Plus className="w-3.5 h-3.5 text-[#7C3AED]" />
                </div>
                <p className="text-[11px] text-[#9CA3AF]">{hint}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
