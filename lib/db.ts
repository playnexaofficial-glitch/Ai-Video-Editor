export type MediaType = 'video' | 'image' | 'audio';

export interface MediaItem {
  id: string;
  type: MediaType;
  name: string;
  size: number; // in bytes
  mimeType: string;
  blob: Blob;
  createdAt: number;
  thumbnailDataUrl?: string;
  duration?: number; // seconds
  width?: number;
  height?: number;
}

export interface EditSegment {
  sourceFile: string;
  type: 'video' | 'image';
  startTime: number; // seconds, 0 if trimming isn't mentioned
  duration: number; // seconds this segment appears
  transitionIn: 'none' | 'fade' | 'cut';
}

export interface EditPlan {
  description: string;
  segments: EditSegment[];
  backgroundMusic: string | null;
  createdAt: number;
}

const DB_NAME = 'AIClipEditorDB';
const DB_VERSION = 2;
const STORE_NAME = 'media_files';
const META_STORE_NAME = 'project_meta';

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available on server'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE_NAME)) {
        db.createObjectStore(META_STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function saveMediaItem(item: MediaItem): Promise<string> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);

    request.onsuccess = () => resolve(item.id);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMultipleMediaItems(items: MediaItem[]): Promise<string[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    tx.oncomplete = () => {
      resolve(items.map((it) => it.id));
    };

    tx.onerror = () => {
      reject(tx.error);
    };

    for (const item of items) {
      store.put(item);
    }
  });
}

export async function getAllMediaItems(): Promise<MediaItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = (request.result as MediaItem[]) || [];
      // Sort chronologically by createdAt
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMediaItem(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearMediaItemsByType(type: MediaType): Promise<void> {
  const db = await getDB();
  const all = await getAllMediaItems();
  const matching = all.filter((i) => i.type === type);
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    for (const item of matching) {
      store.delete(item.id);
    }
  });
}

export async function clearAllMediaItems(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const stores = [STORE_NAME];
    if (db.objectStoreNames.contains(META_STORE_NAME)) {
      stores.push(META_STORE_NAME);
    }
    const tx = db.transaction(stores, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    if (db.objectStoreNames.contains(META_STORE_NAME)) {
      tx.objectStore(META_STORE_NAME).clear();
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clears all media items and active edit plans from IndexedDB
 */
export const clearAllProjectData = clearAllMediaItems;

export async function saveEditPlan(plan: EditPlan): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE_NAME, 'readwrite');
    const store = tx.objectStore(META_STORE_NAME);
    const request = store.put({ key: 'active_edit_plan', value: plan });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getEditPlan(): Promise<EditPlan | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(META_STORE_NAME)) {
      resolve(null);
      return;
    }
    const tx = db.transaction(META_STORE_NAME, 'readonly');
    const store = tx.objectStore(META_STORE_NAME);
    const request = store.get('active_edit_plan');

    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? (result.value as EditPlan) : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearEditPlan(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(META_STORE_NAME)) {
      resolve();
      return;
    }
    const tx = db.transaction(META_STORE_NAME, 'readwrite');
    const store = tx.objectStore(META_STORE_NAME);
    const request = store.delete('active_edit_plan');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function formatDuration(seconds?: number): string {
  if (seconds === undefined || isNaN(seconds)) return '';
  const totalSecs = Math.round(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Extracts the first frame of a video file to use as thumbnail, along with duration & dimensions.
 */
export async function generateVideoThumbnail(
  file: File | Blob
): Promise<{ thumbnail: string; duration: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const cleanUp = () => {
      URL.revokeObjectURL(objectUrl);
      video.remove();
    };

    video.onloadeddata = () => {
      // Seek slightly into the video (0.1s) to capture a frame
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDimension = 320;
        let w = video.videoWidth || 320;
        let h = video.videoHeight || 180;

        if (w > maxDimension || h > maxDimension) {
          const ratio = Math.min(maxDimension / w, maxDimension / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          const duration = video.duration || 0;
          const originalWidth = video.videoWidth || 0;
          const originalHeight = video.videoHeight || 0;
          cleanUp();
          resolve({ thumbnail, duration, width: originalWidth, height: originalHeight });
          return;
        }
      } catch (e) {
        console.warn('Could not generate video thumbnail on canvas:', e);
      }
      cleanUp();
      resolve({ thumbnail: '', duration: video.duration || 0, width: video.videoWidth || 0, height: video.videoHeight || 0 });
    };

    video.onerror = () => {
      cleanUp();
      resolve({ thumbnail: '', duration: 0, width: 0, height: 0 });
    };

    // Timeout fallback after 3 seconds
    setTimeout(() => {
      if (video.src) {
        cleanUp();
        resolve({ thumbnail: '', duration: 0, width: 0, height: 0 });
      }
    }, 3000);
  });
}

/**
 * Creates a lightweight image thumbnail and gets image dimensions.
 */
export async function generateImageThumbnail(
  file: File | Blob
): Promise<{ thumbnail: string; width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    const cleanUp = () => {
      URL.revokeObjectURL(objectUrl);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDimension = 320;
        let w = img.naturalWidth || 320;
        let h = img.naturalHeight || 240;

        if (w > maxDimension || h > maxDimension) {
          const ratio = Math.min(maxDimension / w, maxDimension / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
          cleanUp();
          resolve({ thumbnail, width: img.naturalWidth, height: img.naturalHeight });
          return;
        }
      } catch (e) {
        console.warn('Could not generate image thumbnail on canvas:', e);
      }
      cleanUp();
      resolve({ thumbnail: '', width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
    };

    img.onerror = () => {
      cleanUp();
      resolve({ thumbnail: '', width: 0, height: 0 });
    };

    setTimeout(() => {
      if (img.src) {
        cleanUp();
        resolve({ thumbnail: '', width: 0, height: 0 });
      }
    }, 2500);
  });
}

/**
 * Gets audio duration
 */
export async function getAudioDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;

    const cleanUp = () => {
      URL.revokeObjectURL(objectUrl);
    };

    audio.onloadedmetadata = () => {
      const dur = audio.duration || 0;
      cleanUp();
      resolve(dur);
    };

    audio.onerror = () => {
      cleanUp();
      resolve(0);
    };

    setTimeout(() => {
      cleanUp();
      resolve(0);
    }, 2000);
  });
}
