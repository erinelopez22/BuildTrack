/**
 * Client-side image compression utility.
 * Resizes to max 1600px longest side, outputs WebP (fallback JPEG), quality 0.75.
 * Preserves aspect ratio. Handles EXIF orientation via createImageBitmap.
 */

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  format: string;
  fileName: string;
}

const MAX_DIMENSION = 1600;
const QUALITY = 0.75;

function supportsWebP(): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

export async function compressImage(file: File): Promise<CompressedImage> {
  const originalSize = file.size;

  // createImageBitmap handles EXIF rotation automatically
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Scale down if needed
  const longest = Math.max(width, height);
  if (longest > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const useWebP = supportsWebP();
  const format = useWebP ? "image/webp" : "image/jpeg";
  const ext = useWebP ? ".webp" : ".jpg";

  const blob = await canvas.convertToBlob({ type: format, quality: QUALITY });

  // Generate output filename
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const fileName = `${baseName}${ext}`;

  return {
    blob,
    width,
    height,
    originalSize,
    compressedSize: blob.size,
    format,
    fileName,
  };
}

/**
 * Upload multiple files with controlled concurrency.
 * Returns results as they complete.
 */
export async function uploadWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency = 3
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
