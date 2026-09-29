# 参与贡献

感谢你愿意帮忙！本项目接受两类贡献：**战役数据**和**代码**。

## 战役数据

数据是本项目的核心，也是最需要人手的地方。

1. 读 [`docs/data-format.md`](docs/data-format.md)，了解目录结构与字段。
2. 新战役放在 `data/campaigns/<战役id>/`，`id` 用小写字母、数字、连字符，且与目录名一致。
3. **每个数据点都要诚实标注：**
   - `precision`：时间精度（史料只说“某月”就别写成具体日期）。
   - `confidence`：`documented` 有直接史料 → `reconstructed` 合理还原 → `approximate` 大致 → `conjectural` 推测。
   - `sources`：引用 `sources.yaml` 中登记的来源。**没有来源的 documented / reconstructed 数据不能发布。**
4. 提交前运行 `npm run data:validate`，处理所有 error，并认真对待 warning（速度异常、坐标出界等往往意味着录入错误）。
5. 新战役初始 `status: draft`；经至少一位不是作者的人审阅后改为 `reviewed`；发布前改为 `published`。

### 叙述与来源规范

- 用事实性语言，避免情绪化定性；各方说法不一致时并列写明，不要只取一种。
- 伤亡、兵力等数字各书不一致时，宁可不写，或注明来源和差异范围。
- 地名以当时称谓为主，必要时附现称。
- **版权**：只提交你自己撰写的内容，或公有领域 / 与 CC BY-SA 4.0 兼容的内容；不要粘贴受版权保护的书籍/文章原文。引用的图片、地图须在 `sources.yaml` 登记授权。

### 授权

向 `data/` 提交内容，即表示你同意以 [CC BY-SA 4.0](data/LICENSE.md) 授权；向代码提交内容，即表示你同意以 [MIT](LICENSE) 授权。请在提交信息中加入 `Signed-off-by:`（`git commit -s`），表示你有权这样授权。

## 代码

```bash
npm install
npm test && npm run lint && npm run typecheck && npm run format:check
npm run e2e   # 改动了界面或地图时运行；首次需 npx playwright install chromium
```

- `src/engine/` 必须保持**零依赖、无 DOM、无地图库**，并配单元测试；引擎是纯函数，新增逻辑请同样保持纯函数。
- 提交 PR 前，让以上命令全部通过（CI 会做同样的检查，包括端到端测试）。
- 修界面 bug 时，尽量补一条 `e2e/` 用例：样式、地图 worker、标记定位这类问题，单元测试抓不到。
- 改动尽量小而聚焦；较大的改动请先开 issue 讨论。
