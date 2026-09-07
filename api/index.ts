// Single Vercel serverless function that serves the whole BuildTrack API.
// vercel.json rewrites every /api/* path here; Hono does the routing.
import { handle } from 'hono/vercel';
import { createApp } from '../server/app';

export const config = { runtime: 'nodejs' };

export default handle(createApp());
