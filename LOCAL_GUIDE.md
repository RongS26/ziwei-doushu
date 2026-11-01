# 本地解读增强版：启动、学习与接力

维护仓库：https://github.com/RongS26/ziwei-doushu

上游：https://github.com/Renhuai123/ziwei-doushu

上游学习基线：`495b79e`（2026-11-01 拉取）。

## 换电脑快速运行

```bash
git clone https://github.com/RongS26/ziwei-doushu.git
cd ziwei-doushu
# 推荐 Node.js 24；内置 zstd 解压能力要求 Node >= 22.15。
npm ci --no-audit --no-fund
npm run dev -- --hostname 127.0.0.1 --port 3210
```

浏览器打开 http://127.0.0.1:3210/chart 。不用数据库、登录或 API Key。

先填出生日期、钟表时间、地点、性别，再起盘。出生地点会影响表单计算的时辰；数据查找使用排盘引擎输出的公历日期、时辰序号和性别，不用相近生日代替。

## 当前能做什么

| 功能 | 状态 |
| --- | --- |
| 本命排盘、宫位点击 | 可用 |
| 本命 13 主题全文 | 可用，读取作者 v4.0-13d 原始数据 |
| 2026–2031 年份切换、盘面年干四化 | 可用，年份和大限高亮已统一 |
| 流年简单规则摘要 | 可用，但它是本地初版，深度不等于本命全文 |
| 倪师口径的流年分析材料 | 可用：本命＋大限＋小限本/对宫＋原话依据 |
| 同等深度的 AI 流年正文 | 尚未接入；不能把规则摘要当成已经实现 |
| AI 自由追问、完整商业版后端 | 上游未开源，本地未实现 |

用户的验收目标是**本命与未来五年都能给出具体、有依据的解读**，不是仅有排盘或四化落点。当前 AI 深度流年环节仍待完成。

## 本命数据如何工作

- 来源：上游 [v4.0-13d Release](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d)。1950–2026，每盘 13 个主题。
- 第一次读取某个出生年份时，自动下载约 2 MB `year-YYYY.jsonl.zst` 和 `SHA256SUMS.txt`，验证 SHA-256。
- 缓存在 `.next/cache/ziwei-v4/`，Git 忽略。流式解压逐行查找，不写出每年约数百 MB 的 JSONL，更不解压全年份 56.6 GB。
- 本命记录只做有上限的内存缓存，不存姓名、不存用户个人解读到 Git。删除 `.next` 后会重新下载。
- v4 按 2026-10-15 旧亮度表生成，本地 `/chart` 因此使用 `setBrightnessSchool('XD2')`，避免和上游 10-20 改用的 QS 默认表混用。
- 数据是确定性断语生成的**本命**正文，不是 AI 流年报告；不随年份切换自动变成流年解读。

## 流年继续开发的正确入口

阅读 [学习记录](docs/LOCAL_LEARNING_LOG.md)，尤其是流派口径纠正。

```text
lib/local-reading.ts                  原始本命数据下载、校验、流式匹配
app/api/reading/route.ts              本命全文接口
lib/yearly-context.ts                大限/小限定位、事实 ID、原话来源、深度写作要求
app/api/yearly-material/route.ts      导出给模型的完整材料和 prompt；此接口不调用模型
components/DatasetInsightPanel.tsx   13 主题正文与初版流年摘要
components/ChartBoard.tsx            受控年份，统一盘面状态
app/chart/page.tsx                   起盘入口、v4 亮度口径、按所选年份更新大限
```

`POST /api/yearly-material`：

```json
{"birthInfo":{"year":1995,"month":6,"day":15,"hour":4,"gender":"male"},"year":2026}
```

`hour` 是时辰序号 0–11，不是钟表小时。例子是虚构测试输入。

后续接模型时必须：

1. 先确认使用本机 Codex 登录还是指定 API；不得读取/上传身份凭据，不把 API Key 写入 Git。
2. 分开“计算事实”“原作者本命断语”“课程原话”“新增模型推断”。
3. 主要结论以本命→大限→小限推导，年干四化作为其他流派附录，不能混成倪师原法。
4. 每个主题包含具体判断、至少两项事实 ID、支持与限制、现实建议；与相邻年份比较。
5. 明确未计算的流月/流日，不编月份、事件日期、概率或保证性未来结论。
6. 至少人工审阅一份真实生成的完整报告，再宣称深度功能完成。按钮、长文本或通过类型检查都不等于内容质量验收。

## 验证与常见问题

```bash
npm run typecheck
npm test
```

- 已验证 13 主题切换、按性别精确匹配、非法日期/时辰拒绝、六年份切换、桌面及 390px 手机布局。
- 上游 `npm test` 全过，包含 768 个命盘完整性回归和日期/时辰/夏令时等边界。
- GitHub 下载失败：确认网络后重试；数据完整性失败不接受损坏缓存。跨电脑缓存无需复制。
- `/api/interpret` 返回 404：上游不提供后端，填 Key 也不会自动生成接口。
- `next dev` 会自动调整 `tsconfig.json`、`next-env.d.ts`，并生成 `AGENTS.md` / `CLAUDE.md`，这是该 Next.js 版本的行为。
- 本地开发服务只监听 `127.0.0.1`；这套无用户鉴权的个人实验版不应直接公开部署。

## 许可

上游代码 MIT；v4 数据 CC BY 4.0，保留王多鱼AI与源仓库 attribution。`docs/tianji-ziwei/` 原话按其 CC BY-NC-SA 4.0 许可用于非商业学习，不能把它误标成 MIT 或 CC BY。详见上游 `DATASET-LICENSE` 及该目录的 `LICENSE.md`。
