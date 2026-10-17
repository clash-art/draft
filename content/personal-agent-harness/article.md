# personal agent 的 harness 有什么不同

## 01 从对话窗口，到长期助手

Kevin Rose 在 Tim Ferriss 的播客〔1〕里讲过两件 Instinct 帮上忙的事。一次是提醒他，几天前有份 DocuSign 还没签。另一次是把取药通知、当天航班状态和出发时间放在一起，提醒他先去取药，再去机场。

这两次他都没有先开口问，提醒还是来了。漏签的文件埋在过去的信息里，取药提醒又得结合当天的安排。要给出这样的提醒，得先把这几条信息找出来，还要知道哪些事没完成、哪些时间值得一起考虑。

没人问的时候，它也一直跟着这些事。这正是我对 personal agent 最在意的一点：事情交出去以后，不用一直盯着。它还在查资料，我可以继续说新的安排。过几天回来，手里的项目也不用从头讲起。

平时大家用的多是 thread 驱动的 harness，开一个 thread 往往就为一件事，带着问题来，做完，再开下一个。持续找同一个助手，期待就多了一层：手头的事情可以换，已经交代过的背景和约定还在，没做完的事也有人继续跟进。这层期待能不能满足，要看背后的 harness 怎么安排。

拿隔几天再回来聊上周的项目来说，它得记得之前聊到哪、哪些事已经定了。这几天有了新进展，它也得跟得上。偏好可能几个月都适用，任务状态却可能刚刚变过。只会复述旧聊天，就接不上这些变化。

### 长期助手要满足的四个要求

持续在场：用户随时找它，它都接得住，关了窗口，交代的事也还在推进。这主要靠三件事。一是抢占，用户的新消息能先打断手上没那么急的工作。二是把耗时的事交出去，长命令放进后台进程，成块的工作交给专门的 work agent session，主线腾出来继续跟用户说话。三是调度和交回，交出去的事要有人按时叫起来，完成后有人接住结果。记忆里写着“明天下午跟进”，到点却没人触发，这次跟进就落空了。任务跑完了，结果却没交回来，这件事也还没办完。

快速响应：事情做到一半，用户提了新要求，助手得接住，还要让它影响接下来的动作。还没做的步骤，得重新看要不要继续。已经发出的消息、提交的操作，不能当作没发生，需要改的再补一条更正。助手得弄清实际进度，说明哪些已完成、哪些能停、哪些还要用户决定。所以看响应快不快，要看新要求进来后，它多久停下已经不需要的事。

少让用户操心（hands-off）：事情交出去以后，用户不用盯着每一轮推理和工具调用。助手自己往下推进，做完先核对结果，再交回来。该问的时候仍然要问：超出授权、目标对不上，或需要用户拿主意的选择，要带着进度和选项回来请用户决定。碰到权限边界，不能自动放行。中途中断或暂时失败，也要保留原来的目标和已完成进度，能接着做就接着做，结果不确定时先核对，避免重复执行。

主动发现下一步（proactive）：围绕已有目标，从新信息里找出值得接着做的事。发现线索后，先确认它仍然相关、还没有被处理，再判断是否已经获准行动。就算能做，也要判断值不值得现在打扰用户：例行进度可以先记下，涉及用户决定或时间上拖不得的变化，再判断要不要立刻提醒。发现了、可以做、现在该说，是三个不同的判断。

这四个要求里，有一部分 thread 驱动的 harness 已经有现成做法。Codex 和 Claude Code 都能把用户的新消息排到下一轮，或者插进当前这一轮，也能把长命令放进后台进程，把子任务交给专门的 work agent session〔9〕〔10〕〔11〕〔16〕。

personal agent 要做的有两类。一类是改已有机制的默认做法。thread 驱动的 harness 里，插进当前这一轮的新消息原本要等这次模型输出或工具调用结束才交给模型，Claude Code 现在还是这样〔10〕。personal agent 需要的是：用户照常发消息，harness 负责让这条消息尽快影响正在做的事，效果接近抢占。Codex 最近加了一个叫 instant_interrupt 的功能开关，代码里管这种做法叫 preempt（抢占），从 10 月发布的 0.163.0 正式版起默认打开。它只对插进当前这一轮的消息生效，也就是 Codex 里的 steer。这类消息一到，harness 取消正在进行的模型请求，把新消息并进上下文重新请求，已经启动的工具照样跑完，排到下一轮的消息照旧等着〔12〕〔28〕。我认为这是在往 personal agent 的方向走。

另一类是 thread 驱动的 harness 很少碰到的情况。少让用户操心，用户多半不在场，助手得自己做完，该问时把请求送到用户面前。主动发现，该提醒什么、什么时候说，都得它自己判断。

## 02 三个案例怎么补上这四个要求

下表四列对应第一节的四个要求。Grok Bot 这一行来自非官方重建代码，Muse/Hatch 这一行来自非官方二进制归档，dots 这一行的前三格来自它底层的开源 Codex harness，最后一格来自泄露的 dots 提示词。

| | 持续在场：同时有好几件事时怎么办 | 快速响应：执行中的新输入 | 少让用户操心：自己做完，该问再问 | 主动发现：提醒 |
|---|---|---|---|---|
| Grok Bot | 先处理用户消息，再处理其他 agent 的消息，最后处理定时任务和完成通知。优先级高的消息可以打断非用户的工作 | 用户的新消息排在最前，但不打断正在处理的用户任务。还在跑的 work agent session 可以中途换指令 | 交出去的工作跑完自动交回，要授权时仍会来问用户 | 做完和告诉用户是两步，要不要发消息由主线自己判断 |
| Muse/Hatch | 定时任务和事件检查交给脱离主对话的 worker 去跑，跑完把结果交回主 agent | 还没调用工具时，新旧消息合成一个请求重跑，调用了就排到这一轮之后 | 部分 worker 报告完成前要先验证结果能用，花钱和对外发送要用户批准 | 每次最多挑一件事提醒，也可以不提醒 |
| dots（底层是 Codex harness） | 长命令转成后台进程，子任务交给 work agent session，主对话可以继续聊 | 新消息可以插进当前这一轮，默认会马上停下推理，带上新消息重来 | 子任务跑完会通知主线，但它卡在审批时，主线不知道 | Dreamer 按心跳定时调研，有新发现只报给主助手，由主助手决定告不告诉用户 |

### Grok Bot：用户优先，也有不能随便抢占的工作

用户发来新消息，别的 agent 交回结果，定时任务又到点了，几件事可能同时到达。先处理谁？

据 Grok Bot 的非官方重建代码〔2〕，这三种来源的事会进入三个不同的队列。Grok Bot 每次做完手上的事、要挑下一件时，先看用户队列里有没有消息，没有再看其他 agent 发来的，两边都空了，才处理定时任务、交出去的工作跑完的通知这类事。

排在前面，也还要看能不能抢占。其他 agent 发来的普通消息，要等当前这轮工作结束。一对一发送时标成 priority 的消息，能打断对方手上非用户的工作，马上把它叫醒〔31〕。正在处理的用户任务受保护。所以，一条消息多久能生效，还得看它有没有抢占权限，以及当前在忙什么。优先级消息能影响调度，但不能替用户批准对外动作。

工作也可以交出去。Task 工具会把一块工作交给专门的 work agent session，可以让它在后台运行，跑完发一条通知回来〔15〕。它还在跑时，用户改了主意，主线可以打断它这一轮，立刻换上新指令。它跑完以后，主线还能接着用同一个 session，让它带着上一次的执行记录继续做。这几项都由开关控制，重建代码里看不出线上默认开了哪些。这个 session 不能直接跟用户说话，碰到需要授权的操作，审批请求还是会送到用户面前〔17〕。

交出去的工作或命令跑完，主线会被叫醒看结果，但不会自动告诉用户。按重建代码里叫醒主线时附带的指令，结果是新的、跟用户有关，或者用户说过要等它，才发一条消息告诉用户。过时、重复或已经处理过的，就静默结束〔20〕。在这份重建代码里，做完事和告诉用户是两个分开的动作。

### Muse/Hatch：每次最多提醒一件事，新消息来了合并重跑

Muse 的官方设计文章〔4〕里说，助手会按时间和相关事件持续做事，这些工作有了结果，再判断要不要提醒。下面的具体流程出自归档〔5〕。

它会先收集可能值得提醒的事，判断紧急程度，最后整理成消息。每次最多选一件，也可以一件都不选。候选要和最近对话、记忆、历史送达记录对一遍，再决定发出去、缓一缓，还是静默处理。

这一步不能省。从发现到送达，中间可能已经过了一段时间：用户自己办完了，或者已经收到同一提醒。归档是一个编译后的二进制文件，去重、过期和送达记录这些规则，都能在里面看到。

持续发现，也不必每次都启动完整推理。定时任务负责到点触发。要看有没有变化，归档里还有一种叫事件 hook（event hook）的做法：用一个 Bash 轮询脚本检查条件，条件成立时才唤醒负责处理这件事的 agent。归档的文档说，定时检查和事件触发的自动化都是隔一段时间轮询一次〔5〕。

执行中来了新消息时，如果模型还在推理、没开始输出最终回复，Muse/Hatch 会把旧请求重新入队，和新消息合成一个请求，再处理一遍，模型会重新生成回复。工具调用已经发出去、最终回复已经开始输出、正在压缩上下文，或者新消息和当前请求来自不同的来源，就不会重跑，新消息排到这一轮之后。中途输出过说明文字，也不一定就失去重跑的机会。这一轮之前已经调用过的工具，是沿用原来的结果，还是再调用一遍，归档资料里看不出来。

交出去的事，Muse/Hatch 也尽量让它自己做完。按归档里的文档，定时任务的结果作为消息发到对话里。对外发送、付款这类操作，每次都要用户批准，审批会推送到手机上〔19〕。有些 worker 在报告完成前，要先验证做出来的东西确实能用。归档里也有对不上的地方。文档说定时任务这类没人在旁边的任务，可以停在审批卡片上等用户，二进制里给脱离对话运行的 worker 的提示词却说，审批可能永远等不来，要当作失败换别的办法。实际运行时按哪一种来，光看归档判断不了。

### dots：上层有 Dreamer 找事，底层 Codex 的工具可能还在跑

OpenAI 的 Dominik Kundel 在公开文章〔8〕里提到，dots 基于开源的 Codex harness。同一篇文章里也说，dots 会主动跟进工作，还能设置按时间或事件触发的自动化。主动跟进靠的是 dots 自己加的一层。按泄露的 dots 提示词〔29〕，主助手会派出叫 Dreamer 的调研 agent，按心跳定时运行。它先读最近的对话、用户笔记和待办，再去已连接的应用里找新情况。Dreamer 不能联系用户，也不能替用户做事，只有发现有用的新东西，或者碰到要主助手处理的阻碍时，才通知主助手一次，告不告诉用户由主助手决定。每天凌晨还有一次复盘，回顾当天的对话，更新用户的偏好和优先级。Muse/Hatch 让一个 agent 自己挑一件事提醒，dots 则让一个 agent 负责发现，另一个决定说不说。开源 Codex 里找不到 Dreamer，只能看到它把定时心跳触发的消息和用户亲自发的消息分开记录〔30〕。

执行中的新消息和工具怎么处理，要看底层的 Codex。下面几段来自 Codex 的测试定义和源码，只能说明 Codex 这一层的情况，dots 的线上实现可能另有做法。

Codex 把模型推理、工具执行和整轮 turn 分开管理。任务进行中按 Enter，新指令就会插进当前 turn（steer），按 Tab 则排到下一轮〔9〕。插进当前 turn 的新指令，现在默认会直接中止当前推理，已经启动的工具还是会跑完〔6〕〔12〕〔28〕。推理停了，工具造成的外部影响不会自动撤销，得另外处理。工具没做完，下一次推理也可能要等。

耗时长的命令，会先等一会儿。跑完了就交回结果，没跑完就交回一个进程 ID，之后接着查同一个进程，不用重跑一遍。

打开还在开发中的 Code Mode 后，模型写的代码片段也能这样转到后台继续跑。用户 steer 时，它会接着跑。直接打断这个 turn，它就会被终止，长命令的后台进程则会留下来〔12〕。

Codex 也能把子任务交给专门的 work agent session。这项功能是稳定版，默认开启〔16〕。主线可以开一个 session 让它自己跑，跑完会收到通知。它还在跑时，主线能给它发新指令，必要时立刻打断，让它改方向。关掉的 session 之后还能恢复，接着收指令。子任务碰到需要授权的操作，审批会出现在它自己的线程里，终端界面会提示用户切过去处理。主线 agent 这边看到的状态仍是“在运行”，不知道它在等审批〔18〕。

于是，助手得同时跟住两边：用户已经聊到新的事情，原来的命令、代码执行或 work agent session 可能还在跑。它要用原来的标识继续查，等结果回来后，弄清这是哪件事的结果、现在还有没有用，以及是否已经对外部系统产生了影响。

## 03 自己搭 harness 时，我会先想清楚什么

自己搭 personal agent 的 harness，先要看清它和常见的 thread 驱动的 harness 差在哪。用户开一个 thread，交代一件事，在旁边看着它做，做完这个 thread 就告一段落。Codex 就是这样，恢复一个 thread 时，读回的是这个 thread 自己的历史，跨 thread 的记忆功能默认关闭〔22〕。personal agent 要连续在线好几天，手上同时挂着几件事。叫醒它的可能是用户，也可能是定时任务，或者交出去的工作跑完了，这时用户多半不在场。下面几件事，thread 里都有对应的做法，放到这种场景下，要求就变了。

### 记住什么：更勤、更宽，也看得更多

thread 驱动的 harness 也有记忆，personal agent 在这件事上更激进。

先是记得更勤。Grok Bot 的重建代码里，每轮对话结束都会再跑一遍模型，从这一轮里提取该记的事，隔几轮还会写一条经过记录〔23〕。Muse/Hatch 有定时整理记忆的任务，每小时把新对话并进记忆文件，每晚再回看一遍最近的对话〔24〕。Claude Code 的自动记忆由模型自己判断要不要写，官方文档也说它不会每次都记〔25〕。Codex 的记忆功能默认关闭，打开后也只在新会话开始时，回头整理以前的会话〔26〕。

记的范围也更宽。Grok Bot 除了用户档案，还记经过日志，以及同一用户所有助手共享的用户事实。Muse/Hatch 给每个人、每个群单独建档。Claude Code 的自动记忆则按代码仓库分开存，每个项目一份〔25〕。

记忆也跟着压缩更新。Grok Bot 每轮都把记忆放进系统提示，压缩时顺带换上最新的记忆。Muse/Hatch 的二进制里有压缩前先写一次记忆的字样，文档里没有对应说明。Claude Code 压缩以后，会重新读一遍用户写的记忆文件〔25〕。

最明显的差别，在会不会主动去看派出去的 session 做了什么。Grok Bot 能看到每个还在跑的 work agent session 最近调用了哪些工具，也能读它的实时运行记录。系统提示要求它主动去查，告诉用户任务还在跑之前尤其要查一遍〔27〕。thread 驱动的 harness 默认只拿结果。Codex 的主线等子任务结束，拿到的是它最后一条消息。Claude Code 的子任务只交回一份总结，运行记录虽然存在磁盘上，却没有工具或提示让它去读。

记得多，代价是记住的东西也会过时。上个月的偏好可能早就变了，定好的事也可能被推翻。Grok Bot 和 Muse/Hatch 都会用新的说法覆盖旧的，Grok Bot 还会让旧记忆慢慢淡出〔23〕〔24〕。助手要是照着旧信息办事，用户反而得多操一份心。

### 放进上下文：一条不结束的对话流

摘要和压缩，thread 驱动的 harness 也有。差别在于 thread 迟早会结束，personal agent 的对话没有终点，用户消息、定时任务、交出去的工作跑完的通知，会一直接进来。

三个案例里能看到两种接法。Grok Bot 的重建代码里，每个 agent 只有一条对话流，用户消息、定时任务和工作完成的通知都进这一条。历史长了，就在原地压成摘要，记忆每轮放进系统提示〔20〕。Muse/Hatch 的主对话也是一条持续、会压缩的对话。定时任务和事件触发的检查，则交给脱离对话运行的 worker。按二进制里的提示词，worker 只拿到任务说明和记忆文件这类工作区文件，跑完把结果交回主 agent，由主 agent 决定怎么处理〔21〕。

Grok Bot〔3〕和 Muse/Hatch〔5〕的压缩是异步进行的，摘要在后台生成的同时，agent 还在接着处理新消息和通知。所以两家在换上摘要前，都会先补上摘要之后发生的事。压缩做得再及时，只要漏掉后来的变化，接下来的判断就可能建立在旧状态上。

摘要可以趁对话还在进行时提前准备，代价是多花一些模型调用。Codex 默认的上下文压缩〔7〕会让主线停下来，等压缩做完再继续。它最近加了后台压缩〔13〕，目前还在开发中，默认关闭。上下文快满之前，它先在后台生成摘要，turn 照常往下跑，主线只在把摘要换进来时停一下。要是摘要还没出来，上下文就先满了，主线还是得等。

Codex 还有一种由模型主动发起的方式〔14〕，也在开发中，默认关闭。开启后，Codex 会让模型知道上下文还剩多少，快用完时再提醒一次。模型可以自己决定换一个新的上下文窗口。这一步不生成摘要。工作过程中，模型会把之后还要用的信息记进自己的笔记，换了窗口，笔记还在。新窗口开头会带上一段笔记提示，模型可以接着读笔记，需要时也能查回旧历史。换窗口仍在主线上完成，但主线不用等模型写摘要。

personal agent 的对话流不会结束，压缩会一次次发生。我认为它更要避免让主线停下来等压缩，因为这时用户可能正好发来新消息。背景留多少、摘要多早开始准备，再按能接受的等待和成本去定。

### 新消息来了：先分清改的是哪件事

thread 里的新消息，基本都在说同一件事。personal agent 收到新消息时，手上可能同时挂着几件不相干的事，比如一条还在跑的长命令，或者一个正在处理子任务的 work agent session。它得先判断这条消息改的是哪一件。新消息可能让其中某件事变得多余，也可能改变它该做的内容。举个例子，用户让助手比较三家酒店，比到一半说只看第二家。还在查另外两家的 session 就该停掉。如果已经替用户给第一家发了询价邮件，邮件收不回，就补一封说明不用了。各个 session 的结果陆续回来，助手要分清哪个结果属于哪件事，再整理成一个回答告诉用户。

Grok Bot 和 Codex 都能给还在跑的 work agent session 发新指令，必要时打断它这一轮，酒店例子里停掉多余的查询，靠的就是这个〔15〕〔16〕。Codex 的长命令有自己的进程 ID，新消息来了，对话可以照常往下走，但默认的压缩和普通工具调用进行时，主线还是得等。Muse/Hatch 会把新旧消息合成一个请求重新跑，能不能重跑，要看之前已经做到哪一步。

### 交出去以后：用户不在，也能做完

在 thread 里需要审批时，用户就在旁边。personal agent 交出去的事，往往在用户不在的时候跑，要能自己做完，做完先核对，再交回结果。碰到授权和需要用户拿主意的地方，请求得送到用户真能看到的地方，比如手机，可能要等上几个小时，这段时间别的事也不该跟着停。主线也得知道这件事卡在等用户。Codex 的审批是按 thread 设计的，子任务在等审批，主线 agent 还以为它在运行，它跟用户说进度时，就可能说错。

中断以后，有了进度记录，恢复也更有依据。先要分清是哪种中断。主线不再等某条命令了，那条命令可能还在后台进程里跑，接着等它的结果就行。进程真正中断以后，则要先核实哪些步骤已经完成、有没有对外产生影响，再决定怎么继续。尤其是结果不确定的动作，直接重跑可能造成重复。记忆能帮它理解原来的目标，但实际做到哪一步，还得看任务记录和工具结果。

### 提醒：主动但别打扰

personal agent 得自己决定什么时候开口。用户曾经收到过一条提醒，后面就不该因为重新发现同一件事再发一次。有新结果的时候，要结合最新情况判断现在值不值得说。需要用户拿主意的时候，带着已有进度回来问。助手越主动，这些判断就越影响用户愿不愿意继续把事情交给它。

### 从哪里开始

记住背景、留住进度、按时推进、交回结果，少了哪一环，用户都可能重新变成那个追问和收尾的人。我自己搭 harness 时，会先挑几件真要交给它的工作，看哪些能拆出去自己跑，哪些阶段还得留在主线上等。也要看哪些信息得长期留着，哪些进度不能丢，哪些选择必须回来问我。再据此决定助手要多主动、工作拆到多细，以及愿意承担多少等待和运行成本。

我是 BoAI，记录自己做 Agent 的过程，也拆解背后的实现。
下一篇：用 pi coding agent，从 0 到 1 做自己的 personal agent。
想看怎么做，可以关注一下。

## 来源

文中代码出处都标了固定版本。代码和二进制材料只做了阅读，没有对着线上产品运行，测试也只是读了定义，没有执行。

〔1〕The Tim Ferriss Show Transcripts: The Random Show — AI Super Assistants, Boner Pills, Dream Engineering, Wizards, Supplements, Books, and More (#886)，Tim Ferriss × Kevin Rose，2026-10-11。
https://tim.blog/2026/10/11/the-random-show-ai-super-assistants-boner-pills-dream-engineering-wizards-supplements-books-and-more-transcript/

〔2〕Grok Bot 非官方重建来源与范围，b-nnett/grok-bot-0.18-reconstructed，a9f633e，PROVENANCE.md。
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/PROVENANCE.md

〔3〕Grok Bot 后台摘要与等待模式，同一固定版本的 source/packages/agent/summarization-orchestrator.ts。
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/packages/agent/summarization-orchestrator.ts

〔4〕How We Designed Muse，Mona Sarantakos with Christine Awad，2026-09。
https://introducing.muse.ai/

〔5〕Muse/Hatch 非官方二进制归档，win4r/MuseAI-Skills，38bbb45，opt/hatch/bin/hatch。
https://github.com/win4r/MuseAI-Skills/blob/38bbb45a2c5a0f70de975f6387385770b9ad8aac/opt/hatch/bin/hatch
https://github.com/win4r/MuseAI-Skills/blob/38bbb45a2c5a0f70de975f6387385770b9ad8aac/home/hatch/docs/scheduling-and-watching.md

〔6〕Codex 工具等待与输入抢占测试定义，openai/codex，806d973，codex-rs/core/tests/suite/pending_input.rs，L1397–1704。此处为源码阅读，未执行测试。
https://github.com/openai/codex/blob/806d9732c974bc8a51b8317c1bd8985544fe627c/codex-rs/core/tests/suite/pending_input.rs#L1397-L1704

〔7〕Codex 当前上下文压缩的前台等待路径，同一固定版本的 codex-rs/core/src/session/turn.rs，L1435–1509。
https://github.com/openai/codex/blob/806d9732c974bc8a51b8317c1bd8985544fe627c/codex-rs/core/src/session/turn.rs#L1435-L1509

〔8〕How dots took over my Codex，Dominik Kundel，2026-10-02。
https://www.linkedin.com/pulse/how-dots-took-over-my-codex-dominik-kundel-dgdkc

〔9〕Codex 官方文档：Developer commands（运行中按 Enter 插入当前 turn、按 Tab 排到下一轮，/ps 查看后台终端），2026-10 查阅。
https://learn.chatgpt.com/docs/developer-commands

〔10〕Claude Code 官方文档：Interactive mode（排队消息在工具调用结束后、同一 turn 内送达，后台 Bash 命令），2026-10 查阅。
https://code.claude.com/docs/en/interactive-mode

〔11〕Claude Code 官方文档：Create custom subagents（后台 subagent 并行运行，权限请求回到主会话），2026-10 查阅。
https://code.claude.com/docs/en/sub-agents

〔12〕Codex 功能开关与后台进程，同一固定版本（806d973）的 codex-rs/features/src/lib.rs（InstantInterrupt、CodeModeInterrupt，ce0323f 的 L1220–1224 仍为开发中、默认开启）与 codex-rs/core/src/unified_exec/process_manager.rs（打断 turn 不会结束后台进程）。
https://github.com/openai/codex/blob/806d9732c974bc8a51b8317c1bd8985544fe627c/codex-rs/features/src/lib.rs
https://github.com/openai/codex/blob/806d9732c974bc8a51b8317c1bd8985544fe627c/codex-rs/core/src/unified_exec/process_manager.rs#L597-L598

〔13〕Codex 后台压缩（async_compaction，开发中、默认关闭，首见于 rust-v0.163.0-alpha.11），固定版本 ce0323f 的 codex-rs/core/src/session/async_compaction.rs 与 codex-rs/core/src/session/turn.rs，功能开关见 codex-rs/features/src/lib.rs L2082–2086。
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/core/src/session/async_compaction.rs
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/features/src/lib.rs#L2082-L2086

〔14〕Codex 由模型主动换上下文窗口（token_budget，开发中、默认关闭），固定版本 ce0323f 的 codex-rs/core/src/tools/handlers/new_context_window_spec.rs、codex-rs/core/src/compact_token_budget.rs L34–69 、codex-rs/ext/history-notes/src/tools.rs（notes 工具，L28 说明笔记跨窗口保留）与 extension.rs L101–155（新窗口带上笔记提示），功能开关见 codex-rs/features/src/lib.rs L1925–1930。
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/core/src/compact_token_budget.rs#L34-L69
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/features/src/lib.rs#L1925-L1930
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/ext/history-notes/src/tools.rs#L28

〔15〕Grok Bot 的 Task 工具（后台运行、完成通知、interrupt、resume），同一固定版本的 source/packages/agent/tools/task.ts 与 task-tool-schema.ts（L107–137）。
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/packages/agent/tools/task-tool-schema.ts#L107-L137

〔16〕Codex 的 multi_agent 功能（spawn_agent、send_input 的 interrupt、wait_agent 完成通知、resume_agent），固定版本 ce0323f 的 codex-rs/features/src/lib.rs L1481–1486（Stable，默认开启）与 codex-rs/core/src/tools/handlers/multi_agents_spec.rs L192–300。
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/features/src/lib.rs#L1481-L1486
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/core/src/tools/handlers/multi_agents_spec.rs#L192-L300

〔17〕Grok Bot 交出去的 work agent session 不能直接问用户、审批请求仍送到用户面前，同一固定版本的 source/host/runner/system-prompt.ts L59–73。
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/host/runner/system-prompt.ts#L59-L73

〔18〕Codex 子任务的审批出现在它自己的线程里，主线 agent 的状态里没有“等待审批”，固定版本 ce0323f 的 codex-rs/tui/src/bottom_pane/pending_thread_approvals.rs L11–70 与 codex-rs/protocol/src/protocol.rs L1937–1953。
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/tui/src/bottom_pane/pending_thread_approvals.rs#L11-L70
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/protocol/src/protocol.rs#L1937-L1953

〔19〕Muse/Hatch 归档文档：定时任务在 app 关闭时运行（scheduling-and-watching.md L33–47），审批推送与每次购买需批准（calls-texts-notifications.md L93–120），后台任务停在审批卡片（payments-and-purchases.md L17）。脱离对话运行时把审批当失败的提示词，见同一归档 opt/hatch/bin/hatch 内嵌的 tool_rules_detached_approvals 字符串。
https://github.com/win4r/MuseAI-Skills/blob/38bbb45a2c5a0f70de975f6387385770b9ad8aac/home/hatch/docs/scheduling-and-watching.md#L33-L47
https://github.com/win4r/MuseAI-Skills/blob/38bbb45a2c5a0f70de975f6387385770b9ad8aac/home/hatch/docs/calls-texts-notifications.md#L93-L120
https://github.com/win4r/MuseAI-Skills/blob/38bbb45a2c5a0f70de975f6387385770b9ad8aac/home/hatch/docs/payments-and-purchases.md#L17

〔20〕Grok Bot 每个 agent 一条对话流，定时任务、工作完成通知和用户消息进同一个 session，摘要在原地压缩，记忆每轮放进系统提示。同一固定版本的 extensions/transcript/session-runtime.ts L390–397、automation-run-path.ts L175–236、completion-revivals.ts L163–191（叫醒主线时附带的指令见同一文件 L13–82：结果新且相关才发消息，否则静默结束）、runner/system-prompt-assembly.ts L155–193。
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/host/extensions/transcript/session-runtime.ts#L390-L397
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/host/extensions/transcript/automation-run-path.ts#L175-L236
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/host/extensions/transcript/completion-revivals.ts#L163-L191
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/host/extensions/transcript/completion-revivals.ts#L13-L82
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/host/runner/system-prompt-assembly.ts#L155-L193

〔21〕Muse/Hatch 定时任务和事件检查交给脱离对话运行的 worker，结果交回主 agent，主对话从最近的压缩点恢复。见归档 opt/hatch/bin/hatch 内嵌的调度 worker 与 hook worker 提示词字符串，以及 home/hatch/docs/channel-availability.md L52–60。
https://github.com/win4r/MuseAI-Skills/blob/38bbb45a2c5a0f70de975f6387385770b9ad8aac/home/hatch/docs/channel-availability.md#L52-L60

〔22〕Codex 恢复 thread 时读回该 thread 自己的记录，跨 thread 的记忆功能默认关闭。固定版本 ce0323f 的 codex-rs/rollout/src/recorder.rs L1172–1187、codex-rs/features/src/lib.rs L1291–1296。
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/rollout/src/recorder.rs#L1172-L1187
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/features/src/lib.rs#L1291-L1296

〔23〕Grok Bot 每轮提取记忆、定期写经过记录、用新事实覆盖旧事实并让旧记忆淡出。同一固定版本的 runner/turn-settle.ts L364、runner/turn-memory.ts L42–113、runner/sand-memory.ts L1–18、L206–229。
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/host/runner/turn-memory.ts#L42-L113
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/host/runner/sand-memory.ts#L1-L229

〔24〕Muse/Hatch 每小时整理记忆、每晚回看最近对话、给人和群建档、新说法覆盖旧说法。归档 home/hatch/docs/self_improvement.md L7–28。压缩前写记忆的说法来自 opt/hatch/bin/hatch 内嵌字符串。
https://github.com/win4r/MuseAI-Skills/blob/38bbb45a2c5a0f70de975f6387385770b9ad8aac/home/hatch/docs/self_improvement.md#L7-L28

〔25〕Claude Code 官方记忆文档：CLAUDE.md 与自动记忆。
https://code.claude.com/docs/en/memory
Claude Code 子任务只交回最终报告：
https://code.claude.com/docs/en/sub-agents

〔26〕Codex 记忆功能默认关闭，开启后在新会话开始时整理以前的会话。固定版本 ce0323f 的 codex-rs/features/src/lib.rs L1291–1296、codex-rs/memories/README.md L29–41。主线等待子任务时只拿到最后一条消息：codex-rs/core/src/tools/handlers/multi_agents_spec.rs L293。
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/memories/README.md#L29-L41
https://github.com/openai/codex/blob/ce0323f2f2d3b25e82806cd555237da3db4e1897/codex-rs/core/src/tools/handlers/multi_agents_spec.rs#L293

〔27〕Grok Bot 查看还在跑的 work agent session 的状态和实时运行记录，系统提示要求主动查。同一固定版本的 runner/tools/sand-subagent-management-tools.ts L26、L89–99，runner/system-prompt.ts L179。
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/host/runner/tools/sand-subagent-management-tools.ts#L26-L99
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/host/runner/system-prompt.ts#L179

〔28〕Codex 把“插进当前 turn 的新消息立即停下当前推理”改为默认：功能加入于 PR #48135（2026-09-25），默认开启于 PR #51812（2026-10-07），首个包含它的正式版为 rust-v0.163.0（2026-10-15 发布）。触发条件见该版本的 codex-rs/core/src/session/input_queue.rs L293–313，排队消息在 turn 进行中不进入核心（codex-rs/tui/src/chatwidget/input_flow.rs L258–262），IDE 与桌面 app 使用的 app-server 插入请求走同一路径（codex-rs/app-server/src/request_processors/turn_processor.rs L1044–1095）。
https://github.com/openai/codex/pull/51812
https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/features/src/lib.rs#L1207-L1212
https://github.com/openai/codex/blob/rust-v0.163.0/codex-rs/core/src/session/input_queue.rs#L293-L313

〔29〕dots 的 Dreamer 提示词（泄露的系统提示词，非官方），asgeirtj/system_prompts_leaks，60d44cc，OpenAI/dots/dreamer.md。
https://github.com/asgeirtj/system_prompts_leaks/blob/60d44cc/OpenAI/dots/dreamer.md

〔30〕Codex 区分定时心跳触发的输入（automation_heartbeat_scheduled），固定版本 ce0323f 的 codex-rs/history/src/heartbeat.rs。同一版本中未见 Dreamer 相关代码。
https://github.com/openai/codex/blob/ce0323f2f2/codex-rs/history/src/heartbeat.rs

〔31〕Grok Bot 的 agent 间消息：priority 只在一对一发送时生效，会打断对方当前的非用户工作并立刻叫醒它，同一固定版本的 source/host/extensions/transcript/agent-to-agent-messaging.ts L38–121。
https://github.com/b-nnett/grok-bot-0.18-reconstructed/blob/a9f633e09d49a85829b8236331b9e21f7e612634/source/host/extensions/transcript/agent-to-agent-messaging.ts#L38-L121
