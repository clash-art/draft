# 示例：工业界如何做 Agent 自进化（小红书长文）

完整的小红书长文草稿，可直接载回工作台继续编辑或导出。

- `article.md` / `editor.json`：源稿（10 张正文配图、1 张封面图、21 条参考资料）。
- `channels/xiaohongshu.json`：小红书渠道版本。`format: longform`，正文与源稿一致，图片含封面，模板为「刊物」（`xhs-folio`）。分页图片未入库（`render_pending: true`），载入后在工作台点“导出”即可生成。
- `layouts/<模板 id>.json`：三个内置模板的分页结果（总页数、各章起始页、每页的配图、参考条目和填充率），用于回归对比。
- `images/`：正文与封面素材。

载入（默认写入本机工作台目录，已有同 id 内容时需加 `--force`；不会读取或写入任何凭据）：

```bash
python scripts/load_example.py examples/xhs-longform-agent-self-evolution
```

重新渲染所有模板的分页 PNG 并刷新 `layouts/`（临时工作区，不影响本机数据）：

```bash
python scripts/render_xhs_pages.py --out work/xhs-pages
for t in xhs-folio xhs-brief xhs-note; do cp work/xhs-pages/$t/layout.json examples/xhs-longform-agent-self-evolution/layouts/$t.json; done
```
