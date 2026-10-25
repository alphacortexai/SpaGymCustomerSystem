import { dispatchRead, readMethodNotAllowed } from '@/lib/spaSysRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Legacy read path. Writes belong on /api/spa-sys/v1 and require SPA_SYS_API_KEY.
export const GET = dispatchRead;
export const PATCH = readMethodNotAllowed;
export const POST = readMethodNotAllowed;
export const PUT = readMethodNotAllowed;
export const DELETE = readMethodNotAllowed;
