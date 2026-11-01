'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { BirthInfo } from '@/lib/ziwei/types';
import { BRANCHES } from '@/lib/ziwei/constants';
import { TOPIC_LABEL, type TopicKey } from '@/lib/ziwei/db-analysis';

type Entry = { role: 'user' | 'assistant'; content: string; year: number };
type Result = { text: string; model: string; createdAt: string; citations: string[] };
type Job = { id: string; status: string; stage: string; result?: Result; error?: string };
type FactData = { name?: string; branchName?: string; title?: string; quote?: string; url?: string;
  stars?: { name: string; brightnessRaw?: string; siHua?: string }[];
  year?: number; nominalAge?: number; smallLimit?: { branch: number; oppositeBranch: number };
  decadal?: { palaceName: string; startAge: number; endAge: number } | null };
type Fact = { id: string; kind: string; data: string | FactData | FactData[] };

function Evidence({ text, facts }: { text: string; facts: Fact[] }) {
  const used = new Set([...text.matchAll(/\[(P\d+|T\d+|N_[a-z]+|YEAR|COMPARE|BIRTH)\]/g)].map(match => match[1]));
  return <details style={{ marginTop: 10, fontSize: 12, color: 'var(--t-text2)', lineHeight: 1.8 }}>
    <summary style={{ cursor: 'pointer', color: 'var(--t-gold)' }}>查看本次回答的命盘与资料依据</summary>
    {facts.filter(fact => used.has(fact.id)).map(fact => {
      let label = fact.id, detail = '', url = '';
      const data = fact.data;
      if (typeof data === 'string') { label = `原作者本命 · ${TOPIC_LABEL[fact.id.slice(2) as TopicKey] || fact.id}`; detail = data.slice(0, 220) + '…'; }
      else if (Array.isArray(data)) { label = '逐年大限与小限对照'; detail = data.map(item => `${item.year}：虚岁${item.nominalAge}，${item.decadal?.palaceName || '未入实际大限'}大限，小限在${BRANCHES[item.smallLimit?.branch ?? 0]}`).join('；'); }
      else if (fact.kind === 'primary-source') { label = data.title || fact.id; detail = data.quote || ''; url = data.url || ''; }
      else if (fact.id === 'YEAR') { label = `${data.year} 年计算结果`; detail = `虚岁${data.nominalAge}；${data.decadal?.startAge}–${data.decadal?.endAge}岁${data.decadal?.palaceName}大限；小限${BRANCHES[data.smallLimit?.branch ?? 0]}、对宫${BRANCHES[data.smallLimit?.oppositeBranch ?? 0]}`; }
      else if (data.stars) { label = `${data.branchName} · ${data.name}`; detail = data.stars.map(star => `${star.name}${star.brightnessRaw ? `（${star.brightnessRaw}）` : ''}${star.siHua ? `本命化${star.siHua}` : ''}`).join('、'); }
      else { label = '排盘基础资料'; detail = '本次生日、时辰、性别、农历出生年、五行局与命身宫计算值。'; }
      return <div key={fact.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--t-border)' }}><strong>[{fact.id}] {label}</strong><p>{detail}</p>{url && <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>回看课程出处</a>}</div>;
    })}
  </details>;
}

export function ReadingText({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  const inline = (line: string) => line.split(/\*\*(.+?)\*\*/).map((part, i) => i % 2 ? <strong key={i}>{part}</strong> : part);
  const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(value => value.trim());
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.includes('|') && lines[index + 1]?.includes('|') && cells(lines[index + 1]).every(cell => /^:?-{3,}:?$/.test(cell))) {
      const tableIndex = index, header = cells(line), rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|')) rows.push(cells(lines[index++]));
      index--;
      blocks.push(<div key={tableIndex} style={{ overflowX: 'auto', margin: '14px 0' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>{header.map((cell, i) => <th key={i} style={{ padding: 8, border: '1px solid var(--t-border)', textAlign: 'left', color: 'var(--t-gold)' }}>{inline(cell)}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={{ padding: 8, border: '1px solid var(--t-border)', verticalAlign: 'top' }}>{inline(cell)}</td>)}</tr>)}</tbody>
      </table></div>);
      continue;
    }
    const heading = line.match(/^(?:#{1,4}\s+(.+)|\*\*【(.+)】\*\*)$/);
    if (heading) blocks.push(<h3 key={index} style={{ color: 'var(--t-gold)', fontSize: 16, fontWeight: 600, margin: '18px 0 8px' }}>{heading[1] || heading[2]}</h3>);
    else if (!line.trim()) blocks.push(<div key={index} style={{ height: 8 }} />);
    else blocks.push(<p key={index}>{inline(line)}</p>);
  }
  return <div style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--t-text)', overflowWrap: 'anywhere' }}>{blocks}</div>;
}

export default function LocalAiPanel({ birthInfo, year }: { birthInfo: BirthInfo; year: number }) {
  const [reports, setReports] = useState<Record<number, Result>>({});
  const [messages, setMessages] = useState<Entry[]>([]);
  const [question, setQuestion] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [factsByYear, setFactsByYear] = useState<Record<number, Fact[]>>({});
  const controllerRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const report = reports[year];
  useEffect(() => () => { controllerRef.current?.abort(); }, []);

  async function analyze(kind: 'report' | 'question') {
    if (busy || (kind === 'question' && !question.trim())) return;
    const submittedQuestion = question.trim();
    const targetYear = year;
    const controller = new AbortController(); controllerRef.current = controller;
    setBusy(true); setError(''); setJob(null);
    try {
      const { year: birthYear, month, day, hour, gender } = birthInfo;
      const response = await fetch('/api/interpret', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ birthInfo: { year: birthYear, month, day, hour, gender }, year: targetYear,
          ...(kind === 'question' ? { question: submittedQuestion, history: messages.map(({ role, content }) => ({ role, content })) } : {}) }),
      });
      let current: Job = await response.json();
      if (!response.ok) throw new Error(current.error || '无法发起分析。');
      while (true) {
        setJob(current);
        if (current.status === 'error') throw new Error(current.error || '分析未完成。');
        if (current.status === 'done' && current.result) {
          if (kind === 'report') setReports(previous => ({ ...previous, [targetYear]: current.result! }));
          else {
            setMessages(previous => [...previous, { role: 'user', content: submittedQuestion, year: targetYear }, { role: 'assistant', content: current.result!.text, year: targetYear }]);
            setQuestion(value => value.trim() === submittedQuestion ? '' : value);
          }
          if (!factsByYear[targetYear]) {
            const materialResponse = await fetch('/api/yearly-material', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
              body: JSON.stringify({ birthInfo: { year: birthYear, month, day, hour, gender }, year: targetYear, question: kind === 'question' ? submittedQuestion : '' }) });
            if (materialResponse.ok) {
              const data = await materialResponse.json();
              setFactsByYear(previous => ({ ...previous, [targetYear]: data.material.facts }));
            }
          }
          break;
        }
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve(); }, 1500);
          function abort() { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }
          if (controller.signal.aborted) abort(); else controller.signal.addEventListener('abort', abort, { once: true });
        });
        const poll = await fetch(`/api/interpret?id=${encodeURIComponent(current.id)}`, { signal: controller.signal, cache: 'no-store' });
        current = await poll.json();
        if (!poll.ok) throw new Error(current.error || '任务查询失败。');
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '分析失败，请重试。');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([report.text], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${year}-流年深度报告.md`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section id="ziwei-ai" aria-label="AI深度解读与问答" style={{ borderTop: '1px solid var(--t-border)', padding: 16 }}>
    <h2 style={{ color: 'var(--t-gold)', fontSize: 18, fontWeight: 600 }}>AI 深度解读与问答</h2>
    <p style={{ margin: '8px 0 12px', fontSize: 12, lineHeight: 1.7, color: 'var(--t-text2)' }}>以原作者本命全文及实际命盘为依据，结合大限、小限分析。点击后调用本机 Codex，通常需要几分钟；已生成内容缓存在本机。</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: 'var(--t-gold)' }}>
      <button disabled={busy} onClick={() => analyze('report')} style={{ border: '1px solid var(--t-border)', borderRadius: 8, padding: '8px 12px', opacity: busy ? .5 : 1 }}>{report ? `查看／读取 ${year} 年报告` : `生成 ${year} 年深度报告`}</button>
      {report && <button onClick={download} style={{ textDecoration: 'underline' }}>下载报告</button>}
    </div>
    {busy && <p role="status" style={{ marginTop: 12, color: 'var(--t-gold)', fontSize: 13 }}>{job?.stage || '正在提交任务…'}。可继续查看原作者解读，请保留页面。</p>}
    {error && <p role="alert" style={{ marginTop: 12, color: '#ef8888' }}>{error}</p>}
    {report && <details open style={{ marginTop: 14 }}>
      <summary style={{ cursor: 'pointer', color: 'var(--t-gold)' }}>{year} 年完整报告 · {report.model}</summary>
      <div ref={contentRef} data-testid="ai-yearly-report" style={{ maxHeight: '65vh', overflowY: 'auto', marginTop: 12 }}><ReadingText text={report.text} /></div>
      <p style={{ fontSize: 11, color: 'var(--t-text2)', marginTop: 8 }}>AI 综合推断 · 已检查结构与引用 ID；不代表预测已被验证。</p>
      {factsByYear[year] && <Evidence text={report.text} facts={factsByYear[year]} />}
    </details>}
    <form onSubmit={event => { event.preventDefault(); void analyze('question'); }} style={{ marginTop: 18 }}>
      <label htmlFor="ziwei-question" style={{ display: 'block', marginBottom: 8, color: 'var(--t-gold)' }}>围绕我的命盘提问</label>
      <textarea id="ziwei-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={3}
        placeholder="例如：比较2026–2031年的事业变化，哪几年适合争取新机会？依据是什么？"
        style={{ width: '100%', borderRadius: 8, padding: 10, background: 'var(--t-card)', color: 'var(--t-text)', border: '1px solid var(--t-border)', resize: 'vertical' }} />
      <button type="submit" disabled={busy || !question.trim()} style={{ marginTop: 8, padding: '8px 14px', borderRadius: 8, color: 'var(--t-gold)', border: '1px solid var(--t-border)', opacity: busy || !question.trim() ? .5 : 1 }}>结合命盘回答</button>
    </form>
    <div aria-live="polite" style={{ marginTop: 16 }}>{messages.map((message, index) => <div key={index} style={{ margin: '16px 0', padding: 12, borderRadius: 10, background: message.role === 'user' ? 'rgba(212,168,67,.08)' : 'transparent' }}>
      <p style={{ color: 'var(--t-gold)', fontSize: 12 }}>{message.role === 'user' ? '我的问题' : 'AI 回答'}</p>
      <ReadingText text={message.content} />
      {message.role === 'assistant' && factsByYear[message.year] && <Evidence text={message.content} facts={factsByYear[message.year]} />}
    </div>)}</div>
  </section>;
}
