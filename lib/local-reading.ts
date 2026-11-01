import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import * as zlib from 'node:zlib';
import type { Transform } from 'node:stream';
import type { BirthInfo } from './ziwei/types';
import type { TopicKey } from './ziwei/db-analysis';

// Node >= 22.15 provides zstd; @types/node in upstream still targets Node 20.
const zstd = zlib as typeof zlib & {
  createZstdDecompress(options: { params: Record<number, number> }): Transform;
  constants: { ZSTD_d_windowLogMax: number };
};
const RELEASE = 'https://github.com/Renhuai123/ziwei-doushu/releases/download/v4.0-13d';
const CACHE = join(process.cwd(), '.next/cache/ziwei-v4');
const downloads = new Map<number, Promise<string>>();
const lookups = new Map<string, Promise<Reading>>();
export interface Reading {
  k: string;
  y: number; m: number; d: number; h: number; g: string;
  c: Record<TopicKey, string>;
}

export function validateBirth(value: unknown): BirthInfo {
  if (!value || typeof value !== 'object') throw new Error('请提供出生日期、时辰与性别。');
  const b = value as BirthInfo;
  const date = new Date(Date.UTC(b.year, b.month - 1, b.day));
  if (![b.year, b.month, b.day, b.hour].every(Number.isInteger) ||
    date.getUTCFullYear() !== b.year || date.getUTCMonth() !== b.month - 1 || date.getUTCDate() !== b.day ||
    b.hour < 0 || b.hour > 11 || !['male', 'female'].includes(b.gender)) {
    throw new Error('出生日期、时辰或性别无效。');
  }
  if (b.year < 1950 || b.year > 2026) throw new Error('原作者 v4 解读数据仅覆盖 1950–2026 年，请选择覆盖范围内的生日。');
  // Never persist names, cities or other unnecessary personal fields.
  return { year: b.year, month: b.month, day: b.day, hour: b.hour, gender: b.gender };
}

async function atomicWrite(path: string, data: Uint8Array | string) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, data);
  await rename(temporary, path);
}

async function downloadYear(year: number): Promise<string> {
  await mkdir(CACHE, { recursive: true });
  const filename = `year-${year}.jsonl.zst`;
  const path = join(CACHE, filename);
  const sumsPath = join(CACHE, 'SHA256SUMS.txt');
  let sums = await readFile(sumsPath, 'utf8').catch(() => '');
  if (!sums) {
    const response = await fetch(`${RELEASE}/SHA256SUMS.txt`, { signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error('无法下载原作者的数据校验清单，请检查 GitHub 网络后重试。');
    sums = await response.text();
    await atomicWrite(sumsPath, sums);
  }
  const expected = sums.split('\n').find(line => line.trim().endsWith(`  ${filename}`))?.split(/\s+/)[0];
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('数据校验清单缺少该年份。');
  const digest = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
  const cached = await readFile(path).catch(() => null);
  if (cached && digest(cached) === expected) return path;
  const response = await fetch(`${RELEASE}/${filename}`, { signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error('年份解读数据下载失败，请检查 GitHub 网络后重试。');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (digest(bytes) !== expected) throw new Error('年份数据 SHA-256 校验失败，请重试。');
  await atomicWrite(path, bytes);
  return path;
}

async function findReading(b: BirthInfo): Promise<Reading> {
  let download = downloads.get(b.year);
  if (!download) {
    download = downloadYear(b.year);
    downloads.set(b.year, download);
    download.catch(() => downloads.delete(b.year));
  }
  const source = createReadStream(await download);
  const decoder = zstd.createZstdDecompress({ params: { [zstd.constants.ZSTD_d_windowLogMax]: 27 } });
  source.on('error', error => decoder.destroy(error));
  const lines = createInterface({ input: source.pipe(decoder), crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line) continue;
      const record = JSON.parse(line) as Reading;
      if (record.y === b.year && record.m === b.month && record.d === b.day && record.h === b.hour && record.g === b.gender) {
        if (Object.keys(record.c ?? {}).length !== 13 || Object.values(record.c).some(text => typeof text !== 'string' || !text.trim())) {
          throw new Error('该命盘的解读数据不完整。');
        }
        return record;
      }
    }
    throw new Error('未找到完全匹配的命盘解读，不会用相近生日替代。');
  } finally {
    lines.close(); source.destroy(); decoder.destroy();
  }
}

export async function getReading(b: BirthInfo): Promise<Reading> {
  const key = `${b.year}-${b.month}-${b.day}-${b.hour}-${b.gender}`;
  let pending = lookups.get(key);
  if (!pending) {
    // Bounded RAM cache; birth-specific records are never saved to disk.
    if (lookups.size >= 32) lookups.delete(lookups.keys().next().value!);
    pending = findReading(b);
    lookups.set(key, pending);
    pending.catch(() => lookups.delete(key));
  }
  return pending;
}
