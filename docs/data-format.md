# 战役数据格式

一场战役 = `data/campaigns/<id>/` 目录。除 `campaign.yaml` 外，其余文件都是数组，可省略。

```
campaign.yaml   元数据、阵营(sides)、章节(chapters)
units.yaml      部队及其轨迹
events.yaml     事件
arrows.yaml     进攻/撤退/机动箭头
areas.yaml      控制区/战线（随时间阶跃切换的多边形）
sources.yaml    参考来源
```

字段的权威定义在 [`src/schema/campaign.ts`](../src/schema/campaign.ts)，语义校验规则在 [`src/schema/validate.ts`](../src/schema/validate.ts)。
这里只讲约定。校验：`npm run data:validate`。

## 文本

`Localized` 类型：直接写中文字符串，或写 `{ zh: ..., en: ... }`。界面中文为主，英文可选。

## 时间

ISO 8601 扩展格式，一律当作**当时当地的墙上时钟**，引擎不换算时区：

| 写法               | 精度                         |
| ------------------ | ---------------------------- |
| `1935`             | 年                           |
| `1935-01`          | 月                           |
| `1935-01-29`       | 日（动画中视为当天正午到达） |
| `1935-01-29T06:30` | 分钟                         |

- 可用 `precision` 显式指定更粗的精度（`minute | hour | day | month | season | year`），不能比字符串本身更细。
- 公元前用天文纪年：公元前 216 年写作 `-0215`。
- 1582 年前的日期请换算成格里高利历，并把原始历法记在 `note` 里。
- 事件从其时间区间的起点开始显示；路径点在其区间的中点“到达”。

## 可信度 `confidence`

| 值              | 含义           | 界面           |
| --------------- | -------------- | -------------- |
| `documented`    | 有直接史料记载 | 实线           |
| `reconstructed` | 由史料合理还原 | 实线，带细边   |
| `approximate`   | 大致位置/时间  | 虚线           |
| `conjectural`   | 有争议或推测   | 点线，图例注明 |

部队轨迹中，一段路线的可信度取其两端路径点中**较差**的一个。
地图默认只画各部队**已走过**的路线（不剧透），完整路线可在侧栏勾选显示。

## 部队与轨迹

```yaml
- id: red-junwei
  side: red
  name: 中革军委纵队
  short: 委 # 地图图标里显示的一字/二字简称，缺省取名称首字
  kind: headquarters # infantry / cavalry / armor / artillery / headquarters / mixed / fleet / other
  track:
    waypoints:
      - t: '1935-01-27'
        pos: [105.993, 28.284] # [经度, 纬度]
        confidence: documented
        place: 土城
        note: 军委抵达土城
        sources: [wiki-sidu]
      - t: '1935-01-29'
        pos: [105.993, 28.284] # 位置不变 = 停留
        via: [[105.98, 28.29]] # 可选：从上一点到本点途中经过的点（沿道路/河流）
        confidence: documented
  lifespan: { from: '1935-01-28', to: '1935-01-29' } # 可选：只在该窗口内显示
```

- 相邻路径点之间**按弧长匀速**移动；两点位置相同表示停留。
- 路径点时间必须不倒退；速度异常会给出 warning。
- 只有零星记载的部队（比如某次战斗的对手），用 `lifespan` 限定出现时段，**不要编造窗口之外的位置**。

## 事件、箭头、区域、章节

- `events`：`t`、`pos`、`kind`（battle / crossing / conference / occupation / march / other）、`title`、`body`；`until` 可选，缺省停留至少 12 小时（或其精度区间）。
- `arrows`：`from`、`to`、`path`（折线）；从 `from` 起逐步画出，画完后再显示约一天。
- `areas`：`keyframes: [{t, geometry}]`，`geometry` 为 GeoJSON `Polygon` / `MultiPolygon`，为 `null` 表示该区域消失；相邻快照之间阶跃切换（史料通常只有快照）。
- `chapters`：`start`、`end`、`hoursPerSecond`（该章 1× 速度下每真实秒经过多少历史小时）、`camera`、`narration`。

## 来源

```yaml
- id: book-czs
  citation: 中共中央党史研究室第一研究部：《红军长征史》，中共党史出版社，2006 年。
  kind: secondary # primary / secondary / reference
  license: 仅引用事实 # 该来源内容自身的授权情况
```

已发布（`status: published`）的战役，`documented` / `reconstructed` 的数据缺来源会报 error；草稿阶段报 warning。

约定：`id` 以 `geo-` 开头的来源是**坐标出处**（例如 `geo-osm`、`geo-wiki`、`geo-estimate`），
地图详情面板会把它们单独折叠，史料来源排在前面。
