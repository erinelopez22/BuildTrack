// Single Vercel serverless function that serves the whole BuildTrack API.
// vercel.json rewrites every /api/* path here; Hono does the routing.
//
// Vercel's Node runtime treats named HTTP-method exports as Web-standard
// (Request -> Response) handlers, which is exactly Hono's `app.fetch`.
// (hono/vercel and @hono/node-server/vercel don't work here: the former's
// Response is ignored, the latter hangs on request bodies.)
import { createApp } from '../server/app.js';

export const config = { runtime: 'nodejs' };

const app = createApp();
const handler = (req: Request): Response | Promise<Response> => app.fetch(req);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
