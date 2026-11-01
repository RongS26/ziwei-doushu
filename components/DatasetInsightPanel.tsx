'use client';
import { useEffect, useRef, useState } from 'react';
import type { Palace, ZiweiChart } from '@/lib/ziwei/types';
import { TOPIC_LABEL, TOPIC_PALACE_NAME, type TopicKey } from '@/lib/ziwei/db-analysis';
import { getLiuNianSiHua, getYearBranchIndex } from '@/lib/ziwei/sihua';
import { getDaXianIndexForYear } from '@/lib/ziwei/yunxian-context';
import { BRANCHES } from '@/lib/ziwei/constants';
import type { TimeView } from './TimeNav';

const PALACE_FOCUS: Record<string, string> = {
  命宫: '个人方向、角色定位与做事方式', 兄弟: '同辈协作、合伙分工与资源边界',
  夫妻: '伴侣沟通与长期合作关系', 子女: '子女互动、带人和作品产出',
  财帛: '收入结构、现金流与支出计划', 疾厄: '生活节律、压力管理与身体感受',
  迁移: '外部环境、出行和跨地区发展', 仆役: '人脉、团队协作与支持网络',
  官禄: '职业方向、工作责任与能力呈现', 田宅: '居住安排、家庭资产与生活基础',
  福德: '精神状态、休息与长期满足感', 父母: '长辈沟通、支持体系与文书事务',
};
const TRANSFORM_MEANING: Record<string, string> = {
  禄: '传统上表示资源与获得，可把这一领域列为主动经营的方向。',
  权: '传统上表示责任和推动力，适合梳理权限、分工与承担的边界。',
  科: '传统上表示学习、名誉与可见度，可把积累专业能力与清晰表达列为主题。',
  忌: '传统上表示牵挂和阻力，适合检查反复卡住的环节，给计划留出余量；不等于一定发生坏事。',
};

export function annualSummary(chart: ZiweiChart, year: number) {
  const sihua = getLiuNianSiHua(year);
  const branch = getYearBranchIndex(year);
  const palace = chart.palaces.find(p => p.branch === branch);
  const dx = chart.daXians[getDaXianIndexForYear(chart, year)];
  const age = year - chart.lunarInfo.lunarYear + 1;
  const transforms = Object.entries(sihua.transforms).map(([kind, star]) => ({
    kind, star, palace: chart.palaces.find(p => p.stars.some(s => s.name === star)),
  }));
  return { year, sihua, branch, palace, dx, age, transforms };
}

function annualText(chart: ZiweiChart, year: number): string {
  const report = annualSummary(chart, year);
  if (report.age < 1) return '**【尚未出生】**\n该流年早于农历出生年，不能作为你的个人流年解读。';
  const stars = report.palace?.stars.filter(star => star.type === 'major').map(star => star.name).join('、') || '空宫，需结合对宫';
  const focus = PALACE_FOCUS[report.palace?.name || ''] || '对应本命宫位的生活议题';
  const lines = [
    `**【${year} ${report.sihua.stemName}${BRANCHES[report.branch]} · 流年规则分析】**`,
    `农历流年口径，按春节换年；不是公历 1 月 1 日换年。虚岁 ${report.age}。`,
    '**【年度主轴】**',
    `采用太岁入宫法：${BRANCHES[report.branch]}年对应本命${report.palace?.name || '未知宫位'}，本宫主星为${stars}。在这套规则下，本年的观察重点是${focus}。这表示观察主题，不能据此断言具体事件。`,
    '**【所属大限】**',
    report.dx ? `${report.dx.startAge}–${report.dx.endAge} 虚岁，${report.dx.palaceName}大限。十年背景可围绕${PALACE_FOCUS[report.dx.palaceName] || report.dx.palaceName}理解；所属大限按所选流年重新计算。` : '不在已生成的实际大限区间内，不套用现实当前大限。',
    '**【当年四化落点】**',
    ...report.transforms.map(item => `${item.star}化${item.kind} → 本命${item.palace?.name || '未定位'}。${TRANSFORM_MEANING[item.kind]}${item.palace ? `对应议题：${PALACE_FOCUS[item.palace.name] || item.palace.name}。` : ''}`),
    '**【这一年怎么用】**',
    `先围绕「${focus}」设一个可检查的年度目标。将化禄领域列为可探索方向，将化忌领域列为需要复盘和预留余量的方向，再用现实信息检验，不把盘面当成事件发生概率。`,
    '**【分析边界与依据】**',
    '这是本地新增的确定性规则摘要：太岁入本命宫、年干四化、按农历虚岁查大限。四化表与大限定位复用仓库 sihua.ts / yunxian-context.ts；太岁入宫和文案是本地补充，不是原作者未公开的流年断语。未包含完整流曜、小限、流月或 AI 综合判断。',
  ];
  return lines.join('\n\n');
}

export default function DatasetInsightPanel({ chart, selectedPalace, view, year: selectedYear, onViewChange, onYearChange }: {
  chart: ZiweiChart; selectedPalace: Palace | null; view: TimeView; year: number;
  onViewChange: (view: TimeView) => void; onYearChange: (year: number) => void;
}) {
  const [topics, setTopics] = useState<Partial<Record<TopicKey, string>>>({});
  const [active, setActive] = useState<TopicKey>('overview');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const { year, month, day, hour, gender } = chart.birthInfo;
  const isAnnual = view === 'liunian';

  async function exportMaterial() {
    setExporting(true); setExportError('');
    try {
      const response = await fetch('/api/yearly-material', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthInfo: { year, month, day, hour, gender }, year: selectedYear }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '材料读取失败。');
      const url = URL.createObjectURL(new Blob([data.prompt], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${selectedYear}-流年深度分析材料.txt`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setExportError(cause instanceof Error ? cause.message : '材料读取失败。'); }
    finally { setExporting(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setTopics({});
    fetch('/api/reading', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthInfo: { year, month, day, hour, gender } }), signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '解读读取失败。');
      if (!controller.signal.aborted) setTopics(data.topics);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause.message || '解读读取失败。');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [year, month, day, hour, gender, attempt]);

  useEffect(() => {
    if (!selectedPalace) return;
    const topic = (Object.keys(TOPIC_PALACE_NAME) as TopicKey[]).find(key => TOPIC_PALACE_NAME[key] === selectedPalace.name);
    if (topic) setActive(topic);
  }, [selectedPalace]);

  useEffect(() => { contentRef.current?.scrollTo(0, 0); }, [active, isAnnual, selectedYear]);

  return (
    <aside aria-label="原作者完整解读" className="card-glass rounded-xl overflow-hidden" style={{ minWidth: 0 }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--t-border)' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--t-gold)' }}>{isAnnual ? `${selectedYear} 流年 · 规则摘要` : '本命解读 · 13 个主题'}</h2>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, color: 'var(--t-gold)' }}>
          <button onClick={() => onViewChange('mingpan')} aria-pressed={!isAnnual}>本命全文</button>
          <button onClick={() => onViewChange('liunian')} aria-pressed={isAnnual}>2026–2031 流年</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--t-text2)', marginTop: 8, lineHeight: 1.7 }}>
          {isAnnual ? '2026 年基准 ＋ 2027–2031 往后五年。本地规则分析，非原作者流年断语或 AI 预测；选择年份会同步更新盘面年干四化。' : '原作者 v4 数据集全文，按当前排盘日期、时辰及性别精确匹配。覆盖 1950–2026 年。本命正文不随大限切换改写；自由追问需另接 AI。'}
        </p>
        {!isAnnual && <div role="tablist" aria-label="解读主题" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {(Object.keys(TOPIC_LABEL) as TopicKey[]).map(key => (
            <button role="tab" aria-selected={active === key} key={key} onClick={() => setActive(key)}
              style={{ padding: '7px 9px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid var(--t-border)', background: active === key ? 'rgba(212,168,67,.18)' : 'transparent', color: active === key ? 'var(--t-gold)' : 'var(--t-text2)' }}>
              {TOPIC_LABEL[key]}
            </button>
          ))}
        </div>}
        {isAnnual && <div role="tablist" aria-label="流年年份" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {[2026, 2027, 2028, 2029, 2030, 2031].map(value => <button key={value} role="tab" aria-selected={selectedYear === value} onClick={() => onYearChange(value)}
            style={{ padding: '7px 12px', border: '1px solid var(--t-border)', borderRadius: 8, color: 'var(--t-gold)', background: selectedYear === value ? 'rgba(212,168,67,.18)' : 'transparent' }}>{value}</button>)}
        </div>}
        {isAnnual && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--t-text2)', lineHeight: 1.7 }}>
          <p>深度报告尚待接入模型。已准备本命全文、大限、小限本/对宫和课程依据；下方仍为初版摘要。</p>
          <button disabled={exporting} onClick={exportMaterial} style={{ marginTop: 8, color: 'var(--t-gold)', textDecoration: 'underline' }}>{exporting ? '正在准备…' : '下载流年深度分析材料'}</button>
          {exportError && <p role="alert">{exportError}</p>}
        </div>}
      </div>
      <div ref={contentRef} role="tabpanel" aria-label={isAnnual ? `${selectedYear}流年解读` : TOPIC_LABEL[active]} aria-busy={!isAnnual && loading}
        style={{ padding: 20, maxHeight: '72vh', overflowY: 'auto', fontSize: 14, lineHeight: 1.9, color: 'var(--t-text)' }}>
        {!isAnnual && loading && <p role="status">正在读取 {year} 年解读，首次会下载约 2 MB 年份数据，请稍候…</p>}
        {!isAnnual && error && <div role="alert"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)} style={{ color: 'var(--t-gold)', marginTop: 12 }}>重试读取</button></div>}
        {(isAnnual || (!loading && !error)) && (isAnnual ? annualText(chart, selectedYear) : topics[active] || '').split('\n').map((line, index) => {
          const heading = line.match(/^(?:\*\*【(.+)】\*\*|#{1,4}\s+(.+))$/);
          if (heading) return <h3 key={index} style={{ color: 'var(--t-gold)', fontSize: 16, fontWeight: 600, margin: '18px 0 8px' }}>{heading[1] || heading[2]}</h3>;
          if (!line.trim()) return <div key={index} style={{ height: 8 }} />;
          return <p key={index} style={{ overflowWrap: 'anywhere' }}>{line.split(/\*\*(.+?)\*\*/).map((part, i) => i % 2 ? <strong key={i}>{part}</strong> : part)}</p>;
        })}
      </div>
      <p style={{ padding: '12px 16px', fontSize: 11, color: 'var(--t-text2)', borderTop: '1px solid var(--t-border)', lineHeight: 1.7 }}>
        {isAnnual ? <>本地初版摘要，采用太岁及年干四化，尚非倪师深度报告。方法研究与待办见 <a href="https://github.com/RongS26/ziwei-doushu/blob/main/docs/LOCAL_LEARNING_LOG.md" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>学习记录</a>。</> : <>来源：<a href="https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>王多鱼AI · 紫微斗数开源解读数据集 v4.0</a> · CC BY 4.0（倪师引文另依原许可）。</>}传统文化学习参考。
      </p>
    </aside>
  );
}
