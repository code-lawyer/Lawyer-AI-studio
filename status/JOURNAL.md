# JOURNAL

## 2026-03-23

- 深入检查仓库后确认项目原始资产以 `.claude/agents`、`.claude/rules`、`.claude/tools` 为核心，先补产品文档与 MVP 路线。
- 创建了 Web 前端和 FastAPI 后端的工作台原型，形成案件、文档、任务、产物的最小闭环。
- 使用测试先定义新增行为，再补齐数据库持久化、工作流运行记录、审核记录、文档预览和产物导出。
- 将前端案件工作台重写为可读版本，接入文档预览、任务日志、审核历史和导出交互。
- 验证通过 `npm run test:api`、`npm --prefix apps/web run lint` 和 `npm run build:web`。
- 继续推进执行层升级：抽象统一执行器协议，加入 `submit / sync / cancel` 三段式接口。
- 新增 `external_stub` 与 `external_stub_hold` 两种外部执行模拟模式，用于验证真实外部执行环境接入前的状态流转。
- 前端补充运行中任务的取消操作，后端补充任务状态同步接口。
- 根据最新产品定位，补充并重写 PRD 与开发计划，明确 Claude Code 只作为执行层接入，不作为产品本体。
- 检查本机 CLI 后确认存在 `claude.exe`，但当前环境未登录，因此先实现可执行外部命令适配层，再保留 `claude_cli` 作为真实接入模式。
- 新增 `command_runner` 执行器，通过子进程调用外部命令并把 stdout 落成案件产物。
