# 示例：工业界如何做 Agent 自进化（小红书长文）

小红书长文草稿示例，可直接载回工作台继续编辑或导出。源稿保持完整，渠道版本是 Agent 按“10 页以内”要求写的精简版。

- `article.md` / `editor.json`：完整源稿（10 张正文配图、1 张封面图、21 条参考资料），不修改。
- `xiaohongshu-condensed.md`：小红书精简版正文（约 3.6k 字，源稿约 7.5k 字），按插图顺序组织，`<!-- page -->` 指定分页。
- `channels/xiaohongshu.json`：小红书渠道版本。`format: longform`、`condensed: true`，body 为上面的精简正文，images 为其中的 6 张图，`cover_page` 为封面文字（主副标题 + 5 条要点），模板为「蓝图」（`xhs-blueprint`），`palette` 为 Braintrust 配色。
- `channels/wechat.json`：公众号渠道版本，完整正文，模板为「蓝图」（`blueprint`），同一套 Braintrust 配色。分页图片未入库（`render_pending: true`），载入后在工作台点“导出”即可生成。
- `layouts/<模板 id>.json`：七个内置长文模板的分页结果（总页数、各章起始页、每页的配图、参考条目和填充率），用于回归对比。
- `images/`：正文与封面素材。

精简版页面规划（封面 + 9 页）：

| 页 | 内容 |
|---|---|
| 1 | 封面：大标题、副标题、5 条要点，不放图 |
| 2 | 导语 + 图 1（自进化循环） |
| 3 | 01 先验证 + 图 2 |
| 4 | 学术界的做法（参考 3–9） |
| 5 | 02 上线 + 图 3 |
| 6 | 03 挖问题 + 图 4 |
| 7 | 图 5 + 两条改进路径 |
| 8 | 04 改权重 + 图 9（SDPO++） |
| 9 | 05 下一轮：A/B 与灰度 |
| 10 | 参考资料（全部 21 条，短格式） |

精简时省略了图 6、7、8、10 及其说明，它们仍在源稿中。

配色：文章写的是 Braintrust、Adaline、Trajectory 三家的做法，工业界部分由 Braintrust 打头、引用最多，因此取 Braintrust 的品牌色（来自 braintrust.dev 站点 CSS）：

| token | 颜色 | 来源 |
|---|---|---|
| primary | `#2c1fea` | `.border-brand-blue` |
| accent | `#5770ff` | `--blue-500` |
| surface | `#eff4ff` | `--blue-50` |
| paper / rule | `#fafafa` / `#d4d4d8` | `--zinc-50` / `--zinc-300` |
| ink / text / muted | `#18181b` / `#3f3f46` / `#71717b` | `--zinc-900` / `--zinc-700` / `--zinc-500` |

换成其他项目时只改 `palette`，模板不变。

载入（默认写入本机工作台目录，已有同 id 内容时需加 `--force`；不会读取或写入任何凭据）：

```bash
python scripts/load_example.py examples/xhs-longform-agent-self-evolution
```

重新渲染所有模板的分页 PNG 并刷新 `layouts/`（临时工作区，不影响本机数据）；加 `--full` 按完整源稿排版，加 `--no-palette` 用模板默认配色：

```bash
python scripts/render_xhs_pages.py --out work/xhs-pages
for t in xhs-folio xhs-blueprint xhs-tweet xhs-brief xhs-press xhs-marker xhs-note; do cp work/xhs-pages/$t/layout.json examples/xhs-longform-agent-self-evolution/layouts/$t.json; done
```

公众号手机宽度截图（每套文章模板一张长图 + 首屏切片 + 总览）：

```bash
python scripts/render_wechat_article.py --out work/wechat-article
```
