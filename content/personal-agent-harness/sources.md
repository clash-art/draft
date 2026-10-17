# 资料链接

图片中的〔1〕—〔12〕与下列来源一一对应。代码链接保留此次查看的固定版本。

〔1〕The Tim Ferriss Show Transcripts: The Random Show — AI Super Assistants, Boner Pills, Dream Engineering, Wizards, Supplements, Books, and More (#886)，Tim Ferriss × Kevin Rose（2026-10-11）  
https://tim.blog/2026/10/11/the-random-show-ai-super-assistants-boner-pills-dream-engineering-wizards-supplements-books-and-more-transcript/

〔2〕Grok Bot 非官方重建来源与范围  
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/PROVENANCE.md

〔3〕Grok Bot 后台摘要与等待模式  
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/packages/agent/summarization-orchestrator.ts

〔4〕How We Designed Muse，Mona Sarantakos with Christine Awad（2026-09）  
https://introducing.muse.ai/

〔5〕Muse/Hatch 非官方二进制归档  
https://github.com/win4r/MuseAI-Skills/blob/38bbb45a2c5a0f70de975f6387385770b9ad8aac/opt/hatch/bin/hatch
https://github.com/win4r/MuseAI-Skills/blob/38bbb45a2c5a0f70de975f6387385770b9ad8aac/home/hatch/docs/scheduling-and-watching.md

〔6〕Codex 工具等待与输入抢占测试定义（源码阅读，未执行测试）  
https://github.com/openai/codex/blob/806d9732c974bc8a51b8317c1bd8985544fe627c/codex-rs/core/tests/suite/pending_input.rs#L1397-L1704

〔7〕Codex 当前上下文压缩的前台等待路径，同一固定版本的 codex-rs/core/src/session/turn.rs，L1435–1509。  
https://github.com/openai/codex/blob/806d9732c974bc8a51b8317c1bd8985544fe627c/codex-rs/core/src/session/turn.rs#L1435-L1509

〔8〕How dots took over my Codex，Dominik Kundel（2026-10-02）  
https://www.linkedin.com/pulse/how-dots-took-over-my-codex-dominik-kundel-dgdkc

〔9〕Codex 官方文档：Developer commands（运行中按 Enter 插入当前 turn、按 Tab 排到下一轮；/ps 查看后台终端），2026-10 查阅。  
https://learn.chatgpt.com/docs/developer-commands

〔10〕Claude Code 官方文档：Interactive mode（排队消息在工具调用结束后、同一 turn 内送达；后台 Bash 命令），2026-10 查阅。  
https://code.claude.com/docs/en/interactive-mode

〔11〕Claude Code 官方文档：Create custom subagents（后台 subagent 并行运行，权限请求回到主会话），2026-10 查阅。  
https://code.claude.com/docs/en/sub-agents

〔12〕Codex 功能开关与后台进程，同一固定版本（806d973）的 codex-rs/features/src/lib.rs（InstantInterrupt、CodeModeInterrupt）与 codex-rs/core/src/unified_exec/process_manager.rs（打断 turn 不会结束后台进程）。  
https://github.com/openai/codex/blob/806d9732c974bc8a51b8317c1bd8985544fe627c/codex-rs/features/src/lib.rs
https://github.com/openai/codex/blob/806d9732c974bc8a51b8317c1bd8985544fe627c/codex-rs/core/src/unified_exec/process_manager.rs#L597-L598
