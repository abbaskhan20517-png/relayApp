import { env } from 'cloudflare:workers';
import { handle } from '../../../lib/api.js';
export const dynamic = 'force-dynamic';
function route(request: Request) { return handle(request, { ...env, APP_URL: (env as any).APP_URL || new URL(request.url).origin }); }
export const GET=route;
export const POST=route;
export const PATCH=route;
export const DELETE=route;
