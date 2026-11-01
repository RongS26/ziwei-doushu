'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Palace, ZiweiChart } from '@/lib/ziwei/types';
import { TOPIC_LABEL, TOPIC_PALACE_NAME, type TopicKey } from '@/lib/ziwei/db-analysis';
import { getLiuNianSiHua, getYearBranchIndex } from '@/lib/ziwei/sihua';
import { getDaXianIndexForYear } from '@/lib/ziwei/yunxian-context';
import { BRANCHES } from '@/lib/ziwei/constants';
import type { TimeView } from './TimeNav';
import type { Pattern } from '@/lib/ziwei/patterns';

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

function plain(text: string) { return text.replace(/\*\*|^#{1,4}\s+/gm, '').trim(); }
function sections(text: string) {
  const result: { title: string; lines: string[] }[] = [];
  for (const line of text.split('\n')) {
    const heading = line.match(/^(?:\*\*【(.+)】\*\*|#{1,4}\s+(.+))$/);
    if (heading) result.push({ title: heading[1] || heading[2], lines: [] });
    else { if (!result.length) result.push({ title: '', lines: [] }); result[result.length - 1].lines.push(line); }
  }
  return result;
}
function RichText({ text }: { text: string }) {
  return <>{text.split('\n').map((line, index) => {
    if (!line.trim()) return null;
    if (line.trim() === '---') return <hr key={index} />;
    return <p key={index}>{line.split(/\*\*(.+?)\*\*/).map((part, i) => i % 2 ? <strong key={i}>{part}</strong> : part)}</p>;
  })}</>;
}
const SHORT_TOPIC: Record<TopicKey, string> = { overview: '命格总览', personality: '性格', love: '感情', career: '事业', wealth: '财富', health: '健康', family: '兄弟', children: '子女', move: '迁移', friends: '人际', home: '田宅', spirit: '福德', parents: '父母' };

export default function DatasetInsightPanel({ chart, selectedPalace, view, year: selectedYear, onViewChange, aiPanel }: {
  chart: ZiweiChart; selectedPalace: Palace | null; view: TimeView; year: number;
  onViewChange: (view: TimeView) => void; aiPanel?: ReactNode;
}) {
  const [topics, setTopics] = useState<Partial<Record<TopicKey, string>>>({});
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [summary, setSummary] = useState<{ stars: string[]; keywords: string[]; nature: string } | null>(null);
  const [mode, setMode] = useState<'analysis' | 'ai'>('analysis');
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
    setLoading(true); setError(''); setTopics({}); setPatterns([]); setSummary(null);
    fetch('/api/reading', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ birthInfo: { year, month, day, hour, gender } }), signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '解读读取失败。');
      if (!controller.signal.aborted) { setTopics(data.topics); setPatterns(data.patterns || []); setSummary(data.summary || null); }
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause.message || '解读读取失败。');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [year, month, day, hour, gender, attempt]);

  useEffect(() => {
    if (!selectedPalace) return;
    const topic = (Object.keys(TOPIC_PALACE_NAME) as TopicKey[]).find(key => TOPIC_PALACE_NAME[key] === selectedPalace.name);
    if (topic) { setActive(topic); setMode('analysis'); onViewChange('mingpan'); }
  // Selection is intentionally driven by a new palace click, not by time navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPalace]);

  useEffect(() => { contentRef.current?.scrollTo(0, 0); }, [active, view, selectedYear]);

  const parsed = sections(topics[active] || '');
  const headline = plain(parsed.find(section => section.title === '一句话定调')?.lines.join('\n') || TOPIC_LABEL[active]);
  const opening = parsed[0]?.lines.join('\n').trim() || '';
  const chooseTopic = (topic: TopicKey) => { setActive(topic); onViewChange('mingpan'); };
  const annual = annualSummary(chart, selectedYear);
  const dx = chart.daXians[chart.currentDaXianIndex];

  return (
    <section className="zw-reading" aria-label="解读工作台">
      <div className="zw-reader-toolbar">
        <div role="tablist" aria-label="阅读方式" className="zw-reader-tabs">
          <button role="tab" aria-selected={mode === 'analysis'} onClick={() => setMode('analysis')}>命盘分析</button>
          <button role="tab" aria-selected={mode === 'ai'} onClick={() => setMode('ai')}>AI 对话 <span>✦</span></button>
        </div>
        <a href="https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d" target="_blank" rel="noreferrer">原作者数据 ↗</a>
      </div>
      <div hidden={mode !== 'analysis'} className="zw-analysis-pane">
        <div role="tablist" aria-label="解读主题" className="zw-topic-nav">
          {(Object.keys(TOPIC_LABEL) as TopicKey[]).map(key => <button key={key} role="tab" aria-label={TOPIC_LABEL[key]} aria-selected={active === key && view === 'mingpan'} onClick={() => chooseTopic(key)}>{SHORT_TOPIC[key]}</button>)}
        </div>
        <div ref={contentRef} className="zw-reading-scroll" role="tabpanel" aria-label={view === 'mingpan' ? TOPIC_LABEL[active] : isAnnual ? `${selectedYear}流年解读` : '大限盘面'} aria-busy={view === 'mingpan' && loading}>
          {view !== 'mingpan' ? <>
            <div className="zw-eyebrow">运限盘面 · {isAnnual ? '流年' : '大限'}</div>
            <h1 className="zw-headline">{isAnnual ? `${selectedYear} 年 · ${annual.sihua.stemName}${BRANCHES[annual.branch]}流年` : dx ? `${dx.startAge}–${dx.endAge} 岁 · ${dx.palaceName}大限` : '尚未进入大限'}</h1>
            <p className="zw-lead">{isAnnual ? `农历虚岁 ${annual.age} · ${annual.dx ? `${annual.dx.palaceName}大限` : '未进入大限区间'}` : '左侧命盘已叠加所选大限四化。选择流年，可继续查看具体年份。'}</p>
            <div className="zw-year-callout"><strong>继续看这一年的完整分析</strong><p>将本命、大限和流年材料交给本机 AI，生成六主题报告，也可以直接问事业、感情或具体选择。</p><button onClick={() => setMode('ai')}>在 AI 对话中分析 {selectedYear} 年 ↗</button></div>
            {isAnnual && annual.age > 0 && <>
              <h2 className="zw-content-title">盘面落点</h2>
              <div className="zw-quick-insights zw-year-facts">
                <article><small>太岁所在本命宫</small><h3>{annual.palace?.name || '未定位'}</h3><p>{PALACE_FOCUS[annual.palace?.name || '']}</p></article>
                <article><small>十年背景</small><h3>{annual.dx ? `${annual.dx.startAge}–${annual.dx.endAge} 岁` : '区间外'}</h3><p>{annual.dx?.palaceName || '不套用当前大限'}</p></article>
                <article><small>本宫主星</small><h3>{annual.palace?.stars.filter(star => star.type === 'major').map(star => star.name).join(' · ') || '空宫'}</h3><p>{annual.palace?.stars.some(star => star.type === 'major') ? '结合三方四正合参' : '需结合对宫，不单独定论'}</p></article>
              </div>
              <h2 className="zw-content-title">年干四化 · 盘面叠层</h2>
              <div className="zw-transform-list">{annual.transforms.map(item => <article key={item.kind}><strong>{item.star}化{item.kind}<small>本命{item.palace?.name || '未定位'}</small></strong><p>{TRANSFORM_MEANING[item.kind]}</p></article>)}</div>
            </>}
            {isAnnual && annual.age < 1 && <p role="alert">该年份早于出生年，不能作为个人流年解读。</p>}
            <details className="zw-source"><summary>盘面口径与材料下载</summary><p>原作者 v4 提供本命全文；此处为本地盘面整理。太岁入宫与年干四化属于所标示的观察口径，不是原作者的完整流年断语。AI 综合报告另行采用已注明的方法与引用，不能将四化叠层直接当成事件结论。</p><button disabled={exporting} onClick={exportMaterial}>{exporting ? '正在准备…' : `下载 ${selectedYear} 年分析材料`}</button>{exportError && <p role="alert">{exportError}</p>}</details>
            <button className="zw-text-button" onClick={() => onViewChange('mingpan')}>← 返回原作者本命全文</button>
          </> : <>
            {loading && <div className="zw-loading" role="status"><span />正在读取原作者的 13 个主题全文…<small>首次需下载约 2 MB 年份数据</small></div>}
            {error && <div className="zw-year-callout" role="alert"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>重试读取</button></div>}
            {!loading && !error && <>
              <div className="zw-meta-pills"><span>本命 · {TOPIC_LABEL[active]}</span>{summary && <span>{summary.stars.length ? summary.stars.join(' · ') : '命宫空宫'}</span>}{patterns.slice(0, 3).map((pattern, index) => <span key={index}>{pattern.name}</span>)}</div>
              <div className="zw-eyebrow">一句话定调 · 原作者原文</div>
              <h1 className="zw-headline">{headline}</h1>
              <div className="zw-lead"><RichText text={opening.split(/\n\s*\n/)[0] || ''} /></div>
              {active === 'overview' && <div className="zw-quick-insights">{(['personality', 'career', 'love'] as TopicKey[]).map((topic, index) => {
                const first = plain(sections(topics[topic] || '')[0]?.lines.join('\n') || '');
                const excerpt = first.length > 95 ? `${first.slice(0, 95)}…` : first;
                return <button key={topic} onClick={() => chooseTopic(topic)}><small>0{index + 1} / {['性格线索', '事业方向', '关系模式'][index]}</small><p>{excerpt}</p><span>阅读{SHORT_TOPIC[topic]}全文 →</span></button>;
              })}</div>}
              <div className="zw-original-content" data-testid="original-reading-body">
                {parsed.filter(section => section.title !== '一句话定调').map((section, index) => <section key={index}>
                  {section.title && <h2>{section.title}</h2>}
                  {index === 0 ? <RichText text={section.lines.join('\n').trim().split(/\n\s*\n/).slice(1).join('\n\n')} /> : <RichText text={section.lines.join('\n')} />}
                </section>)}
              </div>
              {patterns.length > 0 && <details className="zw-source"><summary>原引擎识别的 {patterns.length} 个格局 · 查看成立条件</summary>{patterns.map((pattern, index) => <article key={index}><h3>{pattern.name}</h3><p>{pattern.description}</p>{pattern.conditions && <p>成立条件：{pattern.conditions.required.join('、')}{pattern.conditions.breaking?.length ? `；限制：${pattern.conditions.breaking.join('、')}` : ''}</p>}{pattern.source && <small>原引擎标注出处：{pattern.source}</small>}</article>)}</details>}
              <details className="zw-source"><summary>原文来源与口径</summary><p>按公历日期、时辰与性别精确匹配原作者 v4 数据集，全文保留，标题与导读从原文提取。本命正文不随所选流年改写。</p><p>王多鱼AI · 紫微斗数开源解读数据集 v4.0 · CC BY 4.0（倪师引文另依原许可）。传统文化学习参考。</p></details>
            </>}
          </>}
        </div>
      </div>
      <div hidden={mode !== 'ai'} className="zw-ai-content">{aiPanel}</div>
    </section>
  );
}
