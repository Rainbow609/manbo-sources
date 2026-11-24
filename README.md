# manbo-sources · 纸飞机（manbo）图源仓库

manbo 系列阅读器「纸飞机」（`manbo-reader`）的**图源订阅仓库**：托管一份图源清单
`index.json`，供 App 内「图源订阅」直接拉取。

> 词汇口径：本项目统一称「图源」，不用「书源」。按 reader 的 `GLOSSARY.md`，
> **图源**指一个在线源站；**源配置**指它的镜像表、域名、UA、限流、tab 等配置形状。
> 本仓每个目录承载的是**一个图源的源配置**，不是可执行的抓取逻辑。

## 订阅地址

```
https://raw.githubusercontent.com/Rainbow609/manbo-sources/main/index.json
```

在 App 里：**设置 → 图源 → 图源订阅地址** 填入上面的链接 → 同步。
清单拉取后，App 按条目 `pkg` / `name` 模糊匹配到内置图源，据此决定「可用图源列表」
并应用条目里可选的 `config` 热更。

> debug 包另有内置的默认订阅地址（`SourceSubscription.DEBUG_DEFAULT_URL`），当前仍指向
> 第三方 manxia 仓库；切换与本仓同步属于 reader 侧改动，见下文「与 reader 的关系」。

## 这个仓库和 manxia 图源仓库有什么不同

参考仓库 [manxia-extensions-source](https://github.com/DaLongZhuaZi/manxia-extensions-source)
的 `source.json` 里装的是 **WebView workflow 脚本**——漫匣的图源引擎在运行时解释它。

纸飞机的图源是**编译进 App 的 ArkTS 实现**（`services/XxxService.ets`，见 ADR-0001）。
因此本仓库的 `config.json` **不是**可执行的抓取逻辑，而是：

| 内容 | 作用 | 谁来消费 |
| --- | --- | --- |
| `metadata` / `sources[]` | 条目展示与识别（名称、站点、语言、分级） | `SourceSubscription` / `OnlineSourceView` |
| `config`（可选） | 源配置（镜像线路、UA、限流、筛选 tab、能力、线路展示名等） | `SourceConfigMerger` / `SourceCapabilityResolver` |

换言之：**改配置免发版，改解析逻辑仍要发版**（逻辑在 App 里，且必须可单测）。

## 仓库结构

```
manbo-sources/
├── index.json                       # 图源清单（由脚本生成，勿手改）
├── scripts/build-index.mjs          # 采集各源 config.json → 生成/校验清单
├── com.manbo.source.<key>/          # 每个图源一个目录，目录名 = pkg
│   └── config.json                  # 源配置（metadata + sources + 可选 config）
└── ...
```

- 目录名必须等于该源 `metadata.id`，形如 `com.manbo.source.<key>`。
- `<key>` 必须落在 reader 的 `ONLINE_SOURCE_IDS` 权威清单内，且 `pkg` 要包含该 key
  —— reader 按 `pkg`/`name` 模糊匹配内置源，key 对不上就不会被识别。
- 当前收录 reader 内置的 **18 个在线图源**；`komga` 是个人云书库、不在此列。

## 新增或修改图源

```bash
# 1. 编辑 com.manbo.source.<key>/config.json
# 2. 重新生成清单
node scripts/build-index.mjs
# 3. 校验（CI 同款）
node scripts/build-index.mjs --check
```

约束（脚本会校验）：

- `metadata.id` == 目录名；`metadata.type` 必须是 `manga`；`metadata.nsfw` 必须是布尔。
- `sources` 非空，每条至少 `name` + `baseUrl`。
- `config` 若出现必须是非空对象，否则会告警（reader 侧会忽略）。
- `config.mirrorLabels`（可选）必须是「线路原值 → 展示名」的对象，键必须出现在 `config.mirrors` 里。
- 18+ 判定以 reader 的 `OnlineSourceView.ADULT_SOURCES` 为准；
  `pica / jinman / jcomic / manwa / wnacg / ehentai / roumanwu / pixiv` 标 `nsfw: true`。
  `nsfw` 字段只用于描述，未成年人模式的隐藏由 App 侧固定清单决定。

## `config` 热更字段（可选）

`config` 对应 reader 的 `SourceConfig`，字段级合并语义：

- 标量 `apiBase` / `imageBase`：有值即覆盖。
- 数组 `mirrors` / `mirrorGroups` / `tagFilters` / `homeTabs`：**整体替换**。
- 对象 `headers` / `rateLimit` / `capabilities`：按子字段深合并。
- 映射 `themeMap`：按键级深合并。
- 未知字段、类型非法的字段：丢弃（不报错）。

可用子字段：

| 字段 | 形状 |
| --- | --- |
| `mirrors` | `string[]`（首个为默认线路） |
| `mirrorGroups` | `string[][]`（按梯队并发竞速） |
| `apiBase` / `imageBase` | `string` |
| `headers` | `{ userAgent?, imageUserAgent?, extra?: Record<string,string> }` |
| `rateLimit` | `{ maxConcurrentImages?, defaultRetryAfterMs?, maxImageAttempts?, maxRetryAfterMs? }` |
| `tagFilters` | `[{ key, name, defaultValue, options: [{ value, label }] }]` |
| `homeTabs` | `[{ key, label, request: { path, query? } }]` |
| `themeMap` | `Record<string,string>` |
| `mirrorLabels` | `Record<线路原值, 展示名>`（线路弹层展示名；缺省回退显示线路原值） |
| `capabilities` | `{ label?, comments?, tagSearch?, authorSearch?, authorPaged?, placeholderAuthor?, multiTag? }` |

### 镜像线路（在本仓维护）

以下 10 个源的镜像线路**以本仓为准**，订阅者改这里即可免发版生效：

| 源 | 线路数 | 说明 |
| --- | --- | --- |
| `copy` 拷贝漫画 | 12 | 11 条境内 + 1 条国际，**必须同时给 `mirrors` 与 `mirrorGroups`** |
| `jinman` 禁漫天堂 | 6 | |
| `manwa` 漫蛙 | 6 | |
| `baozi` 包子漫画 | 5 | |
| `wnacg` 绅士漫画 | 4 | |
| `goda` GoDa漫画 | 5 | 与图像站同源的全站镜像 |
| `komiic` Komiic | 2 | 大陆可直连线路优先 |
| `roumanwu` 肉漫屋 | 2 | |
| `pixiv` Pixiv | 1 | |
| `pica` 哔咔漫画 | 1 | |

- 当前 reader 内置线路与本仓 `config` 逐值一致；`BUILTIN_SOURCE_CONFIGS` 是**离线兜底**，
  发版时应与本仓同步（见 AGENTS.md 检查清单）。
- `copy` 只给 `mirrors` 不给 `mirrorGroups` 会把「境内 → 国际」两队竞速**降级为单队**。
- `copy` 另带 `mirrorLabels`（国际服 / 大陆专线1… / 热辣漫画 线路N）；`pica` 标注「官方线路」。
  其余源不写 `mirrorLabels` 时，reader 回退展示 `线路N (host)`。
- ⚠️ **已知缺口**：reader 目前**不消费** `mirrorLabels`，「强制锁定线路」弹层仍读
  `Index.ets` 里的 9 张硬编码表（`COPY_MIRRORS` / `JINMAN_MIRRORS` / `MANWA_MIRRORS` /
  `ROUMANWU_MIRRORS` / `WNACG_MIRRORS` / `BAOZI_MIRRORS` / `GODA_MIRRORS` /
  `KOMIIC_MIRRORS` / `PICA_MIRRORS`），且 jinman / wnacg 的弹层线路与内置配置本就不同。
  让弹层改读生效源配置归 reader 侧改动（弹层读配置 + `mirrorLabels` + `DEBUG_DEFAULT_URL`
  一并处理，见 reader ADR-0011 与票 A）。

> ⚠️ **其余 `config` 仍是覆盖**：除镜像线路外，只在确实要盖过 App 内置默认时才声明；
> App 内置已修好的值不要在这里复述，否则内置更新会被陈旧覆盖挡住。
> 数组字段（`tagFilters`/`homeTabs`）尤其如此。

## 与 reader 的关系

- 消费链路：`SourceSubscription.fetchAndApply()` → `AppStorage.importedExtensionsStr`
  → `OnlineSourceView.parseSources()`（可用列表）+
  `SourceConfigMerger.resolveSourceConfigs()`（配置热更）+ `SourceCapabilityResolver`（能力）。
- **线路的权威编辑入口是本仓**；reader 的 `BUILTIN_SOURCE_CONFIGS` 是离线兜底，发版时同步。
  其余源配置字段仍是覆盖通道。
- 待办（reader 侧）：弹层改读生效源配置、消费 `mirrorLabels`、`DEBUG_DEFAULT_URL` 切到
  `.../main/index.json`。
- 清单条目结构以 reader `SourceSubscription.ets` 文件头注释与
  `docs/adr/0001-source-refactor-shape.md` 为准。

## 边界

- 本仓库只存图源**元数据与配置**，不含任何漫画内容、账号、Cookie 或密钥。
- 镜像域名会失效、站点会改版；配置热更能救的只是「配置形状」类变化。
