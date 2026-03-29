# SuitAgent Workspace PRD

## 1. 背景与目标

### 1.1 产品背景
SuitAgent Workspace 面向律师团队，目标是把案件材料、AI 任务、工作流规则、产物审核和导出沉淀到一个统一的案件工作台中。

现有 SuitAgent 仓库已经具备以下原始资产：
- 基于 `.claude/agents` 的 Agent 定义
- 基于 `.claude/rules` 的工作流与场景映射规则
- 基于 `.claude/templates/case-templates` 的案件目录模板
- 基于 `.claude/tools` 的 PDF、OCR、DOCX、Markdown 转 Word 工具

这些资产证明项目已经形成了明确的方法论和执行规范，但还缺少团队成员可直接使用的产品形态。因此 V1 产品目标不是做一个通用聊天工具，而是做一个围绕“案件处理”组织工作的人机协作工作台。

### 1.2 产品目标
- 建立以案件为中心的工作台，而不是以聊天窗口为中心的工具
- 降低团队成员使用 AI 工作流的门槛
- 让每个 AI 输出都能回溯到输入材料、执行任务、审核记录和导出结果
- 让 Claude Code 类能力成为可替换的执行层，而不是产品本体

### 1.3 产品定位
SuitAgent Workspace 是一个律师团队内部使用的半自动案件工作台。

它的产品本体包括：
- 案件工作台前端
- 领域数据与状态管理
- 工作流与规则编排
- 文档管理、审核、导出与协作

Claude Code 在本产品中的角色是：
- 外部 AI 执行器
- 接收结构化任务
- 返回执行状态、日志和结果

因此，SuitAgent Workspace 不是 Claude Code 的外壳。Claude Code 是执行层能力来源之一，未来应保持可替换。

## 2. 用户与场景

### 2.1 核心用户

#### 主办律师
- 创建和推进案件
- 发起 AI 任务
- 审核关键产物
- 组织最终导出

#### 律师助理
- 上传和整理材料
- 填充案件基础信息
- 协助执行标准化流程

#### 研究律师
- 发起法律研究和争议分析任务
- 查看 AI 结果并补充人工结论

#### 团队负责人 / 合伙人
- 查看案件整体状态
- 审核关键文书和分析结论

#### 管理员
- 管理模板、规则、Agent 配置和权限

### 2.2 核心场景

#### 场景 1：新案建档
- 创建案件
- 初始化案件目录
- 录入案件编号、案由、负责人、阶段信息

#### 场景 2：材料上传与分类
- 上传 PDF、DOCX、TXT、图片等材料
- 自动或人工指定分类
- 查看提取后的文本预览

#### 场景 3：发起 AI 任务
- 选择任务类型和输入材料
- 触发法律研究、证据审查、案件分析、文书草拟等任务
- 查看执行日志和状态

#### 场景 4：审核与回退
- 查看 AI 产物
- 审核通过、驳回或补充意见
- 记录审核历史

#### 场景 5：导出与归档
- 将 Markdown 产物导出为 Word 或保留为 Markdown
- 沉淀为案件正式成果

## 3. 产品形态

### 3.1 产品主界面
产品主界面为 Web 案件工作台，围绕“案件”组织所有操作。

用户进入系统后首先看到案件列表，而不是聊天界面。进入单个案件后，围绕同一案件展示：
- 文档区
- 任务区
- 运行记录区
- 产物区
- 审核区
- 时间线

### 3.2 Claude Code 的产品角色
Claude Code 不作为最终用户主入口出现，不承担产品 UI 和业务状态管理职责。

Claude Code 只负责：
- 执行指定的 AI 任务
- 返回运行状态
- 返回运行日志
- 生成结果文件或文本结果

SuitAgent Workspace 负责：
- 组织案件上下文
- 决定调用哪个任务或工作流
- 保存任务、产物、审核和导出记录
- 为团队成员提供统一工作界面

### 3.3 非套壳原则
为避免产品退化成“Claude Code 外壳”，V1 到后续版本都遵守以下原则：
- 前端主入口始终是案件工作台，不是聊天窗口
- Claude Code 通过执行器适配层接入，不直接暴露为产品主界面
- 所有 AI 输出必须进入案件、任务、产物、审核体系
- 执行器必须可替换，避免产品被单一宿主绑定

## 4. 功能需求

### 4.1 案件管理
- 创建案件
- 展示案件列表
- 展示案件详情
- 初始化案件目录结构
- 展示案件阶段、负责人、时间线

### 4.2 文档管理
- 上传文档
- 指定或调整分类
- 存储原始文件
- 生成提取文本
- 提供提取内容预览

### 4.3 AI 工作流与任务
- 选择任务类型
- 选择输入文档
- 创建任务
- 记录 `WorkflowRun`
- 记录任务状态、执行模式、外部任务 ID、执行日志
- 支持任务重试与取消

### 4.4 产物与审核
- 查看产物内容
- 记录产物类型和来源任务
- 提交审核通过 / 驳回
- 保存审核历史 `ReviewRecord`
- 展示审核结论和审核人

### 4.5 导出
- 导出 Markdown
- 导出 Word
- 记录导出操作

### 4.6 配置与规则
V1 仅保留最小配置能力，后续逐步补全：
- Agent 配置来源于 `.claude/agents`
- 工作流规则来源于 `.claude/rules`
- 案件目录模板来源于 `.claude/templates/case-templates`

## 5. 页面结构

### 5.1 案件列表页
- 案件卡片列表
- 创建案件表单

### 5.2 案件工作台页
- 顶部案件摘要
- 左侧文档中心
- 中部产物与审核中心
- 右侧任务与运行记录中心

### 5.3 管理后台
V1 不做完整后台，仅保留后续预留。

## 6. 数据对象

### 6.1 Case
- id
- case_code
- title
- case_type
- case_cause
- status
- owner_name
- phase
- created_at
- updated_at

### 6.2 Document
- id
- case_id
- file_name
- file_type
- storage_path
- extracted_text_path
- category
- processing_status
- uploaded_at

### 6.3 WorkflowRun
- id
- case_id
- workflow_type
- title
- status
- task_ids
- started_by
- error_message
- created_at
- updated_at
- completed_at

### 6.4 AgentTask
- id
- case_id
- workflow_run_id
- task_type
- title
- document_ids
- status
- attempts
- execution_mode
- external_task_id
- logs
- artifact_ids

### 6.5 OutputArtifact
- id
- case_id
- source_task_id
- artifact_type
- title
- content
- file_path
- review_status
- reviewed_by
- reviewed_at

### 6.6 ReviewRecord
- id
- case_id
- artifact_id
- action
- reviewer_name
- comment
- created_at

## 7. 权限模型

### 7.1 Admin
- 系统配置
- 成员与权限管理

### 7.2 Lead / Partner
- 全量查看案件
- 审核关键产物

### 7.3 Lawyer
- 创建案件
- 发起任务
- 查看产物
- 提交审核意见

### 7.4 Assistant
- 上传材料
- 整理文档
- 查看被分配案件

## 8. 成功指标

### 8.1 业务指标
- 新案建档时长下降
- 单案首次研究输出时长下降
- AI 产物采用率提升
- 多人交接效率提升

### 8.2 产品指标
- 任务状态可追踪率
- AI 结果可回溯率
- 审核记录完整率

## 9. 非目标与风险

### 9.1 非目标
- 不做客户门户
- 不做正式 OA
- 不做通用聊天产品
- 不在 V1 自建完整 AI 执行引擎

### 9.2 风险
- 外部执行器接入方式不稳定时，AI 任务链路会受影响
- 文档处理链路依赖现有 Python 工具与本地环境
- 如果后续让聊天界面反客为主，产品容易退化成套壳工具

## 10. V1 结论
V1 的核心不是“把 Claude Code 包一层 UI”，而是构建一个以案件为中心的工作台，并把 Claude Code 作为其中一个可替换的 AI 执行器接入。
