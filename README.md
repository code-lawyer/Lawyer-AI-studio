# SuitAgent — 诉讼法律服务智能分析系统

基于 AI Agent 的法律案件分析与工作流自动化平台，覆盖诉讼全生命周期。

## 系统架构

```
┌─────────────────────────────────────────────────┐
│               Tauri 桌面客户端                    │
│          (Rust + WebView, MSI/NSIS)              │
├─────────────────────────────────────────────────┤
│            Next.js 前端 (React 19)               │
│     案件管理 · 工作流编辑器 · 文档工作台           │
├─────────────────────────────────────────────────┤
│            FastAPI 后端 (Python)                  │
│   案件 CRUD · 工作流引擎 · 任务调度 · 产物管理     │
├─────────────────────────────────────────────────┤
│             Claude Code CLI                      │
│          10 个专业 AI Agent 执行层                │
└─────────────────────────────────────────────────┘
```

## 核心特性

- **10 个专业 AI Agent**：文档分析、证据质证、争议识别、法律研究、诉讼策略、文书起草、报告整合、摘要生成、日程管理、质量审查
- **7 个预设工作流**：被告应诉、原告起诉、新证据质证、庭审后分析、法律服务方案、策略优化、制作委托材料
- **自定义工作流**：可视化编辑器，支持拖拽排序、Agent 自由组合
- **案件全生命周期管理**：从立案到结案的完整文档管理与分析
- **桌面客户端**：Tauri 打包，一键安装，内置 API 服务

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面 | Tauri 2 + Rust |
| 前端 | Next.js 16 + React 19 + Tailwind CSS 4 |
| 后端 | FastAPI + Python 3 |
| AI | Claude Code CLI + 10 Subagent |
| 数据 | SQLite (JsonStore) |

## 快速开始

### 前置要求

- Node.js 18+
- Python 3.10+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (已登录)

### 开发模式

```bash
# 安装前端依赖
npm --prefix apps/web install

# 安装后端依赖
pip install -r apps/api/requirements.txt

# 启动 API 服务 (端口 8000)
npm run dev:api

# 启动前端开发服务器 (另一个终端)
npm run dev:web
```

### 运行测试

```bash
npm run test:api
```

### 构建桌面客户端

```bash
# 1. 构建 API 可执行文件
cd apps/api
pyinstaller suitagent-api.spec

# 2. 构建前端静态文件
npm run build:web

# 3. 编译 Tauri 桌面客户端
cd apps/desktop
npm run tauri build
```

产物位于 `apps/desktop/src-tauri/target/release/bundle/` 目录下。

## 项目结构

```
SuitAgent-main/
├── apps/
│   ├── api/                  # FastAPI 后端
│   │   ├── app/              # 应用代码
│   │   │   ├── main.py       # 入口 & 路由
│   │   │   ├── models.py     # Pydantic 模型
│   │   │   ├── services.py   # 业务逻辑
│   │   │   └── workflow_engine.py  # 工作流引擎
│   │   └── tests/            # pytest 测试
│   ├── desktop/              # Tauri 桌面客户端
│   │   └── src-tauri/        # Rust 源码 & 配置
│   └── web/                  # Next.js 前端
│       └── src/
│           ├── app/          # 页面路由
│           ├── components/   # React 组件
│           └── lib/          # API 客户端 & 类型
├── workflows/
│   ├── preset/               # 7 个系统预设工作流
│   └── custom/               # 用户自定义工作流
├── .claude/
│   ├── agents/               # 10 个 AI Agent 定义
│   └── rules/                # 系统规则配置
├── docs/
│   └── USER_MANUAL.md        # 用户手册
└── output/                   # 案件输出目录
```

## AI Agent 架构

```
输入层    DocAnalyzer（文档分析）    EvidenceAnalyzer（证据分析）
           ↓                          ↓
分析层    IssueIdentifier（争议识别）  Researcher（法律研究）  Strategist（策略）
           ↓                          ↓                      ↓
输出层    Writer（文书起草）          Reporter（报告）        Summarizer（摘要）
           ↓                          ↓
支持层    Scheduler（日程）           Reviewer（审查）
```

## 预设工作流

| 工作流 | 场景 | Agent 链 |
|--------|------|----------|
| 被告应诉 | 收到起诉状 | DocAnalyzer → IssueIdentifier → Researcher → Strategist → Writer → Reporter |
| 原告起诉 | 准备起诉 | DocAnalyzer → IssueIdentifier → Researcher → EvidenceAnalyzer → Writer → Reporter |
| 新证据质证 | 收到新证据 | DocAnalyzer → EvidenceAnalyzer → Researcher → Writer → Summarizer |
| 庭审后分析 | 庭审结束 | DocAnalyzer → EvidenceAnalyzer → Strategist → Summarizer → Reporter |
| 法律服务方案 | 客户咨询 | DocAnalyzer → IssueIdentifier → Strategist → Writer → Summarizer |
| 策略优化 | 新情况反馈 | DocAnalyzer → EvidenceAnalyzer → Strategist → Reporter |
| 制作委托材料 | 确定委托 | DocAnalyzer → Writer → Summarizer → Reporter |

## 许可证

[AGPL-3.0](LICENSE)
