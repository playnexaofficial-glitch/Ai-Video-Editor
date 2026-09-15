'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Film,
  Music,
  Image as ImageIcon,
  AlertTriangle,
  RotateCcw,
  Edit3,
  CheckCircle2,
  Clock,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { MediaItem, EditPlan, EditSegment, formatDuration, formatFileSize, saveEditPlan } from '@/lib/db';
import { MediaPreviewList } from './MediaPreviewList';

interface DescribeEditScreenProps {
  items: MediaItem[];
  savedPlan: EditPlan | null;
  onPlanGenerated: (plan: EditPlan) => void;
  onBackToUpload: () => void;
  onContinueToRender: () => void;
}

export function DescribeEditScreen({
  items,
  savedPlan,
  onPlanGenerated,
  onBackToUpload,
  onContinueToRender,
}: DescribeEditScreenProps) {
  const [description, setDescription] = useState<string>(savedPlan?.description || '');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<EditPlan | null>(savedPlan);
  const [isEditingDescription, setIsEditingDescription] = useState<boolean>(!savedPlan);
  const [showMediaSummary, setShowMediaSummary] = useState<boolean>(false);

  const videoItems = items.filter((i) => i.type === 'video');
  const imageItems = items.filter((i) => i.type === 'image');
  const audioItems = items.filter((i) => i.type === 'audio');

  const allUploadedFilenames = items.map((i) => i.name);

  // Quick prompt helper suggestions
  const samplePrompts = [
    videoItems.length >= 2
      ? `Start with ${videoItems[0].name} for 5 seconds with a fade in, then show ${videoItems[1].name} for 5 seconds, ending with a fade out.${audioItems.length > 0 ? ` Use ${audioItems[0].name} as background music.` : ''}`
      : `Play ${videoItems[0]?.name || 'video'} with a smooth fade in.${audioItems.length > 0 ? ` Add background music from ${audioItems[0].name}.` : ''}`,
    imageItems.length > 0 && videoItems.length > 0
      ? `Start with ${videoItems[0].name} for 4s, cut to ${imageItems[0].name} for 3s, then finish with ${videoItems[0].name} for 3s.`
      : `Create a fast dynamic edit from ${videoItems[0]?.name || 'the video'}.`,
  ];

  const handleGeneratePlan = async () => {
    if (!description.trim()) {
      setErrorMessage('Please enter an edit description first.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      // Prepare metadata payload
      const filePayload = items.map((item) => ({
        name: item.name,
        type: item.type,
        duration: item.duration,
      }));

      const res = await fetch('/api/generate-edit-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: description.trim(),
          files: filePayload,
        }),
      });

      let data;
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(
          res.ok
            ? 'Invalid response format from server.'
            : `Server returned error (${res.status}): ${responseText.slice(0, 100)}`
        );
      }

      if (!res.ok || !data.success || !data.plan) {
        throw new Error(data.error || 'Failed to generate edit plan from AI.');
      }

      const generatedPlan = data.plan as EditPlan;

      // Validate that all referenced files exist in uploaded media
      const unknownFiles: string[] = [];
      for (const seg of generatedPlan.segments) {
        if (!allUploadedFilenames.includes(seg.sourceFile)) {
          unknownFiles.push(seg.sourceFile);
        }
      }

      if (generatedPlan.backgroundMusic && !allUploadedFilenames.includes(generatedPlan.backgroundMusic)) {
        unknownFiles.push(generatedPlan.backgroundMusic);
      }

      if (unknownFiles.length > 0) {
        const uniqueUnknown = Array.from(new Set(unknownFiles));
        setErrorMessage(
          `The AI referenced a file that was not uploaded ("${uniqueUnknown.join(
            '", "'
          )}") — please try rephrasing your description using the exact filenames listed above.`
        );
        setIsGenerating(false);
        return;
      }

      // Persist plan to IndexedDB
      await saveEditPlan(generatedPlan);

      setActivePlan(generatedPlan);
      onPlanGenerated(generatedPlan);
      setIsEditingDescription(false);
    } catch (err: unknown) {
      console.error('Error generating edit plan:', err);
      let msg = err instanceof Error ? err.message : 'Failed to generate edit plan. Please check your network or try again.';
      try {
        const jsonMatch = msg.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed?.error?.message) {
            msg = parsed.error.message;
          }
        }
      } catch {
        // ignore
      }
      if (msg.includes('503') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('unavailable')) {
        msg = 'The AI model is currently experiencing high demand. Please try again in a few moments.';
      }
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsertFilename = (filename: string) => {
    setDescription((prev) => {
      if (prev.endsWith(' ') || prev.length === 0) {
        return prev + filename;
      }
      return `${prev} ${filename}`;
    });
  };

  const totalPlanDuration = activePlan?.segments?.reduce((acc, curr) => acc + (curr.duration || 0), 0) || 0;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 pb-28 space-y-5">
      {/* Screen Title & Back Nav */}
      <div className="flex items-center justify-between">
        <button
          id="describe-back-btn"
          type="button"
          onClick={onBackToUpload}
          className="min-h-[44px] px-3 py-2 rounded-xl bg-[#1A1A2E] border border-[#2D2D44] text-[#9CA3AF] hover:text-white text-xs font-medium flex items-center gap-1.5 active:opacity-60 transition-opacity duration-150"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Uploads</span>
        </button>

        <span className="text-xs px-2.5 py-1 rounded-full bg-[#7C3AED]/20 border border-[#7C3AED]/40 text-purple-300 font-mono">
          Step 2: AI Edit Plan
        </span>
      </div>

      <div>
        <h1 id="describe-screen-heading" className="text-xl font-bold text-white tracking-tight">
          Describe Your Edit
        </h1>
        <p className="text-xs text-[#9CA3AF] mt-0.5 leading-relaxed">
          Tell AI how to sequence, trim, and transition your clips. AI will generate a structured blueprint.
        </p>
      </div>

      {/* Uploaded Files Summary (Collapsible / Scannable) */}
      <section
        id="describe-media-summary"
        className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-3.5 space-y-3 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Available Media Assets ({items.length})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowMediaSummary(!showMediaSummary)}
            className="min-h-[36px] text-[11px] text-purple-300 hover:text-white font-medium underline active:opacity-60 transition-opacity duration-150"
          >
            {showMediaSummary ? 'Hide previews' : 'Show previews'}
          </button>
        </div>

        {/* Tap to insert filename chips */}
        <div className="space-y-1.5">
          <p className="text-[11px] text-[#9CA3AF]">
            Tap any filename to insert into your edit description:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {videoItems.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleInsertFilename(v.name)}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#0D0D0D] border border-purple-900/50 hover:border-purple-500 text-purple-200 text-xs font-mono flex items-center gap-1.5 active:opacity-60 transition-colors duration-150"
                title={`Insert ${v.name}`}
              >
                <Film className="w-3 h-3 text-purple-400" />
                <span className="truncate max-w-[130px]">{v.name}</span>
                {v.duration ? (
                  <span className="text-[10px] text-gray-400">({formatDuration(v.duration)})</span>
                ) : null}
              </button>
            ))}

            {imageItems.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => handleInsertFilename(img.name)}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#0D0D0D] border border-blue-900/50 hover:border-blue-500 text-blue-200 text-xs font-mono flex items-center gap-1.5 active:opacity-60 transition-colors duration-150"
                title={`Insert ${img.name}`}
              >
                <ImageIcon className="w-3 h-3 text-blue-400" />
                <span className="truncate max-w-[130px]">{img.name}</span>
              </button>
            ))}

            {audioItems.map((aud) => (
              <button
                key={aud.id}
                type="button"
                onClick={() => handleInsertFilename(aud.name)}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#0D0D0D] border border-emerald-900/50 hover:border-emerald-500 text-emerald-200 text-xs font-mono flex items-center gap-1.5 active:opacity-60 transition-colors duration-150"
                title={`Insert ${aud.name}`}
              >
                <Music className="w-3 h-3 text-emerald-400" />
                <span className="truncate max-w-[130px]">{aud.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Full Media Preview List (Reused Phase 1 component) */}
        {showMediaSummary && (
          <div className="pt-2 border-t border-[#2D2D44] space-y-3">
            {videoItems.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Video Clips
                </span>
                <MediaPreviewList
                  items={videoItems}
                  type="video"
                  onRemove={() => {}}
                />
              </div>
            )}
            {imageItems.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Images
                </span>
                <MediaPreviewList
                  items={imageItems}
                  type="image"
                  onRemove={() => {}}
                />
              </div>
            )}
            {audioItems.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Audio Track
                </span>
                <MediaPreviewList
                  items={audioItems}
                  type="audio"
                  onRemove={() => {}}
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Error Message Banner */}
      {errorMessage && (
        <div
          id="describe-error-banner"
          className="w-full rounded-xl bg-[#231A0F] border border-[#593E1A] p-3 text-amber-200 text-xs flex items-start justify-between gap-2.5"
          role="alert"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-amber-300 block">Edit Plan Notice:</span>
              <p className="text-amber-200/90 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={isGenerating || !description.trim()}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-medium whitespace-nowrap active:opacity-60 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Prompt Input Form (Visible if editing or no plan yet) */}
      {(isEditingDescription || !activePlan) && (
        <section
          id="describe-input-section"
          className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <label
              htmlFor="edit-description-input"
              className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Your Edit Instructions</span>
            </label>
            <span className="text-[11px] text-[#9CA3AF]">Plain English</span>
          </div>

          <textarea
            id="edit-description-input"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isGenerating}
            placeholder='e.g. "Start with clip1 for 5 seconds with a fade in, then show image1 for 3 seconds, then clip2 with the background music playing throughout, add a fade-out at the end"'
            className="w-full bg-[#0D0D0D] border border-[#2D2D44] focus:border-[#7C3AED] focus:outline-none rounded-xl p-3 text-xs text-white placeholder-gray-500 leading-relaxed resize-none transition-colors duration-150"
          />

          {/* Prompt Starter Suggestions */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
              <HelpCircle className="w-3 h-3 text-purple-400" />
              <span>Example description template:</span>
            </div>
            {samplePrompts.slice(0, 1).map((prompt, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => setDescription(prompt)}
                className="w-full text-left text-[11px] text-gray-300 bg-[#0D0D0D] hover:bg-[#141424] border border-[#2D2D44] p-2.5 rounded-xl leading-relaxed active:opacity-60 transition-colors duration-150"
              >
                &ldquo;{prompt}&rdquo;
              </button>
            ))}
          </div>

          {/* Action button */}
          <button
            id="generate-edit-plan-btn"
            type="button"
            disabled={isGenerating || !description.trim()}
            onClick={handleGeneratePlan}
            className={`w-full min-h-[48px] px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity duration-150 ${
              isGenerating || !description.trim()
                ? 'bg-[#2D2D44] text-gray-500 cursor-not-allowed opacity-70'
                : 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white active:opacity-60 shadow-lg shadow-[#7C3AED]/20 cursor-pointer'
            }`}
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Analyzing your description...</span>
              </div>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{activePlan ? 'Regenerate Edit Plan' : 'Generate Edit Plan'}</span>
              </>
            )}
          </button>
        </section>
      )}

      {/* Generated Edit Plan View */}
      {activePlan && (
        <section
          id="generated-edit-plan-view"
          className="bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-4 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-[#2D2D44] pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Structured Edit Plan
              </span>
            </div>

            <button
              id="edit-again-btn"
              type="button"
              onClick={() => setIsEditingDescription(true)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#0D0D0D] border border-[#2D2D44] text-[#9CA3AF] hover:text-white text-xs font-medium flex items-center gap-1.5 active:opacity-60 transition-opacity duration-150"
            >
              <Edit3 className="w-3 h-3 text-purple-400" />
              <span>Edit Description</span>
            </button>
          </div>

          {/* User Prompt echo */}
          <div className="bg-[#0D0D0D] border border-[#2D2D44] rounded-xl p-3 text-xs text-gray-300">
            <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
              Instructions
            </span>
            <p className="italic text-gray-300 leading-relaxed">&ldquo;{activePlan.description}&rdquo;</p>
          </div>

          {/* Plan Breakdown List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#9CA3AF]">
              <span>Timeline Segments ({activePlan.segments.length})</span>
              <span className="font-mono text-purple-300">
                Total: ~{formatDuration(totalPlanDuration)}
              </span>
            </div>

            <div className="space-y-2" id="plan-segments-list">
              {activePlan.segments.map((seg: EditSegment, idx: number) => {
                const startTimeFormatted = formatDuration(seg.startTime);
                const endTimeFormatted = formatDuration(seg.startTime + seg.duration);

                return (
                  <div
                    key={idx}
                    id={`plan-segment-${idx}`}
                    className="w-full bg-[#141424] border border-[#2D2D44] rounded-xl p-3 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-[#7C3AED]/30 text-purple-200 font-mono text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-white font-mono truncate max-w-[180px]">
                          {seg.sourceFile}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded capitalize ${
                          seg.type === 'video'
                            ? 'bg-purple-900/50 text-purple-300'
                            : 'bg-blue-900/50 text-blue-300'
                        }`}
                      >
                        {seg.type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#9CA3AF] font-mono pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-purple-400" />
                        {seg.type === 'video' ? (
                          <span>
                            {startTimeFormatted} - {endTimeFormatted} ({seg.duration}s)
                          </span>
                        ) : (
                          <span>{seg.duration}s display</span>
                        )}
                      </div>

                      <div className="text-[10px] text-gray-400">
                        Transition:{' '}
                        <span className="text-purple-300 uppercase font-semibold">
                          {seg.transitionIn}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Background Music Line */}
            <div className="bg-[#10221B] border border-emerald-900/60 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-300 font-mono">
              <div className="flex items-center gap-2 truncate">
                <Music className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="truncate">
                  {activePlan.backgroundMusic ? activePlan.backgroundMusic : 'No background music'}
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-medium">
                {activePlan.backgroundMusic ? 'Active Track' : 'None'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Sticky Bottom Action Bar with Continue to Render Button */}
      {activePlan && (
        <div
          id="describe-sticky-footer"
          className="fixed bottom-0 left-0 right-0 bg-[#1A1A2E] border-t border-[#2D2D44] p-3 z-20"
        >
          <div className="max-w-md mx-auto space-y-2">
            <button
              id="continue-to-render-btn"
              type="button"
              onClick={onContinueToRender}
              className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold text-sm flex items-center justify-center gap-2 active:opacity-60 shadow-lg shadow-[#7C3AED]/20 transition-opacity duration-150 cursor-pointer"
            >
              <span>Continue to Render</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
