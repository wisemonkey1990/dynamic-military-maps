# 战史地图 · Dynamic Military Maps

把历史上真实发生的军事行动，在地图上按时间**动态展示**出来：部队沿真实路线移动、战线推进、
关键战斗依次发生；每个数据点都标明**时间精度、可信度和来源**。

> 当前状态：**早期开发**。地图播放页已可用，收录两场战役：《四渡赤水》（1935，按日）和《官渡之战》（200，按月，含农历折算），
> 两者数据都是**待审核草稿**，请勿当作定论。规划见 [`docs/PLAN.md`](docs/PLAN.md)。

## 特色

- **状态是时间的纯函数**：`getSnapshot(战役, t)` 给出任意时刻的全部状态，倒放、拖动、分享某一刻都零成本。
- **诚实的史料表达**：每个点带 `precision`（精确到分钟/日/月/年）与 `confidence`（有据可查 → 推测），界面用实线/虚线区分。
- **数据即文本**：一场战役是一个 YAML 目录，用 Git 管理，PR 审阅，构建时自动校验。
- **好用的导航**：章节、事件列表、选中部队高亮完整路线；分享链接会带上时刻、地图视野和选中的对象。
- **纯静态部署**：无后端；GitHub Pages 起步，之后迁移到自有服务器。底图是自托管的区域切片，不依赖境外地图服务。

## 快速开始

需要 Node.js ≥ 20。

```bash
npm install
npm run dev          # 校验并构建数据，启动开发服务器
npm test             # 引擎、地图映射与数据校验的单元测试
npm run e2e          # 端到端冒烟测试（Playwright，会先构建并启动预览；首次需 npx playwright install chromium）
npm run lint && npm run typecheck && npm run format:check
npm run data:validate  # 只校验 data/campaigns
npm run build        # 生产构建，输出 dist/
```

部署到子路径（如 GitHub Pages）时设置 `VITE_BASE=/<仓库名>/`；部署到域名根路径无需设置。

## 目录

```
data/campaigns/<id>/   战役数据（YAML），格式见 docs/data-format.md
src/engine/            纯逻辑引擎：时间解析、轨迹插值、getSnapshot、虚拟时钟（零依赖）
src/schema/            数据 schema（zod）与语义校验
src/map/               地图（MapLibre GL JS + 自托管 PMTiles 底图）：图层、标记、GeoJSON 映射
src/ui/                页面：时间轴、章节、详情面板、图例
public/tiles/          自托管底图切片（见 docs/basemap.md）
scripts/               数据加载、校验、构建脚本；scripts/basemap 生成底图切片
docs/                  规划、数据格式、底图说明
```

## 参与贡献

欢迎补充、纠正战役数据，或提交新战役！请先阅读 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 许可

- 代码：[MIT](LICENSE)
- 战役数据（`data/`）：[CC BY-SA 4.0](data/LICENSE.md)
