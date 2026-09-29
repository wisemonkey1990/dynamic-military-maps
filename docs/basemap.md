# 底图

底图只作“地形参照”：淡纸色、山林、水系、主要道路与省县界；**不含任何文字**。
历史地名由我们按史料自己叠加（避免今名与史实混淆，也无需字体文件）。

## 自托管切片

- 文件：`public/tiles/basemap.pmtiles`（约 12 MB，Protomaps 矢量瓦片，z0–z10，川黔滇范围 `101.5,24.5,108.5,29.5`）。
- 随站点一起部署，浏览器通过 HTTP Range 请求按需读取，**不依赖任何境外地图服务**。
  静态托管必须支持 Range 请求：GitHub Pages、腾讯云 COS/CDN、Nginx 默认都支持。
- 超过 z10 的缩放由 MapLibre 过采样。

## 重新生成或扩大范围

需要 Python 3 和 `pip install pmtiles requests`：

```bash
python scripts/basemap/extract.py 20260928 public/tiles/basemap.pmtiles \
    --bbox 101.5,24.5,108.5,29.5 --maxzoom 10
```

第一个参数是 Protomaps 每日构建的日期（<https://maps.protomaps.com/builds/> 可查看可用日期）。
脚本只用 Range 请求读取范围内的瓦片，不会下载上百 GB 的完整文件。新增战役若超出当前范围，就调整 `--bbox`。
z11 会使文件增大数倍，非必要不要提高。

## 授权与署名

瓦片数据来自 OpenStreetMap（ODbL 1.0），由 Protomaps 加工。地图右下角的署名
“Protomaps © OpenStreetMap” 必须保留。这份底图数据不适用本仓库的 CC BY-SA 战役数据许可，
遵循其自身的 ODbL 条款。
