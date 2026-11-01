'use client';
import { useEffect, useState } from 'react';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import DatasetInsightPanel from '@/components/DatasetInsightPanel';
import type { TimeView } from '@/components/TimeNav';
import { generateChart, setBrightnessSchool } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { getDaXianIndexForYear } from '@/lib/ziwei/yunxian-context';
import LocalAiPanel from '@/components/LocalAiPanel';
import StarDetailPanel from '@/components/StarDetailPanel';

export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [view, setView] = useState<TimeView>('mingpan');
  const [liunianYear, setLiunianYear] = useState(2026);
  const [selectedDx, setSelectedDx] = useState(-1);
  const [starFocus, setStarFocus] = useState<{ star: Star; palaceName: string } | null>(null);
  const [boardOpen, setBoardOpen] = useState(true);

  useEffect(() => {
    if (!starFocus) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setStarFocus(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [starFocus]);

  if (!chart) return (
    <main className="zw-start">
      <nav><a href="/">← 首页</a><a href="/library">古籍原典库</a></nav>
      <h1>紫微斗数排盘</h1>
      <p>填写出生信息，查看完整命盘与原作者解读。</p>
      <BirthForm onSubmit={(info: BirthInfo) => {
        setBrightnessSchool('XD2');
        const next = generateChart(info);
        setChart(next); setSelectedDx(next.currentDaXianIndex); setView('mingpan');
      }} />
    </main>
  );

  const dxIndex = view === 'liunian' ? getDaXianIndexForYear(chart, liunianYear) : view === 'daxian' ? selectedDx : chart.currentDaXianIndex;
  const dx = chart.daXians[dxIndex];
  const displayChart = { ...chart, currentDaXianIndex: dxIndex,
    palaces: chart.palaces.map(p => ({ ...p, isCurrentDaXian: p.branch === dx?.palaceBranch })) };
  const changeYear = (year: number) => { setLiunianYear(year); setView('liunian'); };
  const yearOptions = [...new Set([...Array.from({ length: 61 }, (_, i) => 2016 + i), liunianYear])].sort((a, b) => a - b);

  return (
    <main className="zw-workbench">
      <header className="zw-topbar">
        <button className="zw-back" onClick={() => { setChart(null); setSelectedPalace(null); setStarFocus(null); }}>‹ 返回</button>
        <strong className="zw-birth-date">{chart.birthInfo.year}年{chart.birthInfo.month}月{chart.birthInfo.day}日</strong>
        <nav className="zw-time-tabs" aria-label="命盘视图">
          <button aria-pressed={view === 'mingpan'} onClick={() => setView('mingpan')}>本命</button>
          <button aria-pressed={view === 'daxian'} onClick={() => setView('daxian')}>大限{dx ? ` ${dx.startAge}–${dx.endAge}` : ''}</button>
          <button aria-pressed={view === 'liunian'} onClick={() => setView('liunian')}>流年</button>
        </nav>
        <div className="zw-top-actions"><a href="/library">古籍原典</a><a href="/">首页</a><span>本地版</span></div>
      </header>
      <div className="zw-shell">
        <aside className="zw-sidebar" aria-label="命盘与运限">
          <button className="zw-mobile-toggle" onClick={() => setBoardOpen(value => !value)}>{boardOpen ? '收起命盘，阅读解读' : '展开命盘与运限'}</button>
          <div className={`zw-board-pane${boardOpen ? '' : ' zw-board-collapsed'}`}>
            <ChartBoard workbench chart={displayChart} onStarSelect={(star, palace) => setStarFocus({ star, palaceName: palace.name })}
              onPalaceSelect={setSelectedPalace} view={view} year={liunianYear} onViewChange={setView} onYearChange={setLiunianYear} />
            <section className="zw-timeline" aria-label="大限选择">
              <div className="zw-section-title"><span className="zw-dot zw-dot-green" />大限 <small>点击切换十年运程</small></div>
              <div className="zw-period-grid">{chart.daXians.map((item, index) => <button key={index} aria-pressed={view === 'daxian' && dxIndex === index}
                onClick={() => { setSelectedDx(index); setView('daxian'); setLiunianYear(chart.lunarInfo.lunarYear + item.startAge - 1); }}>
                <small>{item.startAge}–{item.endAge}岁</small><strong>{item.palaceName}</strong>
              </button>)}</div>
            </section>
            <section className="zw-timeline" aria-label="流年选择">
              <div className="zw-section-title"><span className="zw-dot zw-dot-blue" />流年 <small>2026 基准与往后五年</small>
                <select aria-label="流年年份" value={liunianYear} onChange={event => changeYear(Number(event.target.value))}>{yearOptions.map(year => <option key={year} value={year}>{year}</option>)}</select>
              </div>
              <div className="zw-period-grid zw-year-grid">{[2026, 2027, 2028, 2029, 2030, 2031].map(year => <button key={year} aria-pressed={view === 'liunian' && year === liunianYear} onClick={() => changeYear(year)}>
                <strong>{year}</strong><small>{year - chart.lunarInfo.lunarYear + 1}岁</small>
              </button>)}</div>
            </section>
            <p className="zw-board-note">原引擎 · v4 对应亮度口径 · 点宫位看三方，点星曜看资料</p>
          </div>
        </aside>
        <DatasetInsightPanel chart={displayChart} selectedPalace={selectedPalace} view={view} year={liunianYear} onViewChange={setView}
          aiPanel={<LocalAiPanel key={`${chart.birthInfo.year}-${chart.birthInfo.month}-${chart.birthInfo.day}-${chart.birthInfo.hour}-${chart.birthInfo.gender}`} birthInfo={chart.birthInfo} year={liunianYear} />} />
      </div>
      {starFocus && <aside className="zw-star-popover" aria-label="原作者星曜详情">
        <p>仓库原始星曜资料</p><StarDetailPanel star={starFocus.star} palaceName={starFocus.palaceName} onClose={() => setStarFocus(null)} />
      </aside>}
    </main>
  );
}
