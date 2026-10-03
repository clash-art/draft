Hermes、ECC 会把任务经验写成 skill，论文用 benchmark 检验 Agent 有没有进步。到了工业界，Braintrust 让 Agent 调查生产记录，Adaline 把问题接进 prompt 搜索，Trajectory 用轨迹和反馈更新权重。

![Braintrust、Adaline 与 Trajectory 如何利用真实任务和反馈推进改进](images/b760b5ddc4594589b32b2f6774f67ac3.png)

Braintrust、Adaline 与 Trajectory 如何利用真实任务和反馈推进改进

<!-- page -->

01

### 先验证：改完有没有用

Hermes〔1〕保存记忆、从复杂任务中创建 skill；ECC〔2〕从会话中提炼 instincts，再聚合成 skills。

![Hermes 与 ECC 将经验转成技能的机制对照](images/b88e98237d11484fa8ccffa36b05b23f.png)

Hermes 与 ECC 将经验转成技能的机制对照

<!-- page -->

风险是 Agent 把一次偶然成功写成通用规则，或围着同一次失败反复改 skill。文件变多了，新任务做得怎样，还得单独测。

**学术界：至少拿出分数**

看实验先看三点：新旧版本的底座和预算是否相同，测试题是否参与过优化，有没有留出任务、重复运行和消融。

改执行框架：SICA〔3〕修改自身代码并评估候选；Self-Harness〔4〕按失败轨迹改 harness，过回归检查才接受；Meta-Harness〔5〕发现给优化 Agent 看原始轨迹，比只给分数更有效。

改模型权重：SDPO〔6〕让看到错误信息的模型当“事后教师”，再蒸馏回原策略；SDFT〔7〕用示范做教学信号，减少旧能力遗忘。

第一方工具：Anthropic 的 skill-creator〔8〕支持有无 skill 对照和版本盲评；OpenAI Codex 的指南〔9〕建议记录执行过程，并随真实失败扩充测试集。

<!-- page -->

02

### 上线：真实世界更复杂

让订单 Agent“取消昨天那单”，接口返回成功，用户却说：“不是这一单。”

![关联执行轨迹与事后反馈，定位订单处理失败](images/81cd4c47a812405da5f75b7857cb92ad.png)

关联执行轨迹与事后反馈，定位订单处理失败

只看接口会记成成功；对照纠正和执行记录，才知道是没澄清多笔订单，还是算错了时区〔10〕。

<!-- page -->

03

### 挖问题：Braintrust 与 Adaline

一万条 trace 先看哪条？Running Coach 案例〔11〕把 19,372 段会话聚成 133 类行为，7 类是问题。

![Adaline 从会话中聚类行为并识别问题](images/32ef028eb07f41fab37eab71364534bf.png)

Adaline 从会话中聚类行为并识别问题

Braintrust 的 Topics〔12〕按任务、情绪、问题聚类 trace；Patterns〔13〕让 Loop 深挖轨迹，记下有证据的发现。

<!-- page -->

![Braintrust 与 Adaline：从生产记录发现问题、积累评测并推进修复](images/de83e70759b94858b41d14803ae35ee3.png)

Braintrust 与 Adaline：从生产记录发现问题、积累评测并推进修复

**两条路径**

查原因：Braintrust 用 Loop 保存带证据的 Pattern；Adaline 的行为分析〔14〕关联具体执行证据。

去修复：Braintrust 交给 coding agent；Adaline 用 Improve〔15〕在应用层〔16〕搜索候选 prompt。

<!-- page -->

04

### 改权重：Trajectory 的 SDPO++

Trajectory 的 SDK〔17〕把消息、工具调用和奖励连成轨迹，用 trace\_id 接上用户反馈。

![SDPO++ 沿用自蒸馏：教师读取反馈，学生通过逐 token 损失更新权重](images/e462c30c54124b5aa65e58e51b87f7b8.png)

SDPO++ 沿用自蒸馏：教师读取反馈，学生通过逐 token 损失更新权重

SDPO++〔18〕让同一模型当学生和教师：教师多看到用户纠正，学生逐 token 向它靠近。APEX-Agents 上通过率从 5% 升到 25%。

<!-- page -->

05

### 下一轮：让真实数据接着转

同一种失败有不同修法：工具缺参数就改接口，指令漏了规则就补 prompt，模型反复做错才考虑更新权重。路线图〔19〕主张联合优化这三层，先沿轨迹定位再动手。

修好多订单澄清，还会冒出时区、部分退款等新失败；日志要能关联结果与纠正。

**上线怎么验证**

A/B：Adaline Labs〔20〕建议把用户分给不同 prompt 版本；有足够流量时随机分组做实验〔21〕，比较完成率、纠正率、成本和延迟。

灰度：控制放量范围，会积累记忆的 Agent 还要隔离两组状态。

Demo 演示一次修改，论文测出一次提升；生产系统要靠真实任务不断提供新的失败、约束和纠正。

<!-- page -->

### 参考资料

〔1〕Hermes github.com/NousResearch/hermes-agent

〔2〕ECC github.com/affaan-m/ECC/blob/main/skills/continuous-learning-v2/SKILL.md

〔3〕SICA arxiv.org/abs/2504.15228

〔4〕Self-Harness arxiv.org/html/2606.09498v1

〔5〕Meta-Harness arxiv.org/html/2603.28052v1

〔6〕SDPO arxiv.org/abs/2601.20802

〔7〕SDFT arxiv.org/abs/2601.19897

〔8〕skill-creator claude.com/blog/improving-skill-creator-test-measure-and-refine-agent-skills

〔9〕Codex 指南 developers.openai.com/blog/eval-skills

〔10〕评测指南 anthropic.com/engineering/demystifying-evals-for-ai-agents

〔11〕Running Coach adaline.ai/blog/agent-metabolism-ai-agent-continuous-improvement

〔12〕Topics braintrust.dev/docs/observe/topics

〔13〕Patterns braintrust.dev/docs/observe/patterns

〔14〕编程 Agent 行为分析 adaline.ai/docs/behaviors/coding-agent-behaviors

〔15〕Improve adaline.ai/docs/improve/overview

〔16〕应用层优化 adaline.ai/agent-self-improvement

〔17〕SDK docs.trajectory.ai/introduction

〔18〕Scaling SDPO trajectory.ai/field-notes/scaling-sdpo

〔19〕路线图 trajectory.ai/field-notes/manifesto

〔20〕Adaline Labs labs.adaline.ai/p/prompt-engineering-as-product-strategy

〔21〕A/B 实验 microsoft.com/en-us/research/publication/the-benefits-of-controlled-experimentation-at-scale/
