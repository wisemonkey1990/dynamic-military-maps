# 数据授权

`data/` 目录下的战役数据（YAML 文件及其中的文字、坐标整理成果）以
**知识共享 署名-相同方式共享 4.0 国际许可协议（CC BY-SA 4.0）** 发布：
<https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hans>，完整法律文本见
[`LICENSE-CC-BY-SA-4.0.txt`](./LICENSE-CC-BY-SA-4.0.txt)。

署名方式：注明 “战史地图（Dynamic Military Maps）贡献者”，并附本仓库链接。

仓库中的**程序代码**（`src/`、`scripts/` 等）按 MIT 许可证发布，见根目录 `LICENSE`。

## 为什么数据用 CC BY-SA

- 历史事实本身不受版权保护，但数据的组织、表述和整理工作受保护；BY-SA 保证他人改进后的版本同样保持开放。
- 与本项目大量引用的中文维基百科（CC BY-SA 4.0）在授权上互相兼容。

## 第三方素材

- 每一条数据引用的资料及其授权登记在对应战役的 `sources.yaml`。
- 部分坐标经 OpenStreetMap（ODbL 1.0）检索得到，见 `geo-osm` 来源条目；其属地名点位的事实信息，
  相关来源保留署名 “© OpenStreetMap contributors”。若将来直接导入 OSM 的几何数据（河流、道路等），
  须单独存放并遵守 ODbL。
- 提交贡献时，请只提交你自己创作的内容，或公有领域 / 与 CC BY-SA 4.0 兼容的内容，并在 `sources.yaml` 中登记出处与许可。

## 例外：底图切片

`public/tiles/basemap.pmtiles` 不属于战役数据，它是 OpenStreetMap（ODbL 1.0）的衍生数据库，
经 Protomaps 加工，遵循其自身条款，见 [`docs/basemap.md`](../docs/basemap.md)。
