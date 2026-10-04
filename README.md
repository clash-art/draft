# 微信草稿助手

Codex 插件：Markdown/HTML → 配图自动上传 → 封面 → 公众号草稿；同时支持正文、图片和排版审核，以及图文数据分析。脚本负责确定性的接口与结构检查，内容/图片语义评价由使用插件的 Codex 完成。

## 安装与运行

在 Codex 的个人插件市场找到 `wechat-drafts` 并安装，然后在新任务中使用。插件目录可整体分享，依赖不随包打入。建议 Python 3.10+（带 OpenSSL）。

在插件目录执行：

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/wechat.py --help
```

可直接对 Codex 说：

- “用微信草稿助手，把这篇 Markdown 和封面存到公众号草稿箱。”
- “审核这篇草稿的正文、配图和手机排版，先给建议。”
- “分析这份公众号数据 CSV，再结合文章内容给优化建议。”
- “读取 9 月 1 日至 7 日的图文数据，比较阅读和分享表现。”

## 页面配置（推荐）

安装依赖后，在插件目录运行：

```bash
.venv/bin/python scripts/config_ui.py
```

浏览器会自动打开本机配置页。填写 AppID 和 AppSecret，点击「保存配置」，再点击「测试已保存的配置」。Codex 也可运行 `--no-browser` 并打开返回的本机网址。页面服务只监听 127.0.0.1；用 Ctrl+C 停止服务，已保存的配置仍然有效。

配置默认保存在 `~/.config/wechat-drafts/credentials.json`，文件权限为 0600，未加密。不会放入插件目录或分享压缩包，也不会把已保存的密钥返回页面。可用 `WECHAT_CONFIG_PATH` 指定独立配置文件。测试连接只验证取得 token，不保证所有业务接口都有权限。

读取顺序：`WECHAT_ACCESS_TOKEN` → 成对的 `WECHAT_APP_ID` / `WECHAT_APP_SECRET` → 页面保存的配置。环境变量只设置一项会报错，不会与页面配置混用。页面连接测试始终使用页面保存的账号。

## 环境变量配置（可选）

本地进程需要 `WECHAT_APP_ID` 与 `WECHAT_APP_SECRET`，也可只提供有效的 `WECHAT_ACCESS_TOKEN`。使用自己的密钥管理器或 shell 环境注入，勿把真实密钥放入文章、插件、聊天或版本库。程序使用 stable_token，force_refresh=false；不将 token 写入结果文件。后台配置实际公网出口 IP 白名单。

草稿管理、素材上传和图文统计是不同权限；已有草稿权限不代表其余接口一定可用。尚未配置真实账号时，prepare 和 analyze-csv 可离线运行。

## 常用命令

以下在插件目录执行，`--out` 路径可自行选择：

```bash
# 离线预检 + HTML 预览，不上传
.venv/bin/python scripts/wechat.py prepare examples/article.md --title '让文章里的图片真正有用' --out work/preview

# 上传正文图及封面，新建草稿；不会发布或群发
.venv/bin/python scripts/wechat.py save examples/article.md --title '让文章里的图片真正有用' --cover examples/cover.png --out work/receipt.json

# 定位与读取已有草稿
.venv/bin/python scripts/wechat.py list --count 20 --offset 0 --out work/drafts.json
.venv/bin/python scripts/wechat.py get MEDIA_ID --out work/draft.json

# 替换指定草稿中的一篇文章：先读取原稿，保留未修改的作者和摘要
.venv/bin/python scripts/wechat.py save article.md --title '标题' --cover cover.png --media-id MEDIA_ID --index 0 --author '作者' --digest '摘要' --out work/update.json

# 在线图文群发每日数据，逐天查询；结束日期必须早于今天
.venv/bin/python scripts/wechat.py analytics --begin 2026-09-01 --end 2026-09-07 --out work/analytics.json

# 分析后台导出的增量数据；累计快照、重复行、合计行先清理到副本
.venv/bin/python scripts/wechat.py analyze-csv examples/metrics.csv --out work/analysis.json

# 离线测试，不接触真实账号
.venv/bin/python -m unittest discover -s tests
```

## 输入与行为

正文图片写为 `![图注](./images/chart.png)`，或 HTML `<img src="./images/chart.png">`。路径相对文章。此版本要求本地图片，不自动下载外网图片，不接受 Base64。图片自动适应方向、缩至最长边 1920px、转换并压缩到小于 1 MB；不支持动图。转换仅用于上传，不修改原图。同一文件在一篇正文内复用上传 URL；跨运行可能重复上传。

封面作为永久 image 素材上传，将 media_id 填到 thumb_media_id。封面与正文引用分开。预览反映本地 HTML，最终以微信后台/手机预览为准。脚本拒绝脚本标签、事件属性等常见不兼容内容，但不是通用 HTML 安全清洗器；只处理可信文章，外部 HTML 应先审核。

更新指定 index 的完整内容；不更新其他文章。保存成功先写回执再回读；更新前另存 `.backup.json`。网络失败可能已在微信完成写入，因此不自动重试。脚本不提供删除或正式发布能力。

## 数据口径

在线接口为 `getarticlesummary`，数据可用时间与覆盖范围以微信实际返回为准。它不代表所有发布内容的完整运营数据。返回空列表不能解释成账号总阅读量为零。

CSV 使用 UTF-8，可保留其他附加字段。支持这些中文列名及对应英文列名：

| 中文 | 英文 |
| --- | --- |
| 日期 | ref_date |
| 标题 / 文章标题 | title |
| 阅读次数 | int_page_read_count |
| 阅读人数 | int_page_read_user |
| 分享次数 | share_count |
| 分享人数 | share_user |
| 收藏次数 | add_to_fav_count |
| 收藏人数 | add_to_fav_user |

只合计明确的次数，不把跨天 UV 相加当去重人数。必须先确认行是无重叠增量数据；累计数据要按文章取匹配观察窗口的快照，不能相加。点赞等字段在 CSV 中存在时由 Codex 按实际口径分析。趋势、图文匹配及优化建议由 Codex 根据 JSON 明细和原文给出。

## 验证边界

附带离线测试与样例。未配置真实公众号凭据时，不声称通过真实账号端到端验证。图片/草稿/数据权限、微信 HTML 兼容性及最新接口约束需要在首次实际使用时确认。

接口参考：[新增草稿](https://developers.weixin.qq.com/doc/offiaccount/Draft_Box/Add_draft.html)、[素材](https://developers.weixin.qq.com/doc/offiaccount/Asset_Management/Adding_Permanent_Assets.html)、[图文分析](https://developers.weixin.qq.com/doc/offiaccount/Analytics/Graphic_Analysis_Data_Interface.html)。

## 白名单 IP 不匹配

运行 `.venv/bin/python scripts/diagnose.py`，使用与插件一致的网络路径调用微信接口；当返回 40164 时，只提取微信看到的出口 IP，提示加入白名单。成功时只报告连通，不推测出口 IP。不会输出 AppSecret、token 或原始错误消息。

第三方查 IP 网站可能与微信走不同出口。网络切换、动态公网地址和代理分流都可能导致 IP 改变。以微信报错提供的 IP 为准；长期自动化宜采用固定公网出口。

## 内容工作台与 MCP

`python scripts/config_ui.py --no-browser` 启动 React + Radix UI + Tiptap 工作台，前端产物已随插件附带，无需 Node 运行。

内容只有三个主状态：**待同步 → 草稿 → 已发布**。编辑、批注、审核和文章数据围绕同一条内容记录。

- 内容工作台：多篇本机文章、可视化编辑与 Markdown/HTML 源码、实时安全预览、选文批注、处理/重新打开批注、原文定位、配图与封面。
- AI 建议嵌入文章详情。复制请求给 Codex 后，通过 MCP `publish_review` 回写；没有假装自动执行的大模型按钮。建议带版本，修改后标记过期。
- 首次同步创建并关联微信草稿；再次同步更新同一篇。可关联现有草稿，也可从草稿箱导入完整正文及图片。同步前检测微信端修改，发现冲突即停止；结果不确定时不盲目重试。
- 微信发布仍在微信后台完成。通过已发布列表关联正式文章；没有该接口权限时，用正式文章链接人工确认。记录标明人工确认，不伪装为接口核验。
- 发布后按 msgid 关联真实图文数据，不自动按同名标题匹配。无权限时导入 CSV；不含 msgid 的 CSV 需明确确认仅含本篇文章，累计快照默认不合计。
- 页面点击「保存本机」后跨刷新持久化，MCP 与页面共用工作区。切换文章前保存；未保存修改刷新前会提示。账号配置、文章、图片和批注不随插件打包。

### MCP

`.mcp.json` 注册 stdio 服务，`scripts/run-mcp.sh` 优先使用 `uv run --script` 安装隔离依赖，也支持插件本地 `.venv`。更新安装后在新 Codex 任务中加载。

20 个工具：状态、草稿读写、待同步文章管理、工作区读写、图片导入、草稿导入、批注、结构检查、AI 建议回写、草稿关联、发布列表/关联、数据关联、接口数据和 CSV 分析。资源：`wechat://workspace`、`wechat://review`、`ui://wechat-drafts/content-workbench`。

典型流程：`pending_articles` → `read_workspace` → 检查原图 → `publish_review`。修复用 `write_workspace` 并传当前 revision；用户要求同步时调用 `save_workspace_to_wechat(expected_revision)`。新建/打开本地文章也必须传当前 revision，避免覆盖另一个页面的更改。导入图片后将 ref 加入 assets 和正文。

本机与 MCP 通过文件锁串行写入，文章版本冲突拒绝覆盖。同步关联按 AppID 隔离，跨账号不会沿用旧草稿编号。同步与发布是不同动作；插件不提供发布/群发/删除入口。

### 开发

```bash
npm ci --prefix frontend
npm run build --prefix frontend
python -m unittest discover -s tests -q
```

前端源码在 `frontend/src/`，构建到 `assets/ui/`。运行中的工作台不要在构建产物清空期间刷新。

实测账号：草稿读取正常；发布列表与统计接口返回 48001，界面如实显示权限错误，并提供正式链接关联和 CSV 回退。开发验证采用隔离假客户端，不为测试向真实公众号新建草稿。

### Linear 界面与原生 MCP App

界面复用用户指定的 taste-saas Linear demo 的 shell 与 token，控件为 Radix UI，图标为 Lucide，缓存为 TanStack Query，正文为 Tiptap。无 Ant Design 依赖。内容列表按「待同步 / 草稿 / 已发布」筛选，文章详情为单栏编辑或预览 + 批注、AI、图片、属性侧栏；窄屏侧栏用抽屉。Cmd/Ctrl+K 跳转，Cmd/Ctrl+S 保存，Cmd/Ctrl+\ 切换导航。

`open_content_app` 提供 MCP Apps 原生交互入口，工具 metadata 关联 `ui://wechat-drafts/content-workbench`，资源 MIME 为 `text/html;profile=mcp-app`。使用官方 `@modelcontextprotocol/ext-apps` SDK 与宿主通信。预览 HTML 和嵌入图片放在工具结果 `_meta`，不向模型回传图片 Base64；模型只拿文章标识、版本、批注、审核与列表。App 不携带账号凭据、不请求 localhost，工具调用通过宿主代理。用户可以选中文本、保存批注、请求 Codex 审核、同步草稿。

原生展示需要宿主支持 MCP Apps 扩展。独立浏览器仍是本机工作台，不能直接向 Codex 对话发消息；界面会明确提示这一限制。不要把最近 MCP 调用当成持续连接证明。

前端构建：`npm ci --prefix frontend`，再运行 `npm run build --prefix frontend` 和 `npm run build:app --prefix frontend`。两个已编译产物都随插件提供。

## 同一内容的渠道版本

内容编辑页 → **渠道版本**：微信长文与小红书笔记各自保存标题、正文、排版/图片顺序和版本号。源内容修改不会覆盖已改编的渠道；微信同步优先使用已保存的微信渠道版本，封面、作者、摘要仍取内容属性。未创建微信渠道版本时，保持原来的同步行为。

小红书连接器为独立实现，仅参考 [xhs_ai_publisher](https://github.com/BetaStreetOmnis/xhs_ai_publisher) 的创作中心登录与填表流程，不依赖其 FastAPI 服务、数据库、桌面 UI 或 AI 生成模块。没有调用声称为小红书官方开放 API 的私有签名接口。

首次使用安装 requirements.txt 中的 Playwright，并安装 Google Chrome。点击「连接小红书」会打开专用 Chrome 会话，用户自行扫码/手机验证；登录态存放于 workspace/xiaohongshu-profile（父目录权限 0700），不会导入系统 Chrome 的其他账号 Cookie。退出/换账号请在该专用浏览器的创作中心操作。

「填写到小红书」上传选中图片并填标题正文，**不点击发布**。填表成功仅标记 filled，不自动视为已发布；用户在小红书核对图片和正文后发布，再粘贴正式笔记链接关联。任务失败或超时保持需要核对的记录，不自动重复提交。网页选择器会随小红书改版失效；错误时保留现场供用户核对。当前支持单个小红书专用登录会话。

MCP 提供 get_channel_edition / save_channel_edition 读写渠道改编。写入需要源内容及渠道双版本校验；浏览器登录和填表入口放在工作台，以避免 MCP 与工作台同时占用专用会话。

### 原稿优先的 Agent 工作流

编辑页以 Markdown 原稿为内容依据，agent_context 独立保存读者、意图和改编要求，不进入发布正文。旧 HTML 不静默重写，点击「转换为 Markdown」先转换到编辑区，再决定保存。

顶部切换原稿 / 公众号 / 小红书。渠道视图先选模板，再「让 Agent 按模板填充」：独立工作台生成可复制给 Codex 的请求（不会假装启动 Agent），Codex 使用 get_channel_brief 获取原稿、上下文、模板、图片和版本约束，再调用 save_channel_edition 回写。渠道页面每 4 秒读取新版本；手动编辑期间不覆盖未保存修改。小红书模板包括实用指南、观点笔记、收藏清单。

模板管理中的「应用到公众号视图」现在仅更新微信渠道模板，不把排版 HTML 写回 Markdown 原稿。登录、关联、发布操作位于渠道视图的「关联与发布」功能区。

### 分渠道模板与账号
文章模板导航下分为公众号模板、小红书模板；小红书支持复制、保存和删除自定义图片模板，编辑画布颜色和 Agent 编排要求。账号连接统一在账号设置。
小红书版本以有序图片为主体，配文独立；MCP `save_channel_edition` 可传 `cards: [{title, text, image_ref}]`，App 使用同一份 HTML 模板预览卡片，并通过 html-to-image 在页面内导出 1080×1440 PNG。后端只保存卡片与图片，不启动浏览器。每页标题上限 50 字、文字上限 240 字，导出时检查溢出。卡片或模板变更会清除旧图片，点击「生成图片」后方可填写发布页；导出回写受渠道版本校验保护。
原稿默认阅读视图；Agent 上下文折叠，编辑 Markdown 显式切换。公众号手动微调使用富文本编辑器。MCP App 中可直接调用宿主 sendMessage；独立 localhost 页面仍不能被当作宿主原生应用，保留提示入口。

### Shared workbench and host messaging

`frontend/src/Workbench.jsx` is the complete UI for both the localhost entry and the MCP resource. `mcp-app.jsx` only establishes the MCP Apps transport and mounts that shared UI; it no longer maintains a separate article interface.

MCP Apps use `App.sendMessage` only after the host declares the `message` capability. The HTTP entry feature-detects the documented `window.openai.sendFollowUpMessage` compatibility API. A browser tab displayed beside a Codex conversation does not itself prove that this API exists. The sidebar reports an unconnected session when it is absent. No copy-to-clipboard action or server-side sampling is presented as successful delivery to the conversation.

The current right-hand localhost page was checked on 2026-09-21 and reported no compatibility message bridge. End-to-end delivery from this panel remains unverified and requires a supported host connection. Updating the plugin files does not reload an already-running MCP server. Native transport changes require the host to reload that server.

Native credential editing is intentionally kept in the existing local account settings; credentials are not routed through tool arguments. App-only workbench tools separate local operations from draft sync and Xiaohongshu preparation.

Native host verification (2026-09-21): the shared workbench declares inline/fullscreen and requests fullscreen only if advertised. Diagnostics record the actual display mode and message capability via app-host.json. PiP is not requested; fullscreen keeps the same host message bridge. Frontend tests: 9 passed; backend tests: 68 passed. Installed version 0.1.0+codex.20260920175550. The existing task still advertises the previous resource URI, so end-to-end host verification requires a fresh host session. Do not claim successful messaging before observing message_accepted.

### Local live UI development

For UI-only iteration, the active installed plugin can read the working tree's rebuilt
`assets/mcp-app/mcp-app.html` without reinstalling or restarting its MCP process:

```sh
python3 scripts/link-live-ui.py --installed /absolute/path/to/installed/wechat-drafts/version --backup /absolute/path/to/local-backups
```

This explicitly opts that installed version into development mode. It backs up the packaged
HTML and replaces only that HTML with a symlink to this checkout. Run `npm run build:app`
in `frontend`, then reopen the native App so the host requests the resource again. It is
not browser HMR: an already rendered iframe does not update automatically. A reinstall
replaces this development link; apply it again if desired. Restore the backup HTML to
leave development mode. Server/tool metadata changes still require a server reload.

On 2026-09-21 the running MCP server returned an added HTML probe and then returned its
removal through the same `content-workbench-fcfb1255397a.html` resource, without a restart.
This verifies live resource loading only; actual host rendering and message delivery
remain separate acceptance checks.

小红书默认长文模式与源稿内容一致，模板切换只影响预览样式。旧卡片模式保留用于明确要求短图文的场景。当前长文可编辑和预览，自动填写长文尚未接通；不会回退到短图文发布入口。

## 本地优先与可选云同步

插件和本机工作台始终先走本机。不配置 Cloudflare 时，Codex / Cursor 仍通过 `.mcp.json` 启动 `scripts/run-mcp.sh`，文章、图片和公众号凭据留在 `~/.config/wechat-drafts/`，断网也能编辑、审核和预览。云端不是插件的必经之路。

Cloudflare 只做两件可选的事：

- **同步。** 把稿件、图片和账号设置送到你自己的 R2 存储，另一台电脑再拉下来。
- **回退入口。** Worker 提供网页工作台，以及一个远程 MCP。只有在你明确设置 `DRAFT_MCP=remote` 时，插件才会改连这个地址。平时不要设。

### 同步什么、冲突怎么处理

每台设备保留一份私有游标 `sync-base.json`（不会上传）。两边都没变就跳过；只有一边变了就跟着那边走；两边都改了同一文件则**两边都保留**，本机文件不动，云端版本另存到 `sync-conflicts/`，命令以状态码 3 结束。之后执行：

```bash
python3 scripts/sync_client.py resolve workspace/editor.json --keep local
python3 scripts/sync_client.py resolve workspace/editor.json --keep remote
```

不同步这些本机状态：小红书 Chrome 登录目录 `workspace/xiaohongshu-profile/`、文件锁、MCP 会话状态。公众号 AppID / AppSecret 默认会同步，因为换一台电脑需要同一套账号设置；不想同步密钥时在配置里写 `DRAFT_SYNC_SECRETS=0`。关掉之后不会再上传，但已经在存储桶里的副本不会自动删除。小红书扫码仍在你自己的电脑上完成，云端页面不会打开 Chrome。

未配置时：

```bash
python3 scripts/sync_client.py status
```

打印「云同步未配置」并退出 0。本机稿件不会被改。配置好了但网络失败时，命令失败并说明本机稿件未改。

### 打开同步

在本机创建 `~/.config/wechat-drafts/hosted.env`，权限 `chmod 600`：

```bash
DRAFT_SYNC_URL=https://clash-art-draft.<account-subdomain>.workers.dev
DRAFT_ACCESS_TOKEN=至少32个字符的访问令牌
```

访问令牌是你自己生成的应用密码，不是 Cloudflare API Token。浏览器打开 `https://<同一主机>/#<同一令牌>`，令牌只留在该标签页的 sessionStorage。插件不读取这个文件，因此同步配置不会把 MCP 改成远程。

示例见 `examples/hosted.env.example`。

### 远程 MCP 只是回退

默认不要改 `.mcp.json`。只有这台机器跑不了本机 Python、又确实要连云端引擎时，才在插件环境里设置：

```bash
DRAFT_MCP=remote
DRAFT_URL=https://clash-art-draft.<account-subdomain>.workers.dev
DRAFT_ACCESS_TOKEN=与网页相同的访问令牌
```

`scripts/mcp_remote.py` 把 stdio MCP 转到 `DRAFT_URL/mcp`。本机图片和表格仍在你的电脑上读取，再把内容交给云端。

### 部署

这次没有部署。Cloudflare 登录不可用，仓库里也没有 API Token。下面的命令留到具备凭据之后再执行，不要把令牌写进 git。

1. 在 Cloudflare 控制台用模板 **Edit Cloudflare Workers** 创建 API Token。该模板已经包含 Workers Scripts、Workers Routes、Workers KV、Workers Tail、**Workers R2 Storage Write**、Account Settings Read、User Details Read、User Memberships Read。
2. 在同一枚令牌上额外加上 **Containers Write**（权限列表里也可能显示为 Containers Edit）。回退引擎跑在 Cloudflare Containers 里，模板本身不含这项。存储桶只做设备同步时，R2 权限已经在模板里。
3. 把账号 ID 放进 Cursor Cloud Agent Secrets，名字用 `CLOUDFLARE_ACCOUNT_ID`。API Token 用 `CLOUDFLARE_API_TOKEN`。
4. 生成应用访问令牌并写成 Worker secret，不要写成 Wrangler 变量：

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
cd cloudflare
npx wrangler r2 bucket create clash-art-draft
npx wrangler secret put DRAFT_ACCESS_TOKEN
```

5. 若希望云端网页看到各台设备同步后的稿件，再在 R2 控制台创建一对 **S3 API 访问密钥**（Object Read & Write，限定桶 `clash-art-draft`），并写入 Worker secrets：`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET`。设备之间的同步不需要这组密钥，Worker 直接使用 R2 绑定。这组密钥只给回退容器，避免容器在处理请求时再回调 Worker。
6. 部署：

```bash
cd cloudflare
npx wrangler deploy --config wrangler.jsonc
```

Containers 需要 Workers 付费计划。部署完成后把 `https://clash-art-draft.<account-subdomain>.workers.dev` 填进 `hosted.env` 的 `DRAFT_SYNC_URL`。微信接口若从容器调用，出口 IP 不固定，白名单仍以「账号设置」里的诊断结果为准。

本地已经用 `wrangler dev --config wrangler.dev.jsonc --local` 验证同步和网页回退，不需要账号登录。开发配置不启动容器；`DRAFT_DEV_ORIGIN` 指向本机 `scripts/hosted.py`。
