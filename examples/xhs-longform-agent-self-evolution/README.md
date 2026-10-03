# 示例：工业界如何做 Agent 自进化（小红书长文）

小红书长文草稿示例，可直接载回工作台继续编辑或导出。源稿保持完整，渠道版本是 Agent 按“10 页以内”要求写的精简版。

- `article.md` / `editor.json`：完整源稿（10 张正文配图、1 张封面图、21 条参考资料），不修改。
- `xiaohongshu-condensed.md`：小红书精简版正文（约 3.6k 字，源稿约 7.5k 字），按插图顺序组织，`<!-- page -->` 指定分页。
- `channels/xiaohongshu.json`：小红书渠道版本。`format: longform`、`condensed: true`，body 为上面的精简正文，images 为其中的 5 张原图加 2 张总览图放大裁切（`c1a0…`、`c2b1…`，只用于精简版），`cover_page` 为封面文字（主副标题 + 署名，不放要点），模板为「蓝图」（`xhs-blueprint`），不传 `palette`，用模板自带配色。
- `channels/wechat.json`：公众号渠道版本，完整正文，模板为「蓝图」（`blueprint`），同样用模板自带配色。分页图片未入库（`render_pending: true`），载入后在工作台点“导出”即可生成。
- `layouts/<模板 id>.json`：七个内置长文模板的分页结果（总页数、各章起始页、每页的配图、参考条目和填充率），用于回归对比。
- `images/`：正文与封面素材。

精简版页面规划（封面 + 9 页，正好 10 张图）：

| 页 | 内容 |
|---|---|
| 1 | 封面：大标题、副标题、署名，不放图 |
| 2 | 总览图（通栏）+ 导语 |
| 3 | 总览图两处放大（通栏） |
| 4 | 01 先验证（学术界做法，参考 1–9） |
| 5 | 02 上线 + 订单案例图 |
| 6 | 03 挖问题 + Adaline 聚类图 |
| 7 | Braintrust 与 Adaline 流程图（通栏）+ 两条路径 |
| 8 | 04 改权重 + SDPO++ 图（通栏） |
| 9 | 05 下一轮：A/B 与灰度 |
| 10 | 参考资料（全部 21 条，短格式） |

精简时省略了源稿图 2、6、7、8、10 及其说明，它们仍在源稿中。

配色：不取文中项目的品牌色。每套模板自带淡雅、低饱和的莫兰迪配色（白、冷浅灰或很淡的莫兰迪纸面，深色文字，一种点缀色），插图按模板色调降低饱和度。示例渠道版本不传 `palette`；`palette` 只是可选覆盖，同样要求低饱和。

载入（默认写入本机工作台目录，已有同 id 内容时需加 `--force`；不会读取或写入任何凭据）：

```bash
python scripts/load_example.py examples/xhs-longform-agent-self-evolution
```

重新渲染所有模板的分页 PNG 并刷新 `layouts/`（临时工作区，不影响本机数据）；加 `--full` 按完整源稿排版，加 `--no-palette` 忽略渠道版本里的 palette：

```bash
python scripts/render_xhs_pages.py --out work/xhs-pages
for t in xhs-folio xhs-blueprint xhs-tweet xhs-brief xhs-press xhs-marker xhs-note; do cp work/xhs-pages/$t/layout.json examples/xhs-longform-agent-self-evolution/layouts/$t.json; done
```

公众号手机宽度截图（每套文章模板一张长图 + 首屏切片 + 总览）：

```bash
python scripts/render_wechat_article.py --out work/wechat-article
```
