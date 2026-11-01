import { buildYearlyMaterial, yearlyPrompt } from '@/lib/yearly-context';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { birthInfo, year } = await request.json();
    const material = await buildYearlyMaterial(birthInfo, year);
    return Response.json({ material, prompt: yearlyPrompt(material) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '无法构建流年材料。' }, { status: 400 });
  }
}
