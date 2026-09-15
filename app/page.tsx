'use client';

import React, { useState, useEffect } from 'react';
import { Header, ScreenType } from '@/components/Header';
import { HomeScreen } from '@/components/HomeScreen';
import { UploadScreen } from '@/components/UploadScreen';
import { DescribeEditScreen } from '@/components/DescribeEditScreen';
import { RenderPlaceholderScreen } from '@/components/RenderPlaceholderScreen';
import { MediaItem, EditPlan, getAllMediaItems, getEditPlan, clearAllMediaItems } from '@/lib/db';
import { Trash2 } from 'lucide-react';

export default function Page() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [editPlan, setEditPlan] = useState<EditPlan | null>(null);
  const [isLoadingDB, setIsLoadingDB] = useState<boolean>(true);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Load existing files and any saved edit plan from IndexedDB on initial mount
  useEffect(() => {
    let isCancelled = false;

    Promise.all([getAllMediaItems(), getEditPlan()])
      .then(([items, plan]) => {
        if (!isCancelled) {
          setMediaItems(items);
          if (plan) {
            setEditPlan(plan);
          }
          setIsLoadingDB(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load project from IndexedDB:', err);
        if (!isCancelled) {
          setIsLoadingDB(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleStartNewProject = () => {
    setCurrentScreen('upload');
  };

  const handleResumeProject = () => {
    if (editPlan && mediaItems.length > 0) {
      setCurrentScreen('describe');
    } else {
      setCurrentScreen('upload');
    }
  };

  const handleResetConfirm = async () => {
    try {
      await clearAllMediaItems();
      setMediaItems([]);
      setEditPlan(null);
      setShowResetConfirm(false);
      setCurrentScreen('home');
    } catch (err) {
      console.error('Failed to clear IndexedDB:', err);
    }
  };

  const videoCount = mediaItems.filter((i) => i.type === 'video').length;
  const imageCount = mediaItems.filter((i) => i.type === 'image').length;
  const audioCount = mediaItems.filter((i) => i.type === 'audio').length;
  const totalSize = mediaItems.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col selection:bg-[#7C3AED] selection:text-white">
      {/* Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        onResetProject={() => setShowResetConfirm(true)}
        hasFiles={mediaItems.length > 0}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-start">
        {currentScreen === 'home' && (
          <HomeScreen
            onStartNewProject={handleStartNewProject}
            onResumeProject={handleResumeProject}
            existingFilesCount={{
              videoCount,
              imageCount,
              audioCount,
              totalSize,
            }}
          />
        )}

        {currentScreen === 'upload' && (
          <UploadScreen
            items={mediaItems}
            onItemsChange={(updated) => setMediaItems(updated)}
            onContinue={() => setCurrentScreen('describe')}
            isLoading={isLoadingDB}
          />
        )}

        {currentScreen === 'describe' && (
          <DescribeEditScreen
            items={mediaItems}
            savedPlan={editPlan}
            onPlanGenerated={(plan) => setEditPlan(plan)}
            onBackToUpload={() => setCurrentScreen('upload')}
            onContinueToRender={() => setCurrentScreen('render')}
          />
        )}

        {currentScreen === 'render' && (
          <RenderPlaceholderScreen
            plan={editPlan}
            items={mediaItems}
            onBackToEdit={() => setCurrentScreen('describe')}
            onStartOver={() => setShowResetConfirm(true)}
            onStartNewProject={() => {
              setMediaItems([]);
              setEditPlan(null);
              setCurrentScreen('upload');
            }}
          />
        )}
      </main>

      {/* Clear/Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div
          id="reset-confirm-modal"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-[#1A1A2E] border border-[#2D2D44] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-900/30 border border-red-700/50 flex items-center justify-center text-red-400 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Reset Project?</h2>
                <p className="text-xs text-[#9CA3AF]">
                  This will delete all {mediaItems.length} uploaded files and the generated edit plan from browser storage.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                id="cancel-reset-btn"
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0D0D0D] border border-[#2D2D44] text-[#9CA3AF] hover:text-white text-xs font-semibold active:opacity-60 transition-opacity duration-150"
              >
                Cancel
              </button>
              <button
                id="confirm-reset-btn"
                type="button"
                onClick={handleResetConfirm}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold active:opacity-60 transition-opacity duration-150"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
