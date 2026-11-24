# AGENTS.md — manbo-sources

manbo 系列阅读器「纸飞机」（`manbo-reader`）的图源订阅仓库。托管 `index.json`
清单与每源 `config.json` 源配置；**不含抓取逻辑、不含漫画内容**。

全局规范（行为准则 / 子代理 / Git / 记忆）以用户级 `~/.claude/AGENTS.md` 为准，本文件只写单仓约定。

## 职责边界

- ✅ 维护图源清单、每源元数据、可选的配置热更（`config`）。
- 🚫 不写抓取/解析逻辑——图源的 ArkTS 实现在 `manbo-reader/services/`，改逻辑去 reader，走它的构建 + 单测。
- 🚫 不放漫画内容、账号、Cookie、密钥。
- 词汇统一用「图源」。

## 结构约定

- 每个图源一个目录，目录名 = `metadata.id` = `com.manbo.source.<key>`。
- `<key>` 必须在 reader `ONLINE_SOURCE_IDS` 清单内，且 `pkg` 包含该 key（reader 按 pkg/name 模糊匹配）。
- `index.json` 是**生成产物**，单一真源是各 `config.json`；改完必跑 `node scripts/build-index.mjs`。
- 顺序由 `scripts/build-index.mjs` 的 `ORDER` 锁定（与 reader `ONLINE_SOURCE_IDS` 对齐），不要手改清单顺序。
- 镜像线路（`copy`/`jinman`/`manwa`/`baozi`/`wnacg`/`goda`/`komiic`/`roumanwu`/`pixiv`/`pica` 的 `config.mirrors`）**以本仓为权威编辑入口**；reader 内置是离线兜底，发版时同步。`copy` 必须同时维护 `mirrorGroups`；`mirrorLabels` 只给需要非序号展示名的源（copy、pica），缺省由 reader 回退 `线路N (host)`。
- ⚠️ reader 目前不消费 `mirrorLabels`，「强制锁定线路」弹层仍读 `Index.ets` 的 9 张硬编码表；让弹层改读源配置归 reader 侧改动（ADR-0011 / 票 A）。

## 常用命令

```bash
node scripts/build-index.mjs          # 重新生成 index.json
node scripts/build-index.mjs --check  # 校验（CI 同款，失败退出码 1）
```

## 改动检查清单

- [ ] `metadata.id` == 目录名，且 key 在 `ONLINE_SOURCE_IDS` 内
- [ ] `metadata.type == "manga"`，`nsfw` 是布尔
- [ ] `sources[]` 非空，每条有 `name` + `baseUrl`
- [ ] 镜像线路在本仓维护，且与 reader 内置兜底一致；改 `copy` 时 `mirrors` 与 `mirrorGroups` 同步更新
- [ ] 其余 `config`（若有）是非空对象，且没有复述 App 内置已修好的值（热更是覆盖不是补丁）
- [ ] 跑过 `node scripts/build-index.mjs --check`
- [ ] 提交信息用简体中文，`<type>(<scope>): <描述>`；`main` 禁直推，走功能分支

## 与 reader 的关系

消费链路、清单格式、`config` 字段语义见 `README.md` 与 `manbo-reader` 的
`services/SourceSubscription.ets`、`utils/source/SourceConfigMerger.ets`、`docs/adr/0001-source-refactor-shape.md`。
跨仓边界以 manbo-home `docs/manbo-projects.md` 为准。
