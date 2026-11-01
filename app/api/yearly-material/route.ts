import { buildYearlyMaterial, yearlyPrompt } from '@/lib/yearly-context';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { birthInfo, year, question } = await request.json();
    const relatedYears = typeof question === 'string' ? [...question.slice(0, 2000).matchAll(/\b(19\d{2}|20\d{2}|21\d{2}|2200)\b/g)].map(match => Number(match[1])) : [];
    const material = await buildYearlyMaterial(birthInfo, year, relatedYears);
    return Response.json({ material, prompt: yearlyPrompt(material) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '无法构建流年材料。' }, { status: 400 });
  }
}
