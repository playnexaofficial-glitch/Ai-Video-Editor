'use client';

import React from 'react';
import {
  Film,
  Sparkles,
  FolderUp,
  CheckCircle2,
  Shield,
  Zap,
  Smartphone,
  ArrowRight,
  Upload,
  MessageSquare,
  Cpu,
  Monitor,
} from 'lucide-react';
import { formatFileSize } from '@/lib/db';

interface HomeScreenProps {
  onStartNewProject: () => void;
  onResumeProject?: () => void;
  existingFilesCount: {
    videoCount: number;
    imageCount: number;
    audioCount: number;
    totalSize: number;
  };
}

export function HomeScreen({
  onStartNewProject,
  onResumeProject,
  existingFilesCount,
}: HomeScreenProps) {
  const hasExistingSession =
    existingFilesCount.videoCount > 0 ||
    existingFilesCount.imageCount > 0 ||
    existingFilesCount.audioCount > 0;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 flex flex-col items-center text-center pb-20">
      {/* App Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1A2E] border border-[#2D2D44] text-[#7C3AED] text-xs font-medium mb-5">
        <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
        <span>Phase 4 — Quality & UI Polish Complete</span>
      </div>

      {/* Main Title */}
      <h1
        id="home-title"
        className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3"
      >
        AI Clip Editor
      </h1>

      {/* Short one-line description */}
      <p
        id="home-description"
        className="text-sm sm:text-base text-[#9CA3AF] max-w-sm mb-8 leading-relaxed"
      >
        A fast, browser-based short-video editor designed for quick clips up to 2 minutes with AI edit planning and WebAssembly rendering.
      </p>

      {/* Main Action Area */}
      <div className="w-full space-y-3 mb-8">
        <button
          id="start-new-project-btn"
          type="button"
          onClick={onStartNewProject}
          className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-base flex items-center justify-center gap-2 shadow-lg shadow-[#7C3AED]/20 active:opacity-60 transition-transform duration-150 active:scale-[0.99] cursor-pointer"
        >
          <FolderUp className="w-5 h-5" />
          <span>Start New Project</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>

        {hasExistingSession && onResumeProject && (
          <button
            id="resume-project-btn"
            type="button"
            onClick={onResumeProject}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#1A1A2E] hover:bg-[#202038] border border-[#2D2D44] text-white text-sm font-medium flex items-center justify-between active:opacity-60 transition-opacity duration-150 cursor-pointer"
          >
            <div className="flex items-center gap-2 text-left truncate">
              <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span className="truncate">Resume Active Project</span>
            </div>
            <span className="text-xs text-purple-300 font-mono flex-shrink-0 bg-[#0D0D0D] px-2 py-0.5 rounded border border-[#2D2D44]">
              {existingFilesCount.videoCount}v · {existingFilesCount.imageCount}i · {existingFilesCount.audioCount}a ({formatFileSize(existingFilesCount.totalSize)})
            </span>
          </button>
        )}
      </div>

      {/* How This Works - 4 Clear Steps */}
      <div className="w-full bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 text-left space-y-3.5 mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
          <span>How This Works</span>
        </h2>

        <div className="space-y-3">
          {/* Step 1 */}
          <div className="flex items-start gap-3 text-xs">
            <div className="w-6 h-6 rounded-lg bg-[#0D0D0D] border border-[#2D2D44] flex items-center justify-center text-purple-300 font-mono font-bold flex-shrink-0 mt-0.5">
              1
            </div>
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>Upload Media</span>
              </div>
              <p className="text-[#9CA3AF] mt-0.5 leading-relaxed">
                Add video clips, photos, and background audio files. All files are safely stored in your browser’s IndexedDB.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3 text-xs">
            <div className="w-6 h-6 rounded-lg bg-[#0D0D0D] border border-[#2D2D44] flex items-center justify-center text-purple-300 font-mono font-bold flex-shrink-0 mt-0.5">
              2
            </div>
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                <span>Describe Your Vision</span>
              </div>
              <p className="text-[#9CA3AF] mt-0.5 leading-relaxed">
                Enter editing instructions or choose preset styles like Highlight Reel, Fast Cuts, or Cinematic Montage.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3 text-xs">
            <div className="w-6 h-6 rounded-lg bg-[#0D0D0D] border border-[#2D2D44] flex items-center justify-center text-purple-300 font-mono font-bold flex-shrink-0 mt-0.5">
              3
            </div>
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>AI Edit Plan</span>
              </div>
              <p className="text-[#9CA3AF] mt-0.5 leading-relaxed">
                Gemini AI generates a multi-segment timeline specifying exact clip start times, durations, and fade transitions.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start gap-3 text-xs">
            <div className="w-6 h-6 rounded-lg bg-[#0D0D0D] border border-[#2D2D44] flex items-center justify-center text-purple-300 font-mono font-bold flex-shrink-0 mt-0.5">
              4
            </div>
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-amber-400" />
                <span>Export & Resolution Selection</span>
              </div>
              <p className="text-[#9CA3AF] mt-0.5 leading-relaxed">
                Choose 480p, 720p, or 1080p and render directly in your browser with FFmpeg.wasm — zero server uploads required.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Foundation Architecture Highlights */}
      <div className="w-full bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 text-left space-y-3 mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
          Performance & Storage Architecture
        </h2>

        <div className="flex items-start gap-2.5 text-xs text-gray-300">
          <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">IndexedDB Persistent Storage:</span> Large video and media blobs are stored directly in browser IndexedDB — avoiding localStorage quota limits and preserving your files across refreshes.
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-xs text-gray-300">
          <Smartphone className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Low-RAM & Mobile Optimized:</span> Zero backdrop blur, minimal 150ms transitions, and 44px+ touch targets for smooth operation on lightweight mobile devices.
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-xs text-gray-300">
          <Zap className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Target Length & Validation:</span> Built for short-form clips (up to 2 mins) with inline file size notices for files over 150MB.
          </div>
        </div>
      </div>

      {/* Completed Roadmap Checklist */}
      <div className="w-full text-left space-y-1.5 px-1">
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-white">Phase 1: Project Setup & IndexedDB Media Upload</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
          <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <span className="text-white">Phase 2: AI Edit Planning & Prompt Description</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
          <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <span className="text-white">Phase 3a: Client-Side FFmpeg.wasm Video Trimming</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
          <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <span className="text-white">Phase 3b: Multi-Segment Assembly, Transitions & Music</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-white">Phase 4: Export Quality (480p/720p/1080p) & UI Polish</span>
        </div>
      </div>
    </div>
  );
}
