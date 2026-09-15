'use client';

import React from 'react';
import { Sparkles, ArrowLeft, RotateCcw } from 'lucide-react';

export type ScreenType = 'home' | 'upload' | 'describe' | 'render';

interface HeaderProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  onResetProject?: () => void;
  hasFiles?: boolean;
}

export function Header({
  currentScreen,
  onNavigate,
  onResetProject,
  hasFiles = false,
}: HeaderProps) {
  const handleBack = () => {
    if (currentScreen === 'render') onNavigate('describe');
    else if (currentScreen === 'describe') onNavigate('upload');
    else if (currentScreen === 'upload') onNavigate('home');
  };

  return (
    <header
      id="app-header"
      className="w-full bg-[#1A1A2E] border-b border-[#2D2D44] px-4 py-3 sticky top-0 z-30"
    >
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentScreen !== 'home' && (
            <button
              id="header-back-btn"
              type="button"
              onClick={handleBack}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-[#0D0D0D] border border-[#2D2D44] text-[#9CA3AF] hover:text-white active:opacity-60 transition-opacity duration-150"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-left active:opacity-60 transition-opacity duration-150"
          >
            <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-base text-white tracking-tight block leading-tight">
                AI Clip Editor
              </span>
              <span className="text-[11px] text-[#9CA3AF] block leading-tight">
                AI Video Editor • Phase 4
              </span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {currentScreen !== 'home' && hasFiles && onResetProject && (
            <button
              id="header-reset-btn"
              type="button"
              onClick={onResetProject}
              className="min-h-[44px] px-3 py-2 text-xs font-medium text-[#9CA3AF] hover:text-white rounded-lg border border-[#2D2D44] bg-[#0D0D0D] flex items-center gap-1.5 active:opacity-60 transition-opacity duration-150"
              title="Clear all project media and plan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          {currentScreen === 'upload' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#0D0D0D] border border-[#2D2D44] text-[#9CA3AF] font-mono">
              Step 1 of 3
            </span>
          )}

          {currentScreen === 'describe' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#7C3AED]/20 border border-[#7C3AED]/40 text-purple-300 font-mono">
              Step 2 of 3
            </span>
          )}

          {currentScreen === 'render' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-900/30 border border-blue-700/50 text-blue-300 font-mono">
              Step 3 of 3
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
