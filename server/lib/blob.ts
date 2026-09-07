// File uploads via Vercel Blob — replaces the local wwwroot/uploads folder used by
// backend/BuildTrack.API/Controllers/FilesController.cs
import { put } from '@vercel/blob';

const ALLOWED = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
]);
// Vercel serverless functions cap the request body at ~4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024;

export interface UploadResult {
  fileUrl: string;
  fileName: string;
}

export async function uploadFile(
  file: File,
): Promise<{ result?: UploadResult; error?: string }> {
  if (!file || file.size === 0) return { error: 'No file provided.' };
  if (file.size > MAX_BYTES) return { error: 'File exceeds 4 MB limit.' };

  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  if (!ALLOWED.has(ext)) return { error: 'File type not allowed.' };

  const key = `uploads/${crypto.randomUUID()}${ext}`;
  const blob = await put(key, file, {
    access: 'public',
    contentType: file.type || undefined,
  });

  return { result: { fileUrl: blob.url, fileName: file.name } };
}
