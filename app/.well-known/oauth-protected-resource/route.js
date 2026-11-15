import { empty, resourceMetadata } from '@/lib/adminMcpHttp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return empty(204);
}

export function GET(request) {
  return resourceMetadata(request);
}
