'use client';
import { useState } from 'react';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import DatasetInsightPanel from '@/components/DatasetInsightPanel';
import TimeNav, { type TimeView } from '@/components/TimeNav';
import { generateChart, setBrightnessSchool } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { getDaXianIndexForYear } from '@/lib/ziwei/yunxian-context';
import LocalAiPanel from '@/components/LocalAiPanel';
import StarDetailPanel from '@/components/StarDetailPanel';
import { useTheme } from '@/components/ThemeProvider';

/**
 * 命盘页 —— 开源版「排盘引擎 Demo」
 *
 * 这是一个最小可运行示例：用本仓库的排盘引擎 generateChart() 配合基础 UI
 * 组件，渲染一张完整紫微命盘 + 基础解读，并支持本命 / 大限 / 流年切换。
 *
 * 说明：线上商业版的完整交互界面（重设计的新 UI、AI 流式解读、合盘、分享
 * 卡片等）不在开源范围内；但排盘内核——安星算法、四化、格局识别、古籍库——
 * 完全开放（见 lib/ziwei/*），可自由二次开发出你自己的界面。
 */
export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [view, setView] = useState<TimeView>('mingpan');
  const [liunianYear, setLiunianYear] = useState(2026);
  const [starFocus, setStarFocus] = useState<{ star: Star; palaceName: string } | null>(null);
  const { theme, toggle } = useTheme();
  const navigation = <nav aria-label="原作者功能导航" className="flex flex-wrap items-center gap-3 mb-5 text-xs">
    <a href="/" className="btn-ghost">← 原作者首页</a>
    <a href="/library" className="btn-ghost">古籍原典库</a>
    <a href="/knowledge" className="btn-ghost">十四主星概览</a>
    <button onClick={toggle} className="btn-ghost">{theme === 'dark' ? '切换亮色' : '切换暗色'}</button>
  </nav>;

  // ── 未起盘：展示出生信息表单 ──
  if (!chart) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px' }}>
        {navigation}
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>紫微斗数排盘</h1>
        <p style={{ color: '#888', marginBottom: 32, fontSize: 14, lineHeight: 1.7 }}>
          输入出生年月日时，开源排盘引擎即时生成命盘。
          <br />
          本地增强版：起盘后自动读取原作者 13 主题完整解读，无需 API Key（1950–2026 年）。
        </p>
        <BirthForm onSubmit={(info: BirthInfo) => {
          // v4 dataset was generated with the pre-2026-10-20 XD2 brightness table.
          setBrightnessSchool('XD2');
          setChart(generateChart(info));
        }} />
      </main>
    );
  }

  // 所选流年的大限必须随年份更新，不能继续高亮现实当前大限。
  const dxIndex = view === 'liunian' ? getDaXianIndexForYear(chart, liunianYear) : chart.currentDaXianIndex;
  const displayChart = {
    ...chart, currentDaXianIndex: dxIndex,
    palaces: chart.palaces.map(p => ({ ...p, isCurrentDaXian: p.branch === chart.daXians[dxIndex]?.palaceBranch })),
  };
  // ── 已起盘：命盘 + 解读 ──
  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      {navigation}
      <button
        type="button"
        onClick={() => { setChart(null); setSelectedPalace(null); setStarFocus(null); }}
        className="btn-ghost"
        style={{
          marginBottom: 16, padding: '6px 14px', cursor: 'pointer',
          borderRadius: 8,
        }}
      >
        ← 重新起盘
      </button>

      <TimeNav
        chart={displayChart}
        view={view}
        liunianYear={liunianYear}
        onViewChange={setView}
        onYearChange={setLiunianYear}
      />

      <p style={{ fontSize: 12, color: '#999', marginTop: 12 }}>解读口径：v4 本命 · 现代修正 v2 亮度表。点击宫位可切换相关主题。</p>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] gap-5 mt-4 items-start">
        <div>
          <ChartBoard chart={displayChart} onStarSelect={(star, palace) => setStarFocus({ star, palaceName: palace.name })} onPalaceSelect={setSelectedPalace} view={view} year={liunianYear} onViewChange={setView} onYearChange={setLiunianYear} />
          {starFocus && <div style={{ marginTop: 16 }} aria-label="原作者星曜详情">
            <p className="label-section" style={{ marginBottom: 8 }}>仓库原始星曜资料 · 非个性化流年结论</p>
            <StarDetailPanel star={starFocus.star} palaceName={starFocus.palaceName} onClose={() => setStarFocus(null)} />
          </div>}
        </div>
        <DatasetInsightPanel chart={chart} selectedPalace={selectedPalace} view={view} year={liunianYear} onViewChange={setView} onYearChange={year => { setLiunianYear(year); setView('liunian'); }} />
      </div>
      <details className="card" style={{ maxWidth: 960, margin: '32px auto 0', padding: 16 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--ac)', fontSize: 15 }}>可选增强 · AI 深度解读与问答</summary>
        <LocalAiPanel key={`${chart.birthInfo.year}-${chart.birthInfo.month}-${chart.birthInfo.day}-${chart.birthInfo.hour}-${chart.birthInfo.gender}`} birthInfo={chart.birthInfo} year={liunianYear} />
      </details>
    </main>
  );
}
