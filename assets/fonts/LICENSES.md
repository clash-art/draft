# 页面字体与授权

小红书长文分页图只用这里打包的字体排版和导出：渲染前按页面文字加载用到的字体切片，导出 PNG 时把同一批切片嵌入图片，不会换成本机系统字体。只有打包字体没有的极少数生僻字才会落到系统字体，渲染结果的 `font_fallback` 会列出这些字。

所有字体均为 SIL Open Font License 1.1，可以免费商用、嵌入和随插件分发。授权全文在 `licenses/`。

| 页面字族 | 字体 | 字重 | 授权 | 用在 |
|---|---|---|---|---|
| Draft Sans SC | Noto Sans SC（思源黑体） | 400 / 700 | OFL 1.1（保留名 "Source"） | 无衬线正文与标题：蓝图、推文、线稿、图文、开发日志、画布、分册、大字正文 |
| Draft Inter | Inter | 400 / 700 | OFL 1.1 | 与 Draft Sans SC 搭配的西文和数字 |
| Draft Serif SC | Noto Serif SC（思源宋体） | 400 / 700 | OFL 1.1 | 宋体标题与正文：蓝图、线稿、图文、转述的标题，随笔与转述的正文 |
| Draft Rounded SC | Resource Han Rounded CN（资源圆体） | 400 / 700 | OFL 1.1（保留名 "Source"） | 手绘的封面标题和全部内页 |
| Draft Smiley | Smiley Sans Oblique（得意黑） | 400 | OFL 1.1（保留名 "Smiley"、"得意黑"） | 大字的封面与章节大标题 |
| Draft Mono | JetBrains Mono | 400 / 700 | OFL 1.1 | 编号、页码、小标签 |

说明：

- 中文字体按 Google Fonts 简体中文的常用字频切片（`unicode-range`），一页通常只用到十几个切片。西文字体只保留拉丁字符，弯引号、省略号、破折号和间隔号仍用中文字体的字形。
- 切片属于 OFL 所说的修改版本。思源黑体和资源圆体只保留 "Source" 这个名字，切片后的字体没有用这个名字，页面里也只用 Draft 开头的内部字族名。得意黑保留了自己的字体名，所以直接使用官方 woff2，没有改动。
- 重新生成：`pip install fonttools brotli py7zr` 后运行 `python scripts/build_fonts.py`。源文件下载到 `work/font-src/`，不入库。
