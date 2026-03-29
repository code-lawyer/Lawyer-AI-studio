# SuitAgent 桌面客户端设计规格

## 1. 项目概述

将 SuitAgent（基于 Claude Code 的诉讼法律服务智能分析系统）封装为桌面客户端，支持用户可视化定制工作流。

### 1.1 设计决策

| 维度 | 决定 | 理由 |
|------|------|------|
| 目标用户 | 先内部后外推 | 先验证再推广，但架构上预留对外发布能力 |
| 工作流定制 | 场景级别 | Agent 是黑盒积木，用户选择和排列，不修改内部行为 |
| AI 执行器 | Claude Code CLI | 利用完整工具链和 subagent 机制 |
| 数据存储 | 案件即文件夹 | SQLite 做索引，案件数据在标准 12 层目录中，可独立备份 |
| 桌面框架 | Tauri | 体积小（~50-80MB），启动快，用户无感知 Rust 构建链 |
| V1 范围 | 全功能 | 案件管理 + 文档上传 + 工作流执行 + 工作流编辑器 + 产物审核导出 + 设置 |

### 1.2 技术栈

- **桌面壳**: Tauri v2 (Rust)
- **前端**: Next.js 16 + React 19 + Tailwind CSS v4 (静态导出)
- **后端**: FastAPI + SQLite (PyInstaller 捆绑为 exe)
- **AI 执行**: Claude Code CLI (sidecar)
- **拖拽库**: @dnd-kit/sortable (工作流编辑器)

## 2. 整体架构

```
┌──────────────────────────────────────────────┐
│                 Tauri 桌面壳                   │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │       Next.js 前端（静态资源）          │  │
│  │                                        │  │
│  │  案件管理 · 文档中心 · 工作流编辑器     │  │
│  │  任务监控 · 产物审核 · 设置面板         │  │
│  └──────────────┬─────────────────────────┘  │
│                 │ HTTP (localhost:8000)       │
│  ┌──────────────▼─────────────────────────┐  │
│  │    FastAPI 后端（PyInstaller 捆绑）     │  │
│  │                                        │  │
│  │  案件服务 · 工作流引擎 · 文档处理       │  │
│  │  SQLite 索引 · 文件系统 · 导出引擎      │  │
│  └──────────────┬─────────────────────────┘  │
│                 │ subprocess                  │
│  ┌──────────────▼─────────────────────────┐  │
│  │       Claude Code CLI（按需启动）       │  │
│  │                                        │  │
│  │  10 个 Agent · 工具调用 · 文件读写      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │             本地文件系统                 │  │
│  │                                        │  │
│  │  全局配置/                              │  │
│  │  ├── workflows/preset/   系统预设模板   │  │
│  │  ├── workflows/custom/   用户自定义     │  │
│  │  ├── settings.json       用户偏好       │  │
│  │  └── index.sqlite        案件索引       │  │
│  │                                        │  │
│  │  案件存储目录（用户可选）/               │  │
│  │  ├── [案件编号]/          12层标准目录   │  │
│  │  └── ...                               │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 2.1 通信链路

| 链路 | 方式 | 说明 |
|------|------|------|
| 前端 → 后端 | HTTP REST API (localhost:8000) | 与现有 API 兼容 |
| 后端 → Claude CLI | subprocess (JSON stdin/stdout) | 结构化 prompt 传递 |
| Tauri → 进程管理 | Sidecar 机制 | 启动/停止/健康检查 |

### 2.2 关键设计决策

- **Next.js 静态导出**: `next export` 生成纯静态 HTML/JS，Tauri WebView 直接加载，无需 Node.js 运行时
- **FastAPI PyInstaller 捆绑**: 打包为单个 exe，用户无需安装 Python
- **案件即文件夹**: SQLite 只存索引和全局配置，案件数据在标准 12 层目录里
- **工作流模板为 JSON**: 从 Markdown 规则文件抽象为结构化数据，支持编辑器读写
- **Claude Code CLI 按需启动**: 不常驻，执行任务时启动，完成后释放资源

## 3. 工作流系统

### 3.1 数据模型

工作流从现有 `WorkflowSystem.md` 的 Markdown 定义抽象为 JSON：

```json
{
  "id": "workflow_defendant_response",
  "name": "被告应诉",
  "description": "收到起诉状时的完整应诉流程",
  "category": "preset",
  "trigger_keywords": ["收到起诉状", "需要应诉", "准备答辩"],
  "steps": [
    { "order": 1, "agent": "doc-analyzer", "label": "分析起诉状" },
    { "order": 2, "agent": "issue-identifier", "label": "识别争议焦点" },
    { "order": 3, "agent": "researcher", "label": "法律检索" },
    { "order": 4, "agent": "strategist", "label": "制定应诉策略" },
    { "order": 5, "agent": "writer", "label": "起草答辩状" },
    { "order": 6, "agent": "reviewer", "label": "质量审查" },
    { "order": 7, "agent": "summarizer", "label": "生成摘要" },
    { "order": 8, "agent": "reporter", "label": "整合报告" }
  ],
  "expected_outputs": ["争议焦点分析", "法律检索报告", "应诉策略方案", "答辩状草稿"],
  "created_at": "2026-01-01T00:00:00",
  "updated_at": "2026-03-29T00:00:00"
}
```

设计要点：
- **steps 是有序数组**: V1 只支持线性顺序，覆盖现有全部 7 个场景
- **category 区分来源**: `preset` 不可删除（可复制为 custom），`custom` 可自由编辑
- **Agent 是黑盒**: 每个 step 只需指定 agent + label，内部行为由 `.claude/agents/` 配置决定
- **存储位置**: `workflows/preset/` 和 `workflows/custom/`，一个工作流一个 JSON 文件

### 3.2 工作流引擎

新增 `workflow_engine.py`，核心职责：按工作流定义依次执行 Agent，管理步骤间上下文传递。

```
WorkflowEngine:
  - load_workflow(workflow_id) → WorkflowTemplate
  - execute(case_id, workflow_id, document_ids) → WorkflowRun
  - _run_step(step, context) → StepResult
  - _build_prompt(agent, context) → str
```

执行流程：
1. 加载工作流 JSON 模板
2. 创建 WorkflowRun 记录
3. 逐步执行：每个 step 调用 `claude_cli` 适配器，传入 Agent 名 + 上下文
4. 每步完成后收集产物，传递给下一步作为输入上下文
5. 任何一步失败 → 标记工作流失败，支持从失败步骤重试

### 3.3 系统预设工作流（7 个）

| 编号 | 名称 | 步骤数 | 场景 |
|------|------|--------|------|
| 1 | 被告应诉 | 8 | 收到起诉状 |
| 2 | 新证据质证 | 5 | 收到新证据 |
| 3 | 庭审后分析 | 5 | 庭审结束后 |
| 4 | 法律服务方案 | 5 | 诉前咨询 |
| 5 | 策略优化 | 4 | 策略调整 |
| 6 | 原告起诉 | 8 | 准备起诉 |
| 7 | 制作委托材料 | 4 | 确定委托 |

### 3.4 工作流编辑器 UI

三栏布局：
- **左栏 (240px)**: 工作流列表，分"系统预设"和"我的工作流"两组，纯文字无图标，底部"新建工作流"按钮
- **中栏 (flex)**: 纵向流水线编辑区，圆点 + 细线连接步骤卡片，支持拖拽排序/删除/编辑标签，底部触发关键词标签
- **右栏 (200px)**: 可用 Agent 面板，按四层分组（输入层/分析层/输出层/支持层），拖入中栏添加步骤

交互规则：
- 系统预设只能"复制为自定义"后再修改
- 步骤描述文字可直接点击编辑
- 使用 `@dnd-kit/sortable` 实现拖拽

## 4. 界面设计

### 4.1 设计语言

- **色调**: 暖砂色系（sand palette），纯白背景 + 微暖灰边框
- **字体**: Noto Serif SC（标题）+ Noto Sans SC（正文）
- **风格**: 简约、清晰、无多余装饰

CSS 变量：
```css
--sand-50: #faf8f5;    /* 页面背景 */
--sand-100: #f3efe8;   /* 面板背景 */
--sand-200: #e8e0d4;   /* 边框 */
--sand-300: #d4c9b8;   /* 次要边框 */
--ink: #1c1917;        /* 主文字 */
--ink-light: #44403c;  /* 次要文字 */
--ink-muted: #78716c;  /* 辅助文字 */
--ink-faint: #a8a29e;  /* 最弱文字 */
--accent: #b45309;     /* 强调色 */
--green: #3d7a4a;      /* 成功/完成 */
--red: #9a3412;        /* 失败/拒绝 */
--blue: #1e5c8a;       /* 进行中 */
--white: #fffcf8;      /* 卡片背景 */
```

### 4.2 顶部导航栏

固定 52px 高度，包含：
- SuitAgent 品牌标识（Noto Serif SC 粗体）
- 四个主导航项：案件列表、工作台、工作流、设置
- 右侧：Claude Code 连接状态（绿点 + "已连接"）、导出按钮

### 4.3 案件工作台

- **左侧 (240px)**: 案件信息（编号/标题/承办人/阶段）+ 功能导航（文档中心/证据材料/法律研究/法律文书/综合报告/任务历史/时间线）+ 底部数字统计
- **中间区域**: 上方内容标题 + 操作按钮，下方左右分栏（文档列表 320px + 文档预览 flex）
- **右下浮动任务面板 (360px)**: 当前工作流进度，每步骤显示完成/执行中/等待状态，底部进度条

### 4.4 设置面板

三个设置区块：
1. **Claude Code 配置**: CLI 路径（带浏览按钮）+ 连接状态
2. **案件存储**: 存储目录选择
3. **偏好设置**: 自动审核提醒（开关）、默认导出 Word（开关）、显示执行日志（开关）

### 4.5 首次启动引导

5 步线性引导：
1. 安装 SuitAgent — 自动完成
2. 安装 Claude Code CLI — 自动检测
3. 登录 Claude Code — 用户操作（打开终端）
4. 选择案件存储目录 — 用户选择
5. 创建第一个案件 — 用户操作

每步有状态指示（已完成✓/当前/待完成），底部进度条。

## 5. 项目结构

```
SuitAgent-main/
├── .claude/                    # 不变：Agent 配置、规则、工具
│   ├── agents/                 # 10 个 Agent 配置
│   ├── rules/                  # 工作流规则、输出标准等
│   └── tools/                  # PDF/DOCX 处理工具
├── apps/
│   ├── api/                    # 改造：FastAPI 后端
│   │   ├── app/
│   │   │   ├── main.py         # 新增工作流引擎路由
│   │   │   ├── models.py       # 新增 Workflow 模型
│   │   │   ├── services.py     # 改造：多步骤工作流执行
│   │   │   ├── executor.py     # 改造：claude_cli 适配器完善
│   │   │   ├── workflow_engine.py  # 新增：工作流引擎
│   │   │   └── store.py        # 改造：案件即文件夹存储
│   │   └── pyinstaller.spec    # 新增：打包配置
│   ├── web/                    # 改造：Next.js 前端
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx            # 案件列表
│   │       │   ├── cases/[id]/page.tsx # 案件工作台
│   │       │   ├── workflows/page.tsx  # 新增：工作流编辑器
│   │       │   └── settings/page.tsx   # 新增：设置面板
│   │       ├── components/
│   │       │   ├── case-dashboard.tsx  # 改造
│   │       │   ├── case-workspace.tsx  # 改造
│   │       │   ├── workflow-editor.tsx # 新增
│   │       │   ├── task-panel.tsx      # 新增：浮动任务面板
│   │       │   └── onboarding.tsx      # 新增
│   │       └── lib/
│   │           ├── api.ts              # 改造：新增工作流 API
│   │           └── types.ts            # 改造：新增工作流类型
│   └── desktop/                # 新增：Tauri 壳
│       ├── src-tauri/
│       │   ├── src/
│       │   │   └── main.rs     # Sidecar 管理、健康检查、窗口
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       └── sidecar/            # PyInstaller 产物放置目录
├── workflows/                  # 新增：工作流模板
│   ├── preset/                 # 系统预设（7 个 JSON）
│   └── custom/                 # 用户自定义
└── package.json                # 改造：新增 desktop 相关脚本
```

## 6. 后端改造

### 6.1 新增 API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/workflows | 列出所有工作流模板 |
| GET | /api/workflows/{id} | 获取工作流详情 |
| POST | /api/workflows | 创建自定义工作流 |
| PUT | /api/workflows/{id} | 更新自定义工作流 |
| DELETE | /api/workflows/{id} | 删除自定义工作流 |
| POST | /api/workflows/{id}/duplicate | 复制预设为自定义 |
| POST | /api/cases/{id}/execute-workflow | 执行工作流（替代原 create_task） |
| GET | /api/settings | 获取全局设置 |
| PUT | /api/settings | 更新全局设置 |
| GET | /api/health/claude | 检测 Claude Code CLI 状态 |

### 6.2 存储改造

SQLite 索引表：
- `cases`: id, case_code, title, folder_path, created_at, updated_at
- `settings`: key, value (全局配置键值对)

案件文件夹结构：
```
[案件目录]/
├── case.json              # 案件元数据
├── tasks/                 # 任务记录 JSON
├── artifacts/             # 产物内容
├── 00 - 📅 日程管理/     # 标准 12 层目录
├── 01 - 🤝 委托材料/
├── ...
└── 11 - 📚 参考文件/
```

### 6.3 Claude CLI 适配器完善

现有 `claude_cli` 模式改造：
- 支持指定 subagent（通过 prompt 前缀指定 Agent 名）
- 支持传入文件路径作为上下文
- 超时管理（默认 5 分钟/步骤，可配置）
- 进程清理（应用关闭时 kill 子进程）

## 7. Tauri 壳

### 7.1 核心职责

`src-tauri/src/main.rs`:
1. **启动 FastAPI sidecar**: 应用启动时运行 PyInstaller exe
2. **健康检查**: 轮询 `localhost:8000/api/health` 确认就绪
3. **Claude Code 检测**: 查找 claude.exe 路径，验证登录状态
4. **窗口管理**: WebView 加载前端静态资源
5. **进程清理**: 应用关闭时确保 sidecar 退出

### 7.2 Tauri 配置要点

```json
{
  "bundle": {
    "externalBin": ["sidecar/suitagent-api"]
  },
  "window": {
    "url": "index.html",
    "title": "SuitAgent",
    "width": 1280,
    "height": 800,
    "minWidth": 1024,
    "minHeight": 600
  }
}
```

### 7.3 打包流程

```
1. next build && next export    → 静态 HTML/JS/CSS
2. pyinstaller apps/api/...     → suitagent-api.exe
3. cargo tauri build            → SuitAgent.msi
   └── 内含：Tauri 壳 + 静态前端 + API exe
```

最终产物：`.msi` 安装文件，双击安装即用。

## 8. UI Mockup 索引

设计过程中的 mockup 文件保存在 `.superpowers/brainstorm/` 目录：

- `workflow-editor-v3.html` — 工作流编辑器（三栏布局，暖砂色系）
- `case-workspace.html` — 案件工作台（文档中心 + 浮动任务面板）
- `settings-and-onboarding.html` — 设置面板 + 首次启动引导
