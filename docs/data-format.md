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
  kind: headquarters # infantry / cavalry / armor / artillery / headquarters / mixed / airborne / fleet / other
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

- `events`：`t`、`pos`、`kind`（battle / crossing / conference / occupation / march / landing / airdrop / other）、`title`、`body`；`until` 可选，缺省停留至少 12 小时（或其精度区间）。
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
以 `cal-` 开头的是**历法折算依据**（例如 `cal-sxtwl`）。地图详情面板会把它们合并折叠为
“坐标与日期折算”，史料来源排在前面。

## 分享链接

战役页的地址形如：

```
#/c/<战役id>?t=1935-02-25T12:00&c=106.85,28.03&z=10&s=unit:gz-du-zhaohua
```

| 参数     | 含义                                          |
| -------- | --------------------------------------------- |
| `t`      | 历史时刻（`YYYY-MM-DDTHH:mm`）                |
| `c`、`z` | 地图中心（经度,纬度）与缩放级别，必须同时出现 |
| `s`      | 选中项：`unit:<部队id>` 或 `event:<事件id>`   |

暂停时地址栏会自动更新；侧栏的“复制当前视图的链接”随时生成最新链接。
格式不对、或 `s` 指向不存在的对象时，对应参数会被忽略，页面照常打开。

## 时间尺度不同的战役

四渡赤水的史料精确到日，官渡之战只到月，诺曼底 D 日要到分钟。战役元数据里有几个字段让界面按各自的尺度工作：

| 字段               | 默认  | 作用                                                                                                  |
| ------------------ | ----- | ----------------------------------------------------------------------------------------------------- |
| `displayPrecision` | `day` | 时间读数的精度：`month` / `day` / `hour` / `minute`。`month` 时只显示到月，**不会显示编造出来的“日”** |
| `stepDays`         | `1`   | 时间轴“前进/后退一步”的天数，可以是小数（官渡用 30，按钮显示“一个月”；`1/24` 是“一小时”）             |
| `trailDays`        | `3`   | 部队尾迹长度（天）                                                                                    |
| `lingerDays`       | `1`   | 箭头画完后的停留天数，也是事件最短停留时长的基数                                                      |
| `mapNote`          | 无    | 地图上方常驻、可关闭的提示，用来说明底图与史实不符之处（如古今河道不同）                              |

年份小于 1000 时界面会加“公元”前缀（如“公元200年5月”）。

### 章节级覆盖：同一战役里切换尺度

一个战役里的时间尺度也可以不同：诺曼底 D 日按分钟，D 日之后按天。每个章节可以写 `scale`，逐项覆盖上面四个字段（`displayPrecision`、`stepDays`、`trailDays`、`lingerDays`），没写的项沿用战役的设置：

```yaml
chapters:
  - id: ch2-h-hour
    title: H 时刻：五个滩头
    start: 1944-06-06T05:45
    end: 1944-06-06T13:59
    hoursPerSecond: 0.15
    scale:
      displayPrecision: minute
      stepDays: 0.0104166667 # 15 分钟 = 1/96 天
      trailDays: 0.0416666667
      lingerDays: 0.0625
```

时间轴读数、前进/后退按钮和键盘方向键、尾迹长度、箭头与事件的停留时长，都以“当前时刻所在章节”的尺度为准，越过章节边界时自动切换。
事件的最短停留时长是 `lingerDays × 12 小时`（取事件开始时所在章节的值）；事件写了 `until` 时以 `until` 为准。
写 `stepDays` 等小数时，YAML 里直接写小数（`1/96` 不是合法的 YAML 数字）。

分钟级战役的时间戳要写到分钟（`1944-06-06T07:35`）；引擎不做时区换算，按条目原样记录，并把时区或钟点制式的疑点登记为一个 `cal-` 前缀的来源。

## 农历与古代历法

史料里的农历月份，请折算成公历月写进数据，并把原始说法写进 `note` 或事件说明里。做法参见 `data/campaigns/guandu-200`：

- 用 `sxtwl`（寿星万年历）之类的工具算出每个农历月的初一，**取月中所在的公历月**。
  注意不是简单的“农历月 + 1”：闰月的位置会让个别月份错位（建安六年四月是 201 年 6 月）。
- 找一个有干支记载的日期（如日食）核对折算是否正确，并把方法登记为一个 `cal-` 前缀的来源。
- 东汉实行四分历，与现代推算的朔日可能差几天；只用月精度时不受影响，但要在来源说明里写明。
