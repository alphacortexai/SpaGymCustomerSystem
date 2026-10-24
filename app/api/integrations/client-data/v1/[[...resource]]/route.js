import { dispatch, methodNotAllowed } from '@/lib/spaSysRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Older path kept so a dependent system that already calls /api/integrations/client-data/v1
// reaches the same SPA_SYS_API_V1 handlers.
export const GET = dispatch;
export const PATCH = dispatch;
export const POST = dispatch;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
