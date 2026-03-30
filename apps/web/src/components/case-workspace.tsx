"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import {
  cancelTask,
  createTask,
  executeWorkflow,
  exportArtifact,
  fetchCase,
  fetchDocument,
  fetchWorkflows,
  reviewArtifact,
  retryTask,
  uploadDocument,
} from "@/lib/api";
import type {
  CaseDetail,
  DocumentDetail,
  DocumentRecord,
  ReviewRecord,
  TaskRecord,
  WorkflowRunRecord,
  WorkflowTemplate,
} from "@/lib/types";

type Props = {
  caseId: string;
};

const categories = [
  "04 - 📤 客户提供",
  "05 - 📎 证据材料",
  "07 - 📥 对方提交",
  "08 - 🏛️ 法院送达",
  "09 - 🎯 庭审笔录",
];

export function CaseWorkspace({ caseId }: Props) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [documentPreview, setDocumentPreview] = useState<DocumentDetail | null>(null);
  const [reviewComment, setReviewComment] = useState("请确认来源材料和法律结论后再进入正式文书。");
  const [exportMessage, setExportMessage] = useState("");
  const [error, setError] = useState("");
  const [isUploading, startUpload] = useTransition();
  const [isCreatingTask, startTask] = useTransition();
  const [isReviewing, startReview] = useTransition();
  const [isExporting, startExport] = useTransition();
  const [retryingTaskId, setRetryingTaskId] = useState("");
  const [cancelingTaskId, setCancelingTaskId] = useState("");
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [isExecutingWorkflow, startWorkflow] = useTransition();

  useEffect(() => {
    void loadCase();
    fetchWorkflows().then(setWorkflows).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    if (!selectedDocumentId) {
      setDocumentPreview(null);
      return;
    }
    fetchDocument(selectedDocumentId).then(setDocumentPreview).catch(() => {
      setError("文档预览加载失败。");
    });
  }, [selectedDocumentId]);

  async function loadCase() {
    try {
      const response = await fetchCase(caseId);
      setDetail(response);
      setSelectedDocumentId((current) => current || response.documents[0]?.id || "");
      setSelectedArtifactId((current) => current || response.artifacts[0]?.id || "");
      setSelectedTaskId((current) => current || response.tasks[0]?.id || "");
      setError("");
    } catch {
      setError("案件详情加载失败。");
    }
  }

  const selectedArtifact =
    detail?.artifacts.find((item) => item.id === selectedArtifactId) ?? detail?.artifacts[0] ?? null;
  const selectedTask =
    detail?.tasks.find((item) => item.id === selectedTaskId) ?? detail?.tasks[0] ?? null;
  const selectedWorkflow =
    detail?.workflow_runs.find((item) => item.id === selectedTask?.workflow_run_id) ?? null;
  const artifactReviews = detail?.review_records.filter((item) => item.artifact_id === selectedArtifact?.id) ?? [];

  async function handleUpload(formData: FormData) {
    startUpload(async () => {
      try {
        await uploadDocument(caseId, formData);
        await loadCase();
      } catch {
        setError("上传文档失败。");
      }
    });
  }

  async function handleTaskCreate(formData: FormData) {
    startTask(async () => {
      try {
        const documentIds = formData.getAll("document_ids").map(String);
        const task = await createTask(caseId, {
          task_type: String(formData.get("task_type") || ""),
          title: String(formData.get("title") || ""),
          document_ids: documentIds,
        });
        setSelectedTaskId(task.id);
        await loadCase();
      } catch {
        setError("创建任务失败。");
      }
    });
  }

  async function handleRetry(taskId: string) {
    setRetryingTaskId(taskId);
    try {
      const task = await retryTask(taskId);
      setSelectedTaskId(task.id);
      await loadCase();
    } catch {
      setError("任务重试失败。");
    } finally {
      setRetryingTaskId("");
    }
  }

  async function handleCancel(taskId: string) {
    setCancelingTaskId(taskId);
    try {
      const task = await cancelTask(taskId);
      setSelectedTaskId(task.id);
      await loadCase();
    } catch {
      setError("任务取消失败。");
    } finally {
      setCancelingTaskId("");
    }
  }

  async function handleReview(action: "approved" | "rejected") {
    if (!selectedArtifact) return;
    startReview(async () => {
      try {
        await reviewArtifact(selectedArtifact.id, {
          action,
          reviewer_name: detail?.owner_name || "Reviewer",
          comment: reviewComment,
        });
        await loadCase();
      } catch {
        setError("审核提交失败。");
      }
    });
  }

  async function handleExport(format: "docx" | "md") {
    if (!selectedArtifact) return;
    setExportMessage("");
    startExport(async () => {
      try {
        const result = await exportArtifact(selectedArtifact.id, { format });
        setExportMessage(`已导出到 ${result.file_path}`);
        await loadCase();
      } catch {
        setError("导出失败。");
      }
    });
  }

  async function handleWorkflowExecute() {
    if (!selectedWorkflowId || !detail) return;
    const docIds = detail.documents.map((d) => d.id);
    startWorkflow(async () => {
      try {
        await executeWorkflow(caseId, selectedWorkflowId, docIds);
        setTaskPanelOpen(true);
        await loadCase();
      } catch {
        setError("工作流执行失败。");
      }
    });
  }

  if (!detail) {
    return (
      <main className="min-h-screen px-5 py-10 text-sm text-[var(--muted)]">
        正在加载案件工作台...
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8">
      <section className="mx-auto max-w-7xl rounded-[36px] border border-[var(--stroke)] bg-[var(--panel)] p-5 shadow-[0_18px_60px_rgba(84,63,42,0.08)] sm:p-7">
        <div className="flex flex-col gap-4 border-b border-[var(--stroke)] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <Link href="/" className="font-medium text-[var(--accent)]">
                返回案件列表
              </Link>
              <span>/</span>
              <span>{detail.case_code}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{detail.title}</h1>
            <p className="mt-2 text-base text-[var(--muted)]">
              {detail.case_type} · {detail.case_cause} · 当前阶段 {detail.phase}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-[24px] bg-[var(--panel-strong)] p-4 text-sm">
            <SummaryBlock label="文档" value={String(detail.documents.length)} />
            <SummaryBlock label="任务" value={String(detail.tasks.length)} />
            <SummaryBlock label="产物" value={String(detail.artifacts.length)} />
            <SummaryBlock label="负责人" value={detail.owner_name} />
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-[var(--accent)]">{error}</p> : null}
        {exportMessage ? <p className="mt-2 text-sm text-[var(--success)]">{exportMessage}</p> : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-[0.95fr_1.25fr_0.95fr]">
          <section className="rounded-[28px] border border-[var(--stroke)] bg-white/75 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">文档中心</h2>
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">上传与预览</span>
            </div>

            <form action={handleUpload} className="mt-5 space-y-3 rounded-[24px] bg-[var(--panel)] p-4">
              <label className="block text-sm">
                <span className="mb-2 block text-[var(--muted)]">文档分类</span>
                <select
                  name="category"
                  defaultValue="04 - 📤 客户提供"
                  className="w-full rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 outline-none"
                >
                  {categories.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-2 block text-[var(--muted)]">选择文件</span>
                <input
                  type="file"
                  name="file"
                  required
                  className="w-full rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={isUploading}
                className="w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-70"
              >
                {isUploading ? "上传中..." : "上传并提取"}
              </button>
            </form>

            <div className="mt-5 grid gap-3">
              {detail.documents.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  selected={document.id === selectedDocumentId}
                  onSelect={() => setSelectedDocumentId(document.id)}
                />
              ))}
              {detail.documents.length === 0 ? (
                <EmptyBox text="还没有文档。先上传起诉状、证据或庭审材料。" />
              ) : null}
            </div>

            <div className="mt-5 rounded-[22px] border border-[var(--stroke)] bg-white p-4">
              <h3 className="text-lg font-semibold">提取预览</h3>
              {documentPreview ? (
                <>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {documentPreview.file_name} · {documentPreview.processing_status}
                  </p>
                  <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
                    {documentPreview.extracted_text}
                  </pre>
                </>
              ) : (
                <p className="mt-3 text-sm text-[var(--muted)]">选择一份文档查看提取结果。</p>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--stroke)] bg-[var(--panel)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">产物与审核</h2>
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">review loop</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {detail.artifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  type="button"
                  onClick={() => setSelectedArtifactId(artifact.id)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    selectedArtifact?.id === artifact.id
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--panel-strong)] text-[var(--foreground)]"
                  }`}
                >
                  {artifact.title}
                </button>
              ))}
            </div>

            <div className="mt-5 min-h-[460px] rounded-[28px] border border-[var(--stroke)] bg-white p-5">
              {selectedArtifact ? (
                <>
                  <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke)] pb-4">
                    <div>
                      <h3 className="text-2xl font-semibold">{selectedArtifact.title}</h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        类型 {selectedArtifact.artifact_type} · 审核状态 {selectedArtifact.review_status}
                      </p>
                      {selectedArtifact.reviewed_by ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          最近审核：{selectedArtifact.reviewed_by} · {selectedArtifact.reviewed_at}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge status={selectedArtifact.review_status} />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 rounded-[22px] bg-[var(--panel)] p-4">
                    <textarea
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      className="min-h-24 rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-sm outline-none"
                      placeholder="填写审核意见"
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={isReviewing}
                        onClick={() => handleReview("approved")}
                        className="rounded-full bg-[var(--success)] px-4 py-2 text-sm font-semibold text-white"
                      >
                        通过
                      </button>
                      <button
                        type="button"
                        disabled={isReviewing}
                        onClick={() => handleReview("rejected")}
                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
                      >
                        驳回
                      </button>
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={() => handleExport("docx")}
                        className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-white"
                      >
                        导出 DOCX
                      </button>
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={() => handleExport("md")}
                        className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                      >
                        导出 Markdown
                      </button>
                    </div>
                  </div>

                  <pre className="mt-5 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">
                    {selectedArtifact.content}
                  </pre>

                  <div className="mt-5 rounded-[22px] border border-[var(--stroke)] bg-[var(--panel)] p-4">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      审核历史
                    </h4>
                    <div className="mt-3 space-y-3">
                      {artifactReviews.map((record) => (
                        <ReviewItem key={record.id} record={record} />
                      ))}
                      {artifactReviews.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">还没有审核记录。</p>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm leading-7 text-[var(--muted)]">先选择一个产物查看内容和审核记录。</p>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--stroke)] bg-[var(--panel)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">任务与运行</h2>
              <button
                type="button"
                onClick={() => setTaskPanelOpen(!taskPanelOpen)}
                className="rounded-full border border-[var(--stroke)] px-3 py-1 text-xs text-[var(--muted)] transition hover:bg-[var(--panel-strong)]"
              >
                {taskPanelOpen ? "收起面板" : "展开面板"}
              </button>
            </div>

            {/* Workflow execution */}
            <div className="mt-5 rounded-[24px] border border-[var(--stroke)] bg-[var(--panel-strong)] p-4">
              <div className="text-sm font-medium mb-3">执行工作流</div>
              <div className="flex gap-2">
                <select
                  value={selectedWorkflowId}
                  onChange={(e) => setSelectedWorkflowId(e.target.value)}
                  className="flex-1 rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm outline-none"
                >
                  <option value="">选择工作流...</option>
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>{wf.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedWorkflowId || isExecutingWorkflow}
                  onClick={handleWorkflowExecute}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {isExecutingWorkflow ? "执行中..." : "执行"}
                </button>
              </div>
            </div>

            {/* Manual task creation */}
            <form action={handleTaskCreate} className="mt-4 space-y-3 rounded-[24px] border border-[var(--stroke)] bg-[var(--panel-strong)] p-4">
              <label className="block text-sm">
                <span className="mb-2 block text-[var(--muted)]">任务类型</span>
                <select
                  name="task_type"
                  defaultValue="legal_research"
                  className="w-full rounded-xl border border-[var(--stroke)] bg-white px-4 py-3 outline-none"
                >
                  <option value="legal_research">法律研究</option>
                  <option value="case_analysis">案件分析</option>
                  <option value="evidence_review">证据审查</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-2 block text-[var(--muted)]">任务标题</span>
                <input
                  name="title"
                  defaultValue="法律研究备忘录"
                  className="w-full rounded-xl border border-[var(--stroke)] bg-white px-4 py-3 outline-none"
                />
              </label>

              <fieldset className="rounded-xl border border-[var(--stroke)] p-3">
                <legend className="px-2 text-sm text-[var(--muted)]">选择输入文档</legend>
                <div className="mt-2 space-y-2">
                  {detail.documents.map((document) => (
                    <label key={document.id} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        name="document_ids"
                        value={document.id}
                        defaultChecked={detail.documents.length === 1}
                      />
                      <span>{document.file_name}</span>
                    </label>
                  ))}
                  {detail.documents.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">先上传文档，任务才能有输入材料。</p>
                  ) : null}
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={isCreatingTask}
                className="w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-70"
              >
                {isCreatingTask ? "执行中..." : "发起任务"}
              </button>
            </form>

            <div className="mt-4 rounded-[24px] border border-[var(--stroke)] bg-[var(--panel-strong)] p-4">
              <h3 className="text-lg font-semibold">任务列表</h3>
              <div className="mt-4 space-y-3">
                {detail.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    selected={task.id === selectedTaskId}
                    retryDisabled={retryingTaskId === task.id}
                    cancelDisabled={cancelingTaskId === task.id}
                    onSelect={() => setSelectedTaskId(task.id)}
                    onRetry={() => handleRetry(task.id)}
                    onCancel={() => handleCancel(task.id)}
                  />
                ))}
                {detail.tasks.length === 0 ? <EmptyBox text="还没有任务记录。" /> : null}
              </div>
            </div>

            {/* Floating task panel */}
            {taskPanelOpen && (
              <div className="mt-4 rounded-[24px] border border-[var(--stroke)] bg-white p-4">
                <h3 className="text-lg font-semibold">运行详情</h3>
                {selectedTask ? (
                  <div className="mt-4 space-y-4">
                    <RunStat label="Workflow Run" value={selectedTask.workflow_run_id} />
                    <RunStat label="External Task" value={selectedTask.external_task_id || "pending"} />
                    <RunStat label="Attempts" value={String(selectedTask.attempts)} />
                    {selectedWorkflow ? <WorkflowCard workflow={selectedWorkflow} /> : null}
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">执行日志</div>
                      <div className="mt-2 space-y-2">
                        {selectedTask.logs.map((log) => (
                          <div key={log} className="rounded-xl border border-[var(--stroke)] bg-[var(--panel-strong)] px-3 py-2 text-sm">
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--muted)]">选择一个任务查看运行日志。</p>
                )}
              </div>
            )}

            <div className="mt-4 rounded-[24px] border border-[var(--stroke)] bg-[var(--panel-strong)] p-4">
              <h3 className="text-lg font-semibold">案件时间线</h3>
              <div className="mt-4 space-y-3">
                {detail.timeline
                  .slice()
                  .reverse()
                  .map((item) => (
                    <div key={item.id} className="rounded-xl border border-[var(--stroke)] bg-white p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{item.kind}</div>
                      <p className="mt-2 text-sm leading-6">{item.message}</p>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function DocumentCard({
  document,
  selected,
  onSelect,
}: {
  document: DocumentRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-[22px] border p-4 text-left transition ${
        selected
          ? "border-[var(--accent)] bg-[#fff3ec]"
          : "border-[var(--stroke)] bg-white hover:border-[var(--accent-soft)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{document.file_name}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">{document.category}</p>
        </div>
        <span className="rounded-full bg-[#e7f0eb] px-3 py-1 text-xs font-medium text-[var(--success)]">
          {document.processing_status}
        </span>
      </div>
    </button>
  );
}

function TaskCard({
  task,
  selected,
  retryDisabled,
  cancelDisabled,
  onSelect,
  onRetry,
  onCancel,
}: {
  task: TaskRecord;
  selected: boolean;
  retryDisabled: boolean;
  cancelDisabled: boolean;
  onSelect: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        selected ? "border-[var(--accent)] bg-[var(--accent-bg)]" : "border-[var(--stroke)] bg-white"
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{task.title}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {task.task_type} · 第 {task.attempts} 次 · {task.execution_mode}
            </div>
          </div>
          <StatusBadge status={task.status} />
        </div>
      </button>
      {task.error_message ? <p className="mt-3 text-sm text-[var(--error)]">{task.error_message}</p> : null}
      {task.status === "failed" ? (
        <button
          type="button"
          disabled={retryDisabled}
          onClick={onRetry}
          className="mt-3 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-70"
        >
          {retryDisabled ? "重试中..." : "重试任务"}
        </button>
      ) : null}
      {task.status === "running" ? (
        <button
          type="button"
          disabled={cancelDisabled}
          onClick={onCancel}
          className="mt-3 rounded-full border border-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent)] disabled:opacity-70"
        >
          {cancelDisabled ? "取消中..." : "取消任务"}
        </button>
      ) : null}
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: WorkflowRunRecord }) {
  return (
    <div className="rounded-xl border border-[var(--stroke)] bg-[var(--panel-strong)] p-3">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Workflow Run</div>
      <div className="mt-2 text-sm font-semibold">{workflow.title}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">
        {workflow.workflow_type} · {workflow.status}
      </div>
      {workflow.error_message ? <p className="mt-2 text-sm text-[var(--error)]">{workflow.error_message}</p> : null}
    </div>
  );
}

function ReviewItem({ record }: { record: ReviewRecord }) {
  return (
    <div className="rounded-[18px] border border-[var(--stroke)] bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{record.reviewer_name}</div>
        <StatusBadge status={record.action} />
      </div>
      <p className="mt-2 text-sm text-[var(--foreground)]">{record.comment || "无备注"}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">{record.created_at}</p>
    </div>
  );
}

function RunStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    approved: "bg-[#d9efe4] text-[#235944]",
    completed: "bg-[#d9efe4] text-[#235944]",
    rejected: "bg-[#f8ddd6] text-[#9f3a2d]",
    failed: "bg-[#f8ddd6] text-[#9f3a2d]",
    waiting_review: "bg-[#efe2c9] text-[#6f5637]",
    pending: "bg-[#efe2c9] text-[#6f5637]",
    running: "bg-[#d6e4ef] text-[#315b7a]",
    canceled: "bg-[#ddd] text-[#444]",
  };

  const className = map[status as keyof typeof map] ?? "bg-[#eee] text-[#444]";
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>{status}</span>;
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--stroke)] bg-white/70 p-4 text-sm text-[var(--muted)]">
      {text}
    </div>
  );
}
