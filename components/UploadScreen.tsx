'use client';

import React, { useState } from 'react';
import { ArrowRight, Video, Image as ImageIcon, Music, Check, HardDrive, Info } from 'lucide-react';
import {
  MediaItem,
  MediaType,
  saveMediaItem,
  deleteMediaItem,
  clearMediaItemsByType,
  generateVideoThumbnail,
  generateImageThumbnail,
  getAudioDuration,
  formatFileSize,
} from '@/lib/db';
import { UploadZone } from './UploadZone';
import { MediaPreviewList } from './MediaPreviewList';
import { FileSizeWarning } from './FileSizeWarning';

interface UploadScreenProps {
  items: MediaItem[];
  onItemsChange: (items: MediaItem[]) => void;
  onContinue: () => void;
  isLoading: boolean;
}

export function UploadScreen({
  items,
  onItemsChange,
  onContinue,
  isLoading,
}: UploadScreenProps) {
  const [processingType, setProcessingType] = useState<MediaType | null>(null);

  const videoItems = items.filter((i) => i.type === 'video');
  const imageItems = items.filter((i) => i.type === 'image');
  const audioItems = items.filter((i) => i.type === 'audio');

  const canContinue = videoItems.length >= 1;
  const totalSizeBytes = items.reduce((acc, curr) => acc + curr.size, 0);

  // Handle new file selections
  const handleFiles = async (files: FileList | File[], type: MediaType) => {
    if (!files || files.length === 0) return;
    setProcessingType(type);

    try {
      const fileArray = Array.from(files);
      const newMediaItems: MediaItem[] = [];

      // If audio, only one file is allowed for background music -> replace existing
      if (type === 'audio') {
        const audioFile = fileArray[0];
        const duration = await getAudioDuration(audioFile);
        const newItem: MediaItem = {
          id: `audio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: 'audio',
          name: audioFile.name,
          size: audioFile.size,
          mimeType: audioFile.type || 'audio/mpeg',
          blob: audioFile,
          createdAt: Date.now(),
          duration: duration || undefined,
        };

        // Clear existing audio from IndexedDB first
        await clearMediaItemsByType('audio');
        await saveMediaItem(newItem);

        // Update in-memory state
        const updated = items.filter((i) => i.type !== 'audio').concat(newItem);
        onItemsChange(updated);
        setProcessingType(null);
        return;
      }

      // For Video and Image
      for (const file of fileArray) {
        let thumbnail = '';
        let duration: number | undefined;
        let width: number | undefined;
        let height: number | undefined;

        if (type === 'video') {
          const videoMeta = await generateVideoThumbnail(file);
          thumbnail = videoMeta.thumbnail;
          duration = videoMeta.duration;
          width = videoMeta.width;
          height = videoMeta.height;
        } else if (type === 'image') {
          const imageMeta = await generateImageThumbnail(file);
          thumbnail = imageMeta.thumbnail;
          width = imageMeta.width;
          height = imageMeta.height;
        }

        const newItem: MediaItem = {
          id: `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          blob: file,
          createdAt: Date.now(),
          thumbnailDataUrl: thumbnail || undefined,
          duration: duration || undefined,
          width: width || undefined,
          height: height || undefined,
        };

        // Persist directly to browser IndexedDB
        await saveMediaItem(newItem);
        newMediaItems.push(newItem);
      }

      onItemsChange([...items, ...newMediaItems]);
    } catch (err) {
      console.error('Error processing media file for IndexedDB storage:', err);
    } finally {
      setProcessingType(null);
    }
  };

  // Remove single media item from IndexedDB and state
  const handleRemove = async (id: string) => {
    try {
      await deleteMediaItem(id);
      onItemsChange(items.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Error deleting media file from IndexedDB:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin mb-3" />
        <p className="text-sm text-[#9CA3AF]">Loading stored project media from IndexedDB...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 pb-24 space-y-5">
      {/* Screen Title & Guidance */}
      <div>
        <h1 id="upload-media-title" className="text-xl font-bold text-white tracking-tight">
          Upload Project Media
        </h1>
        <p className="text-xs text-[#9CA3AF] mt-0.5 leading-relaxed">
          Select video clips, optional photos, and music track. All media is stored locally in IndexedDB on this device.
        </p>
      </div>

      {/* File Size Warning Banner (if any file > 150MB) */}
      <FileSizeWarning items={items} thresholdMB={150} />

      {/* ZONE 1: VIDEO CLIPS (Required) */}
      <section
        id="section-video-upload"
        className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 shadow-sm"
      >
        <UploadZone
          type="video"
          title="1. Video Clips"
          badge="Required (1+)"
          badgeType="required"
          accept="video/mp4,video/quicktime,video/webm,video/*"
          multiple={true}
          hint="MP4, MOV, WebM • Multiple clips allowed"
          isProcessing={processingType === 'video'}
          onFilesSelected={(files) => handleFiles(files, 'video')}
          count={videoItems.length}
        />

        <MediaPreviewList
          items={videoItems}
          type="video"
          onRemove={handleRemove}
        />
      </section>

      {/* ZONE 2: IMAGES (Optional) */}
      <section
        id="section-image-upload"
        className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 shadow-sm"
      >
        <UploadZone
          type="image"
          title="2. Images & Photos"
          badge="Optional"
          badgeType="optional"
          accept="image/jpeg,image/png,image/webp,image/*"
          multiple={true}
          hint="JPG, PNG, WebP • Stills & overlays"
          isProcessing={processingType === 'image'}
          onFilesSelected={(files) => handleFiles(files, 'image')}
          count={imageItems.length}
        />

        <MediaPreviewList
          items={imageItems}
          type="image"
          onRemove={handleRemove}
        />
      </section>

      {/* ZONE 3: AUDIO / MUSIC (Optional 1 file) */}
      <section
        id="section-audio-upload"
        className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 shadow-sm"
      >
        <UploadZone
          type="audio"
          title="3. Background Audio / Music"
          badge="Optional (1 track)"
          badgeType="optional"
          accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/*"
          multiple={false}
          hint="MP3, WAV, M4A • 1 background music track"
          isProcessing={processingType === 'audio'}
          onFilesSelected={(files) => handleFiles(files, 'audio')}
          count={audioItems.length}
        />

        <MediaPreviewList
          items={audioItems}
          type="audio"
          onRemove={handleRemove}
        />
      </section>

      {/* Storage Summary Footer Card */}
      {items.length > 0 && (
        <div className="bg-[#141424] border border-[#2D2D44] rounded-xl p-3 flex items-center justify-between text-xs text-[#9CA3AF]">
          <div className="flex items-center gap-1.5 font-mono">
            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
            <span>IndexedDB Storage: {formatFileSize(totalSizeBytes)}</span>
          </div>
          <span className="font-mono text-[11px] text-gray-400">
            {videoItems.length}v · {imageItems.length}i · {audioItems.length}a
          </span>
        </div>
      )}

      {/* Sticky Bottom Action Bar with Continue Button */}
      <div
        id="upload-sticky-footer"
        className="fixed bottom-0 left-0 right-0 bg-[#1A1A2E] border-t border-[#2D2D44] p-3 z-20"
      >
        <div className="max-w-md mx-auto space-y-2">
          {!canContinue && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-400/90 font-medium">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Upload at least 1 video clip to enable Continue</span>
            </div>
          )}

          <button
            id="continue-to-describe-btn"
            type="button"
            disabled={!canContinue || processingType !== null}
            onClick={onContinue}
            className={`w-full min-h-[48px] px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity duration-150 ${
              canContinue && processingType === null
                ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white active:opacity-60 shadow-lg shadow-[#7C3AED]/20 cursor-pointer'
                : 'bg-[#2D2D44] text-gray-500 cursor-not-allowed opacity-70'
            }`}
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
