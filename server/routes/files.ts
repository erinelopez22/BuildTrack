// /api/files — ported from FilesController.cs (local disk → Vercel Blob)
import { Hono } from 'hono';
import { authMiddleware, type AuthVars } from '../lib/auth.js';
import { uploadFile } from '../lib/blob.js';
import { fail, ok } from '../lib/response.js';

export const fileRoutes = new Hono<{ Variables: AuthVars }>();
fileRoutes.use('*', authMiddleware);

fileRoutes.post('/upload', async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return fail(c, 'No file provided.');
  }
  const file = form.get('file');
  if (!(file instanceof File)) return fail(c, 'No file provided.');

  const { result, error } = await uploadFile(file);
  if (error || !result) return fail(c, error ?? 'Upload failed.');
  return ok(c, result);
});
