import { dispatch, methodNotAllowed } from '@/lib/spaSysRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = dispatch;
export const PATCH = dispatch;
export const POST = dispatch;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
