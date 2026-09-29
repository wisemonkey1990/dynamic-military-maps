#!/usr/bin/env python3
"""
从 Protomaps 每日构建（OpenStreetMap 数据，ODbL）中抽取一个区域，生成自托管用的小体积 PMTiles。

    pip install pmtiles requests
    python scripts/basemap/extract.py 20260928 public/tiles/basemap.pmtiles \
        --bbox 101.5,24.5,108.5,29.5 --maxzoom 10

只通过 HTTP Range 请求读取需要的瓦片，不下载整个（上百 GB 的）星球文件。
"""
import argparse
import math
import sys
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

import requests
from pmtiles.reader import Reader
from pmtiles.tile import zxy_to_tileid
from pmtiles.writer import Writer


def lonlat_to_tile(lon, lat, z):
    n = 2**z
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("build", help="构建日期，如 20260928（https://build.protomaps.com/<日期>.pmtiles）")
    ap.add_argument("out")
    ap.add_argument("--bbox", required=True, help="西,南,东,北")
    ap.add_argument("--maxzoom", type=int, default=10)
    ap.add_argument("--workers", type=int, default=16)
    args = ap.parse_args()

    west, south, east, north = map(float, args.bbox.split(","))
    url = f"https://build.protomaps.com/{args.build}.pmtiles"
    session = requests.Session()
    cache, lock = {}, Lock()

    def get_bytes(offset, length):
        key = (offset, length)
        with lock:
            if key in cache:
                return cache[key]
        r = session.get(url, headers={"Range": f"bytes={offset}-{offset + length - 1}"}, timeout=60)
        r.raise_for_status()
        data = r.content
        if len(cache) < 4000 and length < 4_000_000:
            with lock:
                cache[key] = data
        return data

    reader = Reader(get_bytes)
    src_header = reader.header()
    metadata = reader.metadata()
    print("源：", url, "| 压缩:", src_header["tile_compression"], "| 类型:", src_header["tile_type"], file=sys.stderr)

    coords = []
    for z in range(0, args.maxzoom + 1):
        x0, y1 = lonlat_to_tile(west, south, z)  # y 向下增长：南边 y 大
        x1, y0 = lonlat_to_tile(east, north, z)
        coords += [(z, x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
    print(f"待读取瓦片 {len(coords)} 个", file=sys.stderr)

    def fetch(zxy):
        return zxy, reader.get(*zxy)

    tiles = []
    with ThreadPoolExecutor(args.workers) as pool:
        for i, (zxy, data) in enumerate(pool.map(fetch, coords), 1):
            if data:
                tiles.append((zxy_to_tileid(*zxy), data))
            if i % 100 == 0:
                print(f"  {i}/{len(coords)}", file=sys.stderr)
    tiles.sort(key=lambda t: t[0])

    header = {
        "tile_type": src_header["tile_type"],
        "tile_compression": src_header["tile_compression"],
        "min_lon_e7": int(west * 1e7),
        "min_lat_e7": int(south * 1e7),
        "max_lon_e7": int(east * 1e7),
        "max_lat_e7": int(north * 1e7),
        "center_zoom": 7,
        "center_lon_e7": int((west + east) / 2 * 1e7),
        "center_lat_e7": int((south + north) / 2 * 1e7),
    }
    metadata = dict(metadata)
    metadata["attribution"] = '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>'
    with open(args.out, "wb") as f:
        w = Writer(f)
        for tileid, data in tiles:
            w.write_tile(tileid, data)
        w.finalize(header, metadata)
    print(f"完成：{len(tiles)} 个瓦片 → {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
