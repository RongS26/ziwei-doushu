'use client';
import { useState } from 'react';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import DatasetInsightPanel from '@/components/DatasetInsightPanel';
import TimeNav, { type TimeView } from '@/components/TimeNav';
import { generateChart, setBrightnessSchool } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';
import { getDaXianIndexForYear } from '@/lib/ziwei/yunxian-context';

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

  // ── 未起盘：展示出生信息表单 ──
  if (!chart) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px' }}>
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
      <button
        type="button"
        onClick={() => { setChart(null); setSelectedPalace(null); }}
        style={{
          marginBottom: 16, padding: '6px 14px', cursor: 'pointer',
          border: '1px solid #ccc', borderRadius: 8, background: 'transparent',
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
        <ChartBoard chart={displayChart} onPalaceSelect={setSelectedPalace} view={view} year={liunianYear} onViewChange={setView} onYearChange={setLiunianYear} />
        <DatasetInsightPanel chart={chart} selectedPalace={selectedPalace} view={view} year={liunianYear} onViewChange={setView} onYearChange={year => { setLiunianYear(year); setView('liunian'); }} />
      </div>
    </main>
  );
}
