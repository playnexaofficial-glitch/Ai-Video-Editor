'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Film,
  Sparkles,
  Scissors,
  Download,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  Sliders,
  Layers,
  Music,
  Image as ImageIcon,
  Video as VideoIcon,
  PlusCircle,
  Monitor,
  Check,
} from 'lucide-react';
import { EditPlan, MediaItem, formatDuration, formatFileSize, clearAllProjectData } from '@/lib/db';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export type ResolutionKey = '480p' | '720p' | '1080p';

export interface ResolutionConfig {
  key: ResolutionKey;
  label: string;
  sublabel: string;
  width: number;
  height: number;
  note?: string;
}

export const RESOLUTION_OPTIONS: ResolutionConfig[] = [
  {
    key: '480p',
    label: '480p',
    sublabel: 'Fastest',
    width: 854,
    height: 480,
  },
  {
    key: '720p',
    label: '720p',
    sublabel: 'Recommended',
    width: 1280,
    height: 720,
  },
  {
    key: '1080p',
    label: '1080p',
    sublabel: 'Best Quality, Slower',
    width: 1920,
    height: 1080,
    note: 'May be slow on this device',
  },
];

interface RenderPlaceholderScreenProps {
  plan: EditPlan | null;
  items: MediaItem[];
  onBackToEdit: () => void;
  onStartOver: () => void;
  onStartNewProject?: () => void;
}

type RenderMode = 'full_plan' | 'quick_trim';

export function RenderPlaceholderScreen({
  plan,
  items,
  onBackToEdit,
  onStartOver,
  onStartNewProject,
}: RenderPlaceholderScreenProps) {
  const videoItems = useMemo(() => items.filter((i) => i.type === 'video'), [items]);
  const hasPlanSegments = Boolean(plan && plan.segments && plan.segments.length > 0);

  // Active rendering mode
  const [activeMode, setActiveMode] = useState<RenderMode>(
    hasPlanSegments ? 'full_plan' : 'quick_trim'
  );

  // Quality / Resolution Selection (Default to 720p)
  const [selectedResolution, setSelectedResolution] = useState<ResolutionKey>('720p');
  const currentResolutionConfig = useMemo(
    () => RESOLUTION_OPTIONS.find((r) => r.key === selectedResolution) || RESOLUTION_OPTIONS[1],
    [selectedResolution]
  );

  // Quick Trim State
  const [selectedVideoId, setSelectedVideoId] = useState<string>(
    videoItems[0]?.id || ''
  );
  const selectedVideo = useMemo(
    () => videoItems.find((v) => v.id === selectedVideoId) || videoItems[0] || null,
    [videoItems, selectedVideoId]
  );
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(
    selectedVideo?.duration ? Math.min(5, Math.ceil(selectedVideo.duration)) : 5
  );

  const handleSelectVideo = (newId: string) => {
    setSelectedVideoId(newId);
    const chosen = videoItems.find((v) => v.id === newId);
    setStartTime(0);
    setEndTime(chosen?.duration ? Math.min(5, Math.ceil(chosen.duration)) : 5);

    if (outputVideoUrl && activeMode === 'quick_trim') {
      URL.revokeObjectURL(outputVideoUrl);
      setOutputVideoUrl(null);
      setOutputBlob(null);
    }
  };

  // Shared Output Result state
  const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputSize, setOutputSize] = useState<number>(0);
  const [renderedResolution, setRenderedResolution] = useState<ResolutionConfig | null>(null);
  const [lastRenderedType, setLastRenderedType] = useState<RenderMode | null>(null);

  // Engine status & real progress
  const [engineState, setEngineState] = useState<'idle' | 'loading_engine' | 'processing' | 'done' | 'error'>('idle');
  const [realProgress, setRealProgress] = useState<number>(0); // 0 to 100
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [currentStepDetail, setCurrentStepDetail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isClearingProject, setIsClearingProject] = useState<boolean>(false);

  // FFmpeg client instance ref
  const ffmpegRef = useRef<FFmpeg | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (outputVideoUrl) {
        URL.revokeObjectURL(outputVideoUrl);
      }
    };
  }, [outputVideoUrl]);

  // Calculate total size of all media files referenced in the edit plan
  const planReferencedItems = useMemo(() => {
    if (!plan || !plan.segments) return [];
    const matched: MediaItem[] = [];
    const seenIds = new Set<string>();

    for (const seg of plan.segments) {
      const item = items.find((it) => it.name === seg.sourceFile || it.id === seg.sourceFile);
      if (item && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        matched.push(item);
      }
    }

    if (plan.backgroundMusic) {
      const musicItem = items.find((it) => it.name === plan.backgroundMusic || it.id === plan.backgroundMusic);
      if (musicItem && !seenIds.has(musicItem.id)) {
        seenIds.add(musicItem.id);
        matched.push(musicItem);
      }
    }

    return matched;
  }, [plan, items]);

  const totalPlanSize = useMemo(() => {
    return planReferencedItems.reduce((acc, curr) => acc + curr.size, 0);
  }, [planReferencedItems]);

  const isTotalSizeLarge = totalPlanSize > 300 * 1024 * 1024; // >300MB
  const isSelectedFileLarge = (selectedVideo?.size || 0) > 150 * 1024 * 1024; // >150MB

  /**
   * Helper to ensure FFmpeg instance is loaded
   */
  const getLoadedFFmpeg = async (): Promise<FFmpeg> => {
    let ffmpeg = ffmpegRef.current;
    if (ffmpeg && ffmpeg.loaded) {
      return ffmpeg;
    }

    setEngineState('loading_engine');
    setStatusMessage('Loading video engine (FFmpeg.wasm)...');
    setCurrentStepDetail('Initializing WebAssembly runtime');

    ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on('log', ({ message }) => {
      console.debug('[FFmpeg.wasm log]', message);
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    } catch (loadErr: unknown) {
      console.error('FFmpeg load failed:', loadErr);
      throw new Error(
        'Failed to load the browser video engine. Your browser may block WebAssembly or Cross-Origin Isolation headers.'
      );
    }

    return ffmpeg;
  };

  /**
   * Convert raw FileData safely to standard Blob without SharedArrayBuffer incompatibilities
   */
  const fileDataToBlob = (outputData: unknown, mimeType = 'video/mp4'): Blob => {
    if (typeof outputData === 'string') {
      return new Blob([outputData], { type: mimeType });
    }
    const typed = outputData as Uint8Array;
    const cleanBuffer = new ArrayBuffer(typed.byteLength);
    const cleanView = new Uint8Array(cleanBuffer);
    cleanView.set(typed);
    return new Blob([cleanBuffer], { type: mimeType });
  };

  /**
   * 1. QUICK TRIM MODE (Phase 3a proven single clip trimmer with resolution selection)
   */
  const handleTrimSingleVideo = async () => {
    if (!selectedVideo) {
      setErrorMessage('Please select a video clip to trim.');
      return;
    }

    if (startTime < 0 || endTime <= startTime) {
      setErrorMessage('End time must be greater than start time, and start time must be 0 or higher.');
      return;
    }

    if (selectedVideo.duration && startTime >= selectedVideo.duration) {
      setErrorMessage(`Start time (${startTime}s) cannot be greater than video length (${selectedVideo.duration.toFixed(1)}s).`);
      return;
    }

    setErrorMessage(null);
    setRealProgress(0);

    const virtualFilesToClean = new Set<string>();
    const { width: resWidth, height: resHeight } = currentResolutionConfig;

    try {
      const ffmpeg = await getLoadedFFmpeg();

      setEngineState('processing');
      setStatusMessage(`Trimming clip ("${selectedVideo.name}")...`);
      setCurrentStepDetail(`Extracting ${startTime}s to ${endTime}s at ${resWidth}x${resHeight}`);
      setRealProgress(10);

      // Write source file to virtual FS
      const extension = selectedVideo.name.split('.').pop() || 'mp4';
      const inputFilename = `quick_in_${Date.now()}.${extension}`;
      const outputFilename = `quick_out_${Date.now()}.mp4`;

      virtualFilesToClean.add(inputFilename);
      virtualFilesToClean.add(outputFilename);

      const fileData = await fetchFile(selectedVideo.blob);
      await ffmpeg.writeFile(inputFilename, fileData);

      setRealProgress(30);
      const targetDuration = (endTime - startTime).toFixed(2);

      // Execute trim with user-selected resolution normalization
      const videoFilter = `scale=${resWidth}:${resHeight}:force_original_aspect_ratio=decrease,pad=${resWidth}:${resHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1`;

      const execResult = await ffmpeg.exec([
        '-ss',
        `${startTime}`,
        '-i',
        inputFilename,
        '-t',
        `${targetDuration}`,
        '-vf',
        videoFilter,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        '-r',
        '30',
        '-c:a',
        'aac',
        '-ar',
        '44100',
        '-ac',
        '2',
        '-movflags',
        '+faststart',
        outputFilename,
      ]);

      if (execResult !== 0) {
        throw new Error(`FFmpeg trim execution returned non-zero code ${execResult}.`);
      }

      setRealProgress(90);
      setStatusMessage('Finalizing trimmed clip...');

      const outputData = await ffmpeg.readFile(outputFilename);
      const outputBlobResult = fileDataToBlob(outputData, 'video/mp4');
      const newUrl = URL.createObjectURL(outputBlobResult);

      if (outputVideoUrl) {
        URL.revokeObjectURL(outputVideoUrl);
      }

      setOutputBlob(outputBlobResult);
      setOutputVideoUrl(newUrl);
      setOutputSize(outputBlobResult.size);
      setRenderedResolution(currentResolutionConfig);
      setLastRenderedType('quick_trim');
      setRealProgress(100);
      setEngineState('done');
      setStatusMessage('Trim completed successfully!');
      setCurrentStepDetail(`Your ${resWidth}x${resHeight} clip is ready for preview and download`);
    } catch (err: unknown) {
      console.error('Video trim error:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Video trimming failed. Please check file format and try a smaller clip or lower resolution.';
      setErrorMessage(msg);
      setEngineState('error');
    } finally {
      // Clean up virtual files
      if (ffmpegRef.current && ffmpegRef.current.loaded) {
        for (const fname of virtualFilesToClean) {
          try {
            await ffmpegRef.current.deleteFile(fname);
          } catch {
            // ignore cleanup notices
          }
        }
      }
    }
  };

  /**
   * 2. FULL MULTI-SEGMENT EDIT PLAN RENDERING (Phase 3b with dynamic resolution selection)
   */
  const handleRenderFullPlan = async () => {
    if (!plan || !plan.segments || plan.segments.length === 0) {
      setErrorMessage('No edit plan segments available to render. Please generate an edit plan first.');
      return;
    }

    setErrorMessage(null);
    setRealProgress(0);

    const virtualFilesToClean = new Set<string>();
    const totalSegments = plan.segments.length;
    const hasBgMusic = Boolean(plan.backgroundMusic);
    const totalStages = totalSegments + 1 + (hasBgMusic ? 1 : 0);

    const { width: resWidth, height: resHeight } = currentResolutionConfig;

    try {
      const ffmpeg = await getLoadedFFmpeg();

      setEngineState('processing');
      const segmentOutputFiles: string[] = [];

      // Step 2a & 2b & 2c: Process each segment in sequence with dynamic resolution
      for (let i = 0; i < totalSegments; i++) {
        const seg = plan.segments[i];
        const segIndex1 = i + 1;
        const progressBase = Math.round((i / totalStages) * 100);
        setRealProgress(Math.max(5, progressBase));

        // Find the source media item
        const media = items.find(
          (it) => it.name === seg.sourceFile || it.id === seg.sourceFile
        );

        if (!media) {
          throw new Error(
            `Segment ${segIndex1} of ${totalSegments} failed: Source file "${seg.sourceFile}" was not found in your uploaded media files.`
          );
        }

        const ext = media.name.split('.').pop() || (media.type === 'image' ? 'jpg' : 'mp4');
        const inputVirtualName = `in_seg_${i}_${Date.now()}.${ext}`;
        const outputVirtualName = `out_seg_${i}_${Date.now()}.mp4`;

        virtualFilesToClean.add(inputVirtualName);
        virtualFilesToClean.add(outputVirtualName);

        // Fetch blob into FFmpeg FS
        setStatusMessage(
          seg.type === 'image'
            ? `Converting image to video (clip ${segIndex1} of ${totalSegments})...`
            : `Trimming clip ${segIndex1} of ${totalSegments}...`
        );
        setCurrentStepDetail(`Processing "${seg.sourceFile}" (${seg.duration}s @ ${resWidth}x${resHeight}${seg.transitionIn === 'fade' ? ' • fade-in' : ''})`);

        const fileData = await fetchFile(media.blob);
        await ffmpeg.writeFile(inputVirtualName, fileData);

        // Prepare video filter with user-selected resolution and fade transition if requested
        let videoFilter = `scale=${resWidth}:${resHeight}:force_original_aspect_ratio=decrease,pad=${resWidth}:${resHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
        if (seg.transitionIn === 'fade') {
          videoFilter += ',fade=t=in:st=0:d=0.5';
        }

        if (seg.type === 'video') {
          // Process video segment
          const segDuration = Math.max(0.1, Number(seg.duration) || 5).toFixed(2);
          const segStart = Math.max(0, Number(seg.startTime) || 0).toFixed(2);

          const execArgs = [
            '-ss',
            `${segStart}`,
            '-i',
            inputVirtualName,
            '-t',
            `${segDuration}`,
            '-vf',
            videoFilter,
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-c:a',
            'aac',
            '-ar',
            '44100',
            '-ac',
            '2',
            '-movflags',
            '+faststart',
            outputVirtualName,
          ];

          const execResult = await ffmpeg.exec(execArgs);
          if (execResult !== 0) {
            throw new Error(
              `Segment ${segIndex1} ("${seg.sourceFile}") video processing failed (exit code ${execResult}).`
            );
          }
        } else {
          // Process image segment: convert image to selected resolution video clip with silent audio track
          const imgDuration = Math.max(0.5, Number(seg.duration) || 3).toFixed(2);

          let execArgs = [
            '-loop',
            '1',
            '-i',
            inputVirtualName,
            '-f',
            'lavfi',
            '-i',
            'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-t',
            `${imgDuration}`,
            '-vf',
            videoFilter,
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-c:a',
            'aac',
            '-ar',
            '44100',
            '-ac',
            '2',
            '-shortest',
            outputVirtualName,
          ];

          let execResult = await ffmpeg.exec(execArgs);

          // Fallback if lavfi null audio is unsupported in browser build
          if (execResult !== 0) {
            console.warn('Image lavfi audio fallback attempt without audio track...');
            execArgs = [
              '-loop',
              '1',
              '-i',
              inputVirtualName,
              '-t',
              `${imgDuration}`,
              '-vf',
              videoFilter,
              '-c:v',
              'libx264',
              '-preset',
              'ultrafast',
              '-pix_fmt',
              'yuv420p',
              '-r',
              '30',
              outputVirtualName,
            ];
            execResult = await ffmpeg.exec(execArgs);
          }

          if (execResult !== 0) {
            throw new Error(
              `Segment ${segIndex1} ("${seg.sourceFile}") image-to-video conversion failed (exit code ${execResult}).`
            );
          }
        }

        segmentOutputFiles.push(outputVirtualName);
      }

      // Step 2d: Concatenate all segments in order
      const concatProgress = Math.round((totalSegments / totalStages) * 100);
      setRealProgress(concatProgress);
      setStatusMessage(`Combining ${totalSegments} segments...`);
      setCurrentStepDetail(`Assembling continuous timeline @ ${resWidth}x${resHeight}`);

      const concatListContent = segmentOutputFiles.map((file) => `file '${file}'`).join('\n');
      const concatListFilename = `concat_list_${Date.now()}.txt`;
      const combinedOutputFilename = `combined_${Date.now()}.mp4`;

      virtualFilesToClean.add(concatListFilename);
      virtualFilesToClean.add(combinedOutputFilename);

      await ffmpeg.writeFile(
        concatListFilename,
        new TextEncoder().encode(concatListContent)
      );

      // Run concat demuxer
      let concatResult = await ffmpeg.exec([
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatListFilename,
        '-c',
        'copy',
        combinedOutputFilename,
      ]);

      // If stream copy concat fails (e.g. slight metadata difference), fallback to filter concat
      if (concatResult !== 0) {
        console.warn('Concat stream copy failed, attempting filter concat...');
        const filterInputs = segmentOutputFiles.flatMap((f) => ['-i', f]);
        const filterComplex = `${segmentOutputFiles.map((_, idx) => `[${idx}:v][${idx}:a]`).join('')}concat=n=${segmentOutputFiles.length}:v=1:a=1[v][a]`;

        concatResult = await ffmpeg.exec([
          ...filterInputs,
          '-filter_complex',
          filterComplex,
          '-map',
          '[v]',
          '-map',
          '[a]',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          combinedOutputFilename,
        ]);
      }

      if (concatResult !== 0) {
        throw new Error(`Concatenation of segments failed (exit code ${concatResult}).`);
      }

      // Step 2e: Background music mixing (if specified)
      let finalOutputFilename = combinedOutputFilename;

      if (hasBgMusic && plan.backgroundMusic) {
        const mixProgress = Math.round(((totalSegments + 1) / totalStages) * 100);
        setRealProgress(mixProgress);
        setStatusMessage(`Mixing background music ("${plan.backgroundMusic}")...`);
        setCurrentStepDetail('Layering soundtrack with volume leveling & looping');

        const musicItem = items.find(
          (it) => it.name === plan.backgroundMusic || it.id === plan.backgroundMusic
        ) || items.find((it) => it.type === 'audio');

        if (musicItem) {
          const musicExt = musicItem.name.split('.').pop() || 'mp3';
          const musicVirtualName = `bg_music_${Date.now()}.${musicExt}`;
          const mixedOutputFilename = `mixed_final_${Date.now()}.mp4`;

          virtualFilesToClean.add(musicVirtualName);
          virtualFilesToClean.add(mixedOutputFilename);

          const musicData = await fetchFile(musicItem.blob);
          await ffmpeg.writeFile(musicVirtualName, musicData);

          // Mix background audio with loop and ducking
          let mixResult = await ffmpeg.exec([
            '-i',
            combinedOutputFilename,
            '-stream_loop',
            '-1',
            '-i',
            musicVirtualName,
            '-filter_complex',
            '[1:a]volume=0.45[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]',
            '-map',
            '0:v',
            '-map',
            '[aout]',
            '-c:v',
            'copy',
            '-c:a',
            'aac',
            '-shortest',
            mixedOutputFilename,
          ]);

          // Fallback if video had no audio stream
          if (mixResult !== 0) {
            console.warn('Amix fallback without primary audio track...');
            mixResult = await ffmpeg.exec([
              '-i',
              combinedOutputFilename,
              '-stream_loop',
              '-1',
              '-i',
              musicVirtualName,
              '-map',
              '0:v',
              '-map',
              '1:a',
              '-c:v',
              'copy',
              '-c:a',
              'aac',
              '-shortest',
              mixedOutputFilename,
            ]);
          }

          if (mixResult === 0) {
            finalOutputFilename = mixedOutputFilename;
          } else {
            console.warn('Background music mixing failed, using concatenated video as final output.');
          }
        }
      }

      // Step 4: Finalize and display result
      setRealProgress(95);
      setStatusMessage('Finalizing video output...');
      setCurrentStepDetail(`Exporting rendered ${resWidth}x${resHeight} MP4`);

      const outputData = await ffmpeg.readFile(finalOutputFilename);
      const outputBlobResult = fileDataToBlob(outputData, 'video/mp4');
      const newUrl = URL.createObjectURL(outputBlobResult);

      if (outputVideoUrl) {
        URL.revokeObjectURL(outputVideoUrl);
      }

      setOutputBlob(outputBlobResult);
      setOutputVideoUrl(newUrl);
      setOutputSize(outputBlobResult.size);
      setRenderedResolution(currentResolutionConfig);
      setLastRenderedType('full_plan');
      setRealProgress(100);
      setEngineState('done');
      setStatusMessage('Full video render complete!');
      setCurrentStepDetail(`Generated ${totalSegments}-segment edit @ ${resWidth}x${resHeight} (${currentResolutionConfig.label})`);
    } catch (err: unknown) {
      console.error('Full video render error:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Full video render failed. Please check that referenced files exist in your media library or try 720p/480p.';
      setErrorMessage(msg);
      setEngineState('error');
    } finally {
      // Step 6: Virtual Filesystem Cleanup (always executes)
      if (ffmpegRef.current && ffmpegRef.current.loaded) {
        for (const fname of virtualFilesToClean) {
          try {
            await ffmpegRef.current.deleteFile(fname);
          } catch {
            // ignore cleanup notices
          }
        }
      }
    }
  };

  const handleDownload = () => {
    if (!outputVideoUrl || !outputBlob) return;
    const a = document.createElement('a');
    a.href = outputVideoUrl;
    const dateStr = new Date().toISOString().slice(0, 10);
    const resLabel = renderedResolution?.label || selectedResolution;
    const filename =
      lastRenderedType === 'full_plan'
        ? `ai_edit_${resLabel}_${dateStr}.mp4`
        : `${selectedVideo?.name.replace(/\.[^/.]+$/, '') || 'clip'}_${resLabel}_trimmed.mp4`;

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleStartNewProjectAction = async () => {
    try {
      setIsClearingProject(true);
      await clearAllProjectData();
      if (onStartNewProject) {
        onStartNewProject();
      } else {
        onStartOver();
      }
    } catch (err) {
      console.error('Failed to clear project data:', err);
      onStartOver();
    } finally {
      setIsClearingProject(false);
    }
  };

  const isRendering = engineState === 'loading_engine' || engineState === 'processing';

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 pb-24 space-y-5">
      {/* Top bar with back button & badge */}
      <div className="flex items-center justify-between">
        <button
          id="render-back-to-edit-btn"
          type="button"
          onClick={onBackToEdit}
          disabled={isRendering}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1A1A2E] border border-[#2D2D44] text-[#9CA3AF] hover:text-white text-xs font-medium flex items-center gap-1.5 active:opacity-60 transition-opacity duration-150 disabled:opacity-50 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Edit Plan</span>
        </button>

        <span className="text-xs px-2.5 py-1 rounded-full bg-[#7C3AED]/20 border border-[#7C3AED]/40 text-purple-300 font-mono">
          Phase 4: Export Engine
        </span>
      </div>

      {/* Screen Title */}
      <div>
        <h1 id="render-export-title" className="text-xl font-bold text-white tracking-tight">
          Video Rendering Engine
        </h1>
        <p className="text-xs text-[#9CA3AF] mt-0.5 leading-relaxed">
          Browser-based FFmpeg.wasm video processing engine. Render your multi-clip AI edit plan with customizable resolution, transitions, and audio mixing.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 p-1 bg-[#1A1A2E] border border-[#2D2D44] rounded-xl">
        <button
          id="tab-mode-full-plan"
          type="button"
          disabled={isRendering || !hasPlanSegments}
          onClick={() => setActiveMode('full_plan')}
          className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 ${
            activeMode === 'full_plan'
              ? 'bg-[#7C3AED] text-white shadow-md'
              : hasPlanSegments
              ? 'text-[#9CA3AF] hover:text-white cursor-pointer active:opacity-60'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Render Full Plan</span>
        </button>

        <button
          id="tab-mode-quick-trim"
          type="button"
          disabled={isRendering || videoItems.length === 0}
          onClick={() => setActiveMode('quick_trim')}
          className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 ${
            activeMode === 'quick_trim'
              ? 'bg-[#7C3AED] text-white shadow-md'
              : videoItems.length > 0
              ? 'text-[#9CA3AF] hover:text-white cursor-pointer active:opacity-60'
              : 'text-gray-600 cursor-not-allowed'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Quick Trim (Single)</span>
        </button>
      </div>

      {/* Warning if no media uploaded */}
      {items.length === 0 ? (
        <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-5 text-center space-y-3">
          <Film className="w-8 h-8 text-purple-400 mx-auto opacity-60" />
          <p className="text-xs text-[#9CA3AF]">
            No media files were uploaded. Please return to Step 1 and upload your media.
          </p>
          <button
            type="button"
            onClick={onBackToEdit}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#7C3AED] text-white text-xs font-semibold cursor-pointer active:opacity-60"
          >
            Go Back
          </button>
        </div>
      ) : (
        <>
          {/* Total Plan Size Warning (>300MB) */}
          {activeMode === 'full_plan' && isTotalSizeLarge && (
            <div
              id="total-size-warning-banner"
              className="w-full rounded-xl bg-[#231A0F] border border-[#593E1A] p-3 text-amber-200 text-xs flex items-start gap-2.5"
              role="alert"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-amber-300 block">
                  Combined Media Size Notice ({formatFileSize(totalPlanSize)})
                </span>
                <p className="text-amber-200/90 leading-relaxed">
                  The media in this edit plan exceeds 300MB combined. WebAssembly processing may take longer or approach browser memory limits. We recommend 480p or 720p for fast rendering.
                </p>
              </div>
            </div>
          )}

          {/* Single File Warning (>150MB) */}
          {activeMode === 'quick_trim' && isSelectedFileLarge && (
            <div
              id="file-size-warning-banner"
              className="w-full rounded-xl bg-[#231A0F] border border-[#593E1A] p-3 text-amber-200 text-xs flex items-start gap-2.5"
              role="alert"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-amber-300 block">
                  Large File Notice ({formatFileSize(selectedVideo?.size || 0)})
                </span>
                <p className="text-amber-200/90 leading-relaxed">
                  This video is over 150MB. We recommend smaller clips during browser-side WebAssembly processing to prevent memory limits.
                </p>
              </div>
            </div>
          )}

          {/* Error Message Banner */}
          {errorMessage && (
            <div
              id="ffmpeg-error-banner"
              className="w-full rounded-xl bg-red-950/60 border border-red-800/80 p-3 text-red-200 text-xs flex items-start justify-between gap-2.5"
              role="alert"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-red-300 block">Render Error</span>
                  <p className="text-red-200/90 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={activeMode === 'full_plan' ? handleRenderFullPlan : handleTrimSingleVideo}
                disabled={isRendering}
                className="px-2.5 py-1 rounded-lg bg-red-800/30 hover:bg-red-800/50 text-red-200 border border-red-700/50 text-[11px] font-medium whitespace-nowrap active:opacity-60 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Quality / Resolution Selector Card */}
          <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Export Resolution & Quality</span>
              </span>
              <span className="text-[11px] font-mono text-purple-300">
                {currentResolutionConfig.width}x{currentResolutionConfig.height}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {RESOLUTION_OPTIONS.map((opt) => {
                const isSelected = selectedResolution === opt.key;
                return (
                  <button
                    key={opt.key}
                    id={`resolution-option-${opt.key}`}
                    type="button"
                    disabled={isRendering}
                    onClick={() => setSelectedResolution(opt.key)}
                    className={`min-h-[44px] p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 ${
                      isSelected
                        ? 'bg-[#2D2D44] border-[#7C3AED] shadow-sm'
                        : 'bg-[#0D0D0D] border-[#2D2D44] hover:border-[#4B4B6E] opacity-80'
                    } ${isRendering ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:opacity-60'}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-bold font-mono ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {opt.label}
                      </span>
                      {isSelected && <Check className="w-3 h-3 text-[#7C3AED]" />}
                    </div>
                    <span className="text-[10px] text-[#9CA3AF] leading-tight mt-1">
                      {opt.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>

            {currentResolutionConfig.note && (
              <p className="text-[11px] text-amber-300/90 bg-[#231A0F] border border-[#593E1A] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>{currentResolutionConfig.note}</span>
              </p>
            )}
          </div>

          {/* MODE 1: FULL EDIT PLAN RENDER CONTROLS */}
          {activeMode === 'full_plan' && (
            <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2D2D44] pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>Full Edit Plan Pipeline</span>
                </span>
                <span className="text-[11px] font-mono text-purple-300">
                  {plan?.segments.length || 0} segments • {currentResolutionConfig.label}
                </span>
              </div>

              {/* Edit Plan Summary Queue */}
              {plan && plan.segments && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[#9CA3AF] block">
                    Queued Timeline Sequence:
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {plan.segments.map((seg, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-[#0D0D0D] border border-[#2D2D44] rounded-xl px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="w-5 h-5 rounded-full bg-[#1A1A2E] text-purple-300 font-mono text-[10px] flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          {seg.type === 'video' ? (
                            <VideoIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          )}
                          <span className="font-medium text-white truncate">{seg.sourceFile}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-[#9CA3AF] flex-shrink-0">
                          {seg.transitionIn === 'fade' && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 text-[10px]">
                              fade
                            </span>
                          )}
                          <span>{seg.duration}s</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {plan.backgroundMusic && (
                    <div className="flex items-center justify-between bg-[#141424] border border-[#2D2D44] rounded-xl px-3 py-2 text-xs text-purple-300">
                      <div className="flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5" />
                        <span className="text-white font-medium">Soundtrack:</span>
                        <span className="font-mono text-gray-300 truncate max-w-[180px]">
                          {plan.backgroundMusic}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-900/50">
                        Loop & Mix
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Real Progress Bar & Status Display (Solid #7C3AED Fill) */}
              {isRendering && (
                <div className="space-y-2 pt-2" id="full-render-progress-section">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-purple-300 flex items-center gap-1.5 font-medium truncate pr-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400 flex-shrink-0" />
                      <span className="truncate">{statusMessage}</span>
                    </span>
                    <span className="font-mono text-white font-bold flex-shrink-0">{realProgress}%</span>
                  </div>

                  {/* Solid #7C3AED Progress Bar without gradients */}
                  <div className="w-full h-2 rounded-full bg-[#0D0D0D] border border-[#2D2D44] overflow-hidden">
                    <div
                      id="ffmpeg-full-progress-bar"
                      className="h-full bg-[#7C3AED] transition-all duration-200"
                      style={{ width: `${realProgress}%` }}
                    />
                  </div>

                  {currentStepDetail && (
                    <p className="text-[11px] text-gray-400 font-mono text-center truncate">
                      {currentStepDetail}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-500 text-center">
                    Processing locally in browser WebAssembly • No video uploaded to external servers
                  </p>
                </div>
              )}

              {/* Render Full Video CTA Button */}
              <button
                id="render-full-video-btn"
                type="button"
                disabled={isRendering || !hasPlanSegments}
                onClick={handleRenderFullPlan}
                className={`w-full min-h-[48px] px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity duration-150 ${
                  isRendering || !hasPlanSegments
                    ? 'bg-[#2D2D44] text-gray-500 cursor-not-allowed opacity-70'
                    : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white active:opacity-60 shadow-lg shadow-[#7C3AED]/20 cursor-pointer'
                }`}
              >
                {engineState === 'loading_engine' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading Video Engine...</span>
                  </>
                ) : engineState === 'processing' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Rendering Full Video ({realProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Render Full Video ({currentResolutionConfig.label})</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* MODE 2: SINGLE CLIP QUICK TRIM CONTROLS */}
          {activeMode === 'quick_trim' && (
            <div className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-[#2D2D44] pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>Single Clip Quick Trim</span>
                </span>
                <span className="text-[11px] font-mono text-purple-300">
                  {videoItems.length} {videoItems.length === 1 ? 'clip' : 'clips'} • {currentResolutionConfig.label}
                </span>
              </div>

              {/* Video Selector Dropdown */}
              <div className="space-y-1.5">
                <label htmlFor="video-select-dropdown" className="text-xs font-semibold text-[#9CA3AF] block">
                  Select Video Clip:
                </label>
                <select
                  id="video-select-dropdown"
                  value={selectedVideoId}
                  onChange={(e) => handleSelectVideo(e.target.value)}
                  disabled={isRendering}
                  className="w-full min-h-[44px] bg-[#0D0D0D] border border-[#2D2D44] focus:border-[#7C3AED] focus:outline-none rounded-xl px-3 py-2 text-xs text-white font-mono cursor-pointer transition-colors duration-150"
                >
                  {videoItems.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({formatFileSize(v.size)}{v.duration ? ` • ${formatDuration(v.duration)}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Time range inputs */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label htmlFor="start-time-input" className="text-xs font-semibold text-[#9CA3AF] block">
                    Start Time (seconds):
                  </label>
                  <div className="relative">
                    <input
                      id="start-time-input"
                      type="number"
                      min={0}
                      step={0.5}
                      max={selectedVideo?.duration || 600}
                      value={startTime}
                      onChange={(e) => setStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                      disabled={isRendering}
                      className="w-full min-h-[44px] bg-[#0D0D0D] border border-[#2D2D44] focus:border-[#7C3AED] focus:outline-none rounded-xl px-3 py-2 text-xs text-white font-mono transition-colors duration-150"
                    />
                    <span className="absolute right-3 top-3 text-[10px] text-gray-500 font-mono">sec</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="end-time-input" className="text-xs font-semibold text-[#9CA3AF] block">
                    End Time (seconds):
                  </label>
                  <div className="relative">
                    <input
                      id="end-time-input"
                      type="number"
                      min={0.5}
                      step={0.5}
                      max={selectedVideo?.duration || 600}
                      value={endTime}
                      onChange={(e) => setEndTime(Math.max(0.1, parseFloat(e.target.value) || 0))}
                      disabled={isRendering}
                      className="w-full min-h-[44px] bg-[#0D0D0D] border border-[#2D2D44] focus:border-[#7C3AED] focus:outline-none rounded-xl px-3 py-2 text-xs text-white font-mono transition-colors duration-150"
                    />
                    <span className="absolute right-3 top-3 text-[10px] text-gray-500 font-mono">sec</span>
                  </div>
                </div>
              </div>

              {/* Trim duration tag */}
              <div className="flex items-center justify-between bg-[#0D0D0D] border border-[#2D2D44] rounded-xl px-3 py-2 text-xs text-[#9CA3AF] font-mono">
                <span>Trimmed Output Length:</span>
                <span className="text-purple-300 font-bold">
                  {endTime > startTime ? `${(endTime - startTime).toFixed(1)}s` : 'Invalid Range'}
                </span>
              </div>

              {/* Real Progress Bar (Solid #7C3AED Fill) */}
              {isRendering && (
                <div className="space-y-2 pt-2" id="trim-progress-section">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-purple-300 flex items-center gap-1.5 font-medium truncate pr-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400 flex-shrink-0" />
                      <span className="truncate">{statusMessage}</span>
                    </span>
                    <span className="font-mono text-white font-bold">{realProgress}%</span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-[#0D0D0D] border border-[#2D2D44] overflow-hidden">
                    <div
                      id="ffmpeg-trim-progress-bar"
                      className="h-full bg-[#7C3AED] transition-all duration-200"
                      style={{ width: `${realProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Trim Action Button */}
              <button
                id="trim-video-btn"
                type="button"
                disabled={isRendering || endTime <= startTime}
                onClick={handleTrimSingleVideo}
                className={`w-full min-h-[48px] px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity duration-150 ${
                  isRendering || endTime <= startTime
                    ? 'bg-[#2D2D44] text-gray-500 cursor-not-allowed opacity-70'
                    : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white active:opacity-60 shadow-lg shadow-[#7C3AED]/20 cursor-pointer'
                }`}
              >
                {engineState === 'loading_engine' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading Video Engine...</span>
                  </>
                ) : engineState === 'processing' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Trimming Video ({realProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Scissors className="w-4 h-4" />
                    <span>Trim Single Clip ({currentResolutionConfig.label})</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Rendered Preview Card (when output is ready) */}
          {outputVideoUrl && (
            <div
              id="rendered-result-preview-card"
              className="bg-[#1A1A2E] border border-emerald-900/60 rounded-2xl p-4 space-y-4 shadow-lg"
            >
              <div className="flex items-center justify-between border-b border-[#2D2D44] pb-2.5">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {lastRenderedType === 'full_plan' ? 'Full Video Render Ready' : 'Trim Result Ready'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-purple-300">
                  <span className="px-2 py-0.5 rounded bg-[#0D0D0D] border border-[#2D2D44]">
                    {renderedResolution ? `${renderedResolution.width}x${renderedResolution.height} (${renderedResolution.label})` : '720p'}
                  </span>
                  <span>{formatFileSize(outputSize)}</span>
                </div>
              </div>

              {/* Output Info Line */}
              <div className="flex items-center justify-between bg-[#0D0D0D] border border-[#2D2D44] rounded-xl px-3 py-2 text-xs">
                <div className="flex items-center gap-2 text-[#9CA3AF]">
                  <Film className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Output Specs:</span>
                </div>
                <span className="font-mono text-white">
                  {renderedResolution?.label || '720p'} • {formatFileSize(outputSize)} • MP4 (H.264/AAC)
                </span>
              </div>

              {/* HTML5 Video Player */}
              <div className="w-full bg-black rounded-xl overflow-hidden aspect-video border border-[#2D2D44] relative flex items-center justify-center">
                <video
                  key={outputVideoUrl}
                  id="rendered-video-player"
                  src={outputVideoUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Action Buttons: Download & Start New Project */}
              <div className="space-y-2 pt-1">
                <button
                  id="download-rendered-video-btn"
                  type="button"
                  onClick={handleDownload}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 active:opacity-60 shadow-lg shadow-emerald-900/30 transition-opacity duration-150 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {lastRenderedType === 'full_plan' ? 'Download Full Video (.mp4)' : 'Download Trimmed Clip (.mp4)'}
                  </span>
                </button>

                <button
                  id="start-new-project-after-render-btn"
                  type="button"
                  disabled={isClearingProject}
                  onClick={handleStartNewProjectAction}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0D0D0D] hover:bg-[#141424] border border-[#2D2D44] text-purple-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 active:opacity-60 transition-opacity duration-150 cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4 text-purple-400" />
                  <span>{isClearingProject ? 'Clearing Storage...' : 'Start New Project (Clear Storage & Upload)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Reset Action */}
          <div className="pt-1">
            <button
              id="render-start-over-btn"
              type="button"
              disabled={isRendering}
              onClick={onStartOver}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1A1A2E] hover:bg-[#202038] border border-[#2D2D44] text-[#9CA3AF] hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 active:opacity-60 transition-opacity duration-150 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Start Over (Reset Project)</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
