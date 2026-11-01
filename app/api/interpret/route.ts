import { getJob, startAnalysis } from '@/lib/local-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  const job = getJob(id);
  return Response.json(job || { error: '任务不存在或服务已重启，请重新发起。' }, { status: job ? 200 : 404, headers });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) {
    // Next dev may normalize request.url to localhost while the browser uses 127.0.0.1.
    // Compare with the actual HTTP Host instead of that internal URL hostname.
    let sameOrigin = false;
    try {
      const parsed = new URL(origin);
      sameOrigin = parsed.host === (request.headers.get('host') || new URL(request.url).host) && parsed.protocol === new URL(request.url).protocol;
    } catch { /* malformed Origin */ }
    if (!sameOrigin) return Response.json({ error: '仅接受当前本地页面的请求。' }, { status: 403, headers });
  }
  try {
    const text = await request.text();
    if (text.length > 100000) return Response.json({ error: '对话过长，请缩短后重试。' }, { status: 413, headers });
    const job = startAnalysis(JSON.parse(text));
    return Response.json(job, { status: 202, headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '输入无效。' }, { status: 400, headers });
  }
}
