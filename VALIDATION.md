# Validation — 2026-09-20

- 33 Python tests passed, including query-string routing, token/Origin checks, local article filtering, private read-only native snapshots, version conflicts, draft linkage, and analytics snapshot semantics.
- Actual stdio launcher passed: 20 tools and 3 resources; native tool/resource metadata, self-contained HTML, preview metadata, article/comment/review round trip tested with isolated temporary storage.
- Production browser and native App builds passed. Plugin manifest and skill validators passed.
- taste-saas static/contract audit: 20 pass, 0 fail. Unmodified runtime overlay: content list passed at 1707×960 and 1067×1067; article detail passed at 1707×960 after correcting shared insets.
- Browser checked at 427px: no document horizontal overflow; toolbar actions reachable; sidebar and inspector dialogs open/close; preview title fits; all 10 actual inline article images loaded. Temporary audit code was removed from the shipped build.
- No WeChat draft writes or publication actions were performed during this redesign.

Limit: native MCP App host embedding and host-driven model responses have not been end-to-end exercised in the current Codex task. The server protocol and bundled resource are verified; actual embedding requires a host with MCP Apps support. The standalone browser exposes that limitation explicitly.


2026-09-20 follow-up: 35 Python tests pass, both Vite builds pass, Linear static/contract audit 20 pass. Live settings diagnosis connected successfully without inventing an IP; analytics returns 48001 and offers CSV. Live draft relation shows matching local content and synced status. Added tests for safe proxy diagnostics, exact article-index mapping, remote drift and duplicate linking.

2026-09-20: Published-content analytics list implemented with per-account, per-article saved reports. 46 tests pass, including exact msgid filtering, stale-report rejection, cross-account isolation and single-article CSV confirmation without summing snapshots. Live UI verified honest empty published list; external WeChat page access remains blocked by browser tooling policy.

Templates: 50 tests pass, including text/link/image preservation, immutable built-ins, editable custom templates, reversible archive deletion, read-only preview and stale-version application rejection. Browser verified sample and actual article preview. Production UI build and plugin validation pass.

### 2026-09-20 多渠道版本
- 新增独立渠道存储、源版本/渠道版本冲突校验、图片路径与重复校验。
- 小红书浏览器连接器独立实现，无上游运行时依赖；只填写、不点击发布。
- 59 个后端测试通过，新增版本隔离、图片顺序、提交防重、微信渠道排版同步等用例。
- 本地浏览器已检查内容列表渠道状态、渠道入口、真实文章和图片加载。
- 真实小红书账号尚未登录，扫码与线上填表端到端待用户登录验证；不将 mock 测试等同线上发布成功。

### 原稿、上下文与渠道视图
- 61 个后端测试通过；涵盖 Agent 上下文持久化且不进入预览、模板 brief 的双版本约束、旧 HTML 的无写入转换、应用模板不修改源稿。
- 前端构建通过。浏览器确认 Markdown 原稿 / 公众号 / 小红书切换，Agent 上下文字段，预览优先布局，以及默认收起的关联发布区。
- Agent 主按钮生成真实 MCP 操作请求供发送给 Codex；独立浏览器未接自动启动 Agent，不声称按钮已运行模型。

### 2026-09-21 模板与交互整理
- 64 项后端测试通过；新增图片模板增删与快照保留、卡片渲染接入、保存去重、非法素材/超长卡片、新建小红书不复制长文测试。
- Web 与 MCP App 构建通过。实际用本机 Chrome 渲染 PNG，并验证尺寸为 1080×1440。
- 合并重复返回、模板和预览按钮；原稿阅读视图和折叠上下文；账号连接迁至设置；二级模板导航和小红书图片分页预览。
- 浏览器检查因服务重启时落入浏览器错误页，后续操作被 data URL 策略拦截；服务已恢复监听，最新页面的视觉回归尚未完成。
- 原生宿主 sendMessage 与实际小红书登录/填写仍未完成端到端验证。未发送文章、未修改用户原稿。

### MCP 宿主消息入口修复
- 工具声明同时提供 ui.resourceUri、ui/resourceUri 和 openai/outputTemplate；资源 URI 包含构建哈希以避免旧页面缓存。
- 原生 App 握手后显示宿主消息能力；发送成功/失败分别记录，不保存消息正文。get_status 可读取 app_host。
- 实测 tools/list 元数据与 resources/list MIME 一致，前端构建通过；这些检查不代表真实宿主已收到消息。
- 当前会话更新插件后旧 MCP 进程仍引用已清理的缓存目录，出现 channels 导入错误；已恢复其所需资源并重新成功调用 open_content_app。当前旧进程仍需宿主重新加载才能获取新工具声明和遥测处理。
