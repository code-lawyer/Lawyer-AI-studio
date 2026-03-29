# CHANGELOG

## 2026-03-23

### Added

- 新增 `docs/product/PRD-半自动案件工作台.md`
- 新增 `docs/product/开发计划-半自动案件工作台.md`
- 新增 `docs/product/MVP-任务清单.md`
- 新增 `apps/api` FastAPI MVP 服务
- 新增 `apps/web` Next.js 工作台前端
- 新增根级 `package.json` 统一运行脚本

### Changed

- 重写 `docs/product/PRD-半自动案件工作台.md`，明确 SuitAgent 是案件工作台，Claude Code 是可替换执行器
- 重写 `docs/product/开发计划-半自动案件工作台.md`，明确执行器适配层的边界和后续接入方向
- 将后端持久化从本地 JSON 文件升级为 SQLite 数据库存储
- 为任务模型补充 `workflow_run_id`、`external_task_id` 和执行日志
- 为案件详情补充 `workflow_runs` 与 `review_records`
- 新增文档详情预览接口、审核历史接口和产物导出接口
- 重写案件工作台前端，补齐文档预览、任务日志、审核历史和导出操作
- 引入统一执行器协议，新增 `external_stub` 与 `external_stub_hold` 模式
- 新增任务取消接口，并在查询任务/案件详情时支持任务状态同步
- 移除 `next/font/google` 依赖，改为本地安全字体栈，避免构建受外网字体请求影响
- 新增 `command_runner` 与 `claude_cli` 执行器模式，支持通过外部命令真正执行 AI 任务
- 新增外部命令执行器回归测试，验证 stdout 产物回传链路

### Notes

- 当前版本仍使用本地执行适配器模拟 Claude Code 类执行环境
- 当前版本使用 SQLite 作为 MVP 级持久化方案，Postgres 与队列系统放到下一阶段
