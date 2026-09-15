import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let isLoaded = false;
let loadPromise: Promise<FFmpeg> | null = null;

export async function getFFmpeg(
  onLog?: (message: string) => void,
  onProgress?: (progress: { progress: number; time: number }) => void
): Promise<FFmpeg> {
  if (typeof window === 'undefined') {
    throw new Error('FFmpeg.wasm can only run client-side in the browser.');
  }

  if (ffmpegInstance && isLoaded) {
    // Attach fresh listener handlers if provided
    return ffmpegInstance;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    if (onLog) {
      ffmpeg.on('log', ({ message }) => {
        onLog(message);
      });
    }

    if (onProgress) {
      ffmpeg.on('progress', ({ progress, time }) => {
        onProgress({ progress, time });
      });
    }

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      ffmpegInstance = ffmpeg;
      isLoaded = true;
      return ffmpeg;
    } catch (err) {
      // Reset so user can retry if failure was transient
      loadPromise = null;
      ffmpegInstance = null;
      isLoaded = false;
      throw err;
    }
  })();

  return loadPromise;
}
