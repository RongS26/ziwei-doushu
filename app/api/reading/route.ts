import { getReading, validateBirth } from '@/lib/local-reading';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let birth;
  try {
    birth = validateBirth((await request.json()).birthInfo);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '输入无效。' }, { status: 400 });
  }
  try {
    const record = await getReading(birth);
    return Response.json({ key: record.k, topics: record.c, version: 'v4.0-13d' }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Local dataset reading failed:', error);
    return Response.json({ error: '解读数据暂时无法读取，请检查 GitHub 网络并重试。需要 Node.js 22.15+（推荐 Node 24）。' }, { status: 503 });
  }
}
