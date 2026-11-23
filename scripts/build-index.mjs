#!/usr/bin/env node
// 生成并校验 manbo 图源清单 index.main.json。
//
// 单一真源是各图源目录下的 source.json；index.main.json 由本脚本产出、勿手改。
//   node scripts/build-index.mjs          # 重新生成 index.main.json
//   node scripts/build-index.mjs --check  # 只校验（CI 用），不一致则退出码 1
//
// 清单格式由 manbo-reader 的 SourceSubscription / SourceConfigMerger 消费：
// 顶层是数组，每项至少含 name 或 pkg，可选 config 对象做配置热更。

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_PATH = join(ROOT, 'index.main.json');

// 与 manbo-reader utils/source/SourceIdUtil.ONLINE_SOURCE_IDS 对齐，决定清单顺序。
const ORDER = [
  'pica', 'komiic', 'copy', 'bilibili', 'baozi', 'goda', 'baka', 'zai',
  'jcomic', 'mh1234', 'jinman', 'manwa', 'roumanwu', 'wnacg', 'ehentai',
  'pixiv', 'tencent', 'mangaxiaosi',
];

const PKG_PREFIX = 'com.manbo.source.';
const errors = [];

function fail(msg) {
  errors.push(msg);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// 图源目录名必须形如 com.manbo.source.<key>，且 pkg 含内置 key（manbo 按 pkg 模糊匹配内置源）。
function loadSource(dirName) {
  const file = join(ROOT, dirName, 'source.json');
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`${dirName}/source.json 解析失败: ${e.message}`);
    return null;
  }
  const meta = doc.metadata || {};
  const key = dirName.slice(PKG_PREFIX.length);

  if (meta.id !== dirName) fail(`${dirName}: metadata.id 必须等于目录名，实际 ${JSON.stringify(meta.id)}`);
  if (!ORDER.includes(key)) fail(`${dirName}: key "${key}" 不在 ONLINE_SOURCE_IDS 清单内`);
  if (!isNonEmptyString(meta.name)) fail(`${dirName}: metadata.name 缺失`);
  if (meta.type !== 'manga') fail(`${dirName}: metadata.type 必须为 "manga"`);
  if (typeof meta.nsfw !== 'boolean') fail(`${dirName}: metadata.nsfw 必须为布尔值`);
  if (!dirName.includes(key)) fail(`${dirName}: pkg 不含内置 key "${key}"`);
  if (!Array.isArray(doc.sources) || doc.sources.length === 0) fail(`${dirName}: sources 必须是非空数组`);
  else {
    doc.sources.forEach((s, i) => {
      if (!isNonEmptyString(s.name)) fail(`${dirName}: sources[${i}].name 缺失`);
      if (!isNonEmptyString(s.baseUrl)) fail(`${dirName}: sources[${i}].baseUrl 缺失`);
    });
  }
  if (meta.nsfw === true && NUMERIC_NSFW.has(key) === false) {
    // 仅提示：18+ 判定以 manbo-reader OnlineSourceView.ADULT_SOURCES 为准。
    console.warn(`提示: ${dirName} 标了 nsfw，但不在 reader 的 ADULT_SOURCES 列表内`);
  }

  const entry = {
    name: `Manbo: ${meta.name}`,
    pkg: dirName,
    type: 'manga',
    lang: meta.language || 'zh',
    code: ORDER.indexOf(key) + 1,
    version: meta.version || '1.0.0',
    nsfw: meta.nsfw ? 1 : 0,
    hasIcon: false,
    sources: doc.sources.map((s) => ({ name: s.name, lang: s.lang || meta.language || 'zh', baseUrl: s.baseUrl })),
  };

  // 可选热更配置：非空对象才写入清单；空对象/缺失均省略（行为与旧清单一致）。
  if (doc.config && typeof doc.config === 'object' && !Array.isArray(doc.config)
    && Object.keys(doc.config).length > 0) {
    entry.config = doc.config;
  } else if (doc.config !== undefined) {
    fail(`${dirName}: config 存在但不是非空对象，热更配置将被忽略`);
  }
  return entry;
}

// reader 权威 18+ 子集（OnlineSourceView.ADULT_SOURCES），仅用于一致性提示。
const NUMERIC_NSFW = new Set(['pica', 'jinman', 'jcomic', 'manwa', 'wnacg', 'ehentai', 'roumanwu', 'pixiv']);

const dirs = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith(PKG_PREFIX))
  .map((d) => d.name);

for (const key of ORDER) {
  if (!dirs.includes(PKG_PREFIX + key)) fail(`缺少图源目录 ${PKG_PREFIX}${key}`);
}
const seenPkg = new Set();
const entries = [];
for (const dirName of dirs) {
  if (seenPkg.has(dirName)) fail(`重复 pkg: ${dirName}`);
  seenPkg.add(dirName);
  const entry = loadSource(dirName);
  if (entry) entries.push(entry);
}
entries.sort((a, b) => a.code - b.code);

if (errors.length > 0) {
  console.error('图源校验失败:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

const json = JSON.stringify(entries, null, 2) + '\n';
const check = process.argv.includes('--check');

if (check) {
  const current = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf8') : '';
  if (current !== json) {
    console.error('index.main.json 与 source.json 不一致，请运行 node scripts/build-index.mjs 后提交。');
    process.exit(1);
  }
  console.log(`OK: index.main.json 与 ${entries.length} 个图源一致`);
} else {
  writeFileSync(INDEX_PATH, json);
  console.log(`已生成 index.main.json（${entries.length} 个图源）`);
}
