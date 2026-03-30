"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  fetchWorkflows,
  createWorkflow,
  duplicateWorkflow,
  deleteWorkflow,
  updateWorkflow,
} from "@/lib/api";
import type { WorkflowTemplate, WorkflowStep } from "@/lib/types";

const AGENTS = [
  {
    group: "输入层",
    items: [
      { id: "doc-analyzer", label: "文档分析" },
      { id: "evidence-analyzer", label: "证据分析" },
    ],
  },
  {
    group: "分析层",
    items: [
      { id: "issue-identifier", label: "争议识别" },
      { id: "researcher", label: "法律研究" },
      { id: "strategist", label: "诉讼策略" },
    ],
  },
  {
    group: "输出层",
    items: [
      { id: "writer", label: "法律文书" },
      { id: "reporter", label: "报告整合" },
      { id: "summarizer", label: "摘要生成" },
    ],
  },
  {
    group: "支持层",
    items: [
      { id: "scheduler", label: "日程管理" },
      { id: "reviewer", label: "质量审查" },
    ],
  },
];

type KeyedStep = WorkflowStep & { _key: string };

function SortableStep({
  step,
  onRemove,
  onLabelChange,
  isPreset,
}: {
  step: KeyedStep;
  onRemove: () => void;
  onLabelChange: (label: string) => void;
  isPreset: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: step._key, disabled: isPreset });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        background: "var(--panel)",
        border: "1px solid var(--stroke)",
        borderRadius: "0.5rem",
        fontSize: "0.875rem",
      }}
    >
      {!isPreset && (
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: "grab", color: "var(--muted)", userSelect: "none" }}
        >
          ⠿
        </span>
      )}
      <span
        style={{
          width: "1.5rem",
          height: "1.5rem",
          borderRadius: "50%",
          background: "var(--accent-bg)",
          color: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.75rem",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {step.order}
      </span>
      <span
        style={{
          color: "var(--muted)",
          fontSize: "0.75rem",
          width: "5rem",
          flexShrink: 0,
        }}
      >
        {step.agent}
      </span>
      {isPreset ? (
        <span style={{ flex: 1 }}>{step.label}</span>
      ) : (
        <input
          value={step.label}
          onChange={(e) => onLabelChange(e.target.value)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: "0.875rem",
            color: "var(--foreground)",
          }}
        />
      )}
      {!isPreset && (
        <button
          onClick={onRemove}
          style={{
            color: "var(--muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function WorkflowEditor() {
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selected, setSelected] = useState<WorkflowTemplate | null>(null);
  const [editSteps, setEditSteps] = useState<KeyedStep[]>([]);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editKeywords, setEditKeywords] = useState("");
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    fetchWorkflows().then(setWorkflows).catch(console.error);
  }, []);

  function selectWorkflow(wf: WorkflowTemplate) {
    setSelected(wf);
    setEditName(wf.name);
    setEditDesc(wf.description);
    setEditKeywords(wf.trigger_keywords.join(", "));
    setEditSteps(
      wf.steps.map((s, i) => ({ ...s, _key: `step-${i}-${s.agent}` })),
    );
    setDirty(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEditSteps((items) => {
        const oldIndex = items.findIndex((i) => i._key === active.id);
        const newIndex = items.findIndex((i) => i._key === over.id);
        return arrayMove(items, oldIndex, newIndex).map((s, i) => ({
          ...s,
          order: i + 1,
        }));
      });
      setDirty(true);
    }
  }

  function addStep(agentId: string, agentLabel: string) {
    if (!selected || selected.category === "preset") return;
    const newStep: KeyedStep = {
      order: editSteps.length + 1,
      agent: agentId,
      label: agentLabel,
      _key: `step-${Date.now()}-${agentId}`,
    };
    setEditSteps((prev) => [...prev, newStep]);
    setDirty(true);
  }

  function removeStep(key: string) {
    setEditSteps((prev) =>
      prev
        .filter((s) => s._key !== key)
        .map((s, i) => ({ ...s, order: i + 1 })),
    );
    setDirty(true);
  }

  function updateStepLabel(key: string, label: string) {
    setEditSteps((prev) =>
      prev.map((s) => (s._key === key ? { ...s, label } : s)),
    );
    setDirty(true);
  }

  async function handleSave() {
    if (!selected || selected.category === "preset") return;
    const payload = {
      name: editName,
      description: editDesc,
      steps: editSteps.map(({ _key, ...rest }) => rest),
      trigger_keywords: editKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    };
    const updated = await updateWorkflow(selected.id, payload);
    setWorkflows((prev) =>
      prev.map((w) => (w.id === updated.id ? updated : w)),
    );
    setSelected(updated);
    setDirty(false);
  }

  async function handleDuplicate() {
    if (!selected) return;
    const dup = await duplicateWorkflow(selected.id);
    setWorkflows((prev) => [...prev, dup]);
    selectWorkflow(dup);
  }

  async function handleDelete() {
    if (!selected || selected.category === "preset") return;
    await deleteWorkflow(selected.id);
    setWorkflows((prev) => prev.filter((w) => w.id !== selected.id));
    setSelected(null);
  }

  async function handleCreate() {
    const wf = await createWorkflow({
      name: "新工作流",
      description: "",
      steps: [],
    });
    setWorkflows((prev) => [...prev, wf]);
    selectWorkflow(wf);
  }

  const presets = workflows.filter((w) => w.category === "preset");
  const customs = workflows.filter((w) => w.category === "custom");
  const isPreset = selected?.category === "preset";

  function WorkflowGroup({ title, items }: { title: string; items: WorkflowTemplate[] }) {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: "0.5rem",
          }}
        >
          {title}
        </div>
        {items.map((wf) => (
          <button
            key={wf.id}
            onClick={() => selectWorkflow(wf)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
              background:
                selected?.id === wf.id
                  ? "var(--accent-bg)"
                  : "transparent",
              color:
                selected?.id === wf.id
                  ? "var(--accent)"
                  : "var(--foreground)",
              fontWeight: selected?.id === wf.id ? 500 : 400,
            }}
          >
            {wf.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 3.5rem)" }}>
      {/* Left: Workflow list */}
      <aside
        style={{
          width: "240px",
          borderRight: "1px solid var(--stroke)",
          background: "var(--panel)",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        <div style={{ padding: "1rem", flex: 1 }}>
          <WorkflowGroup title="系统预设" items={presets} />
          <WorkflowGroup title="我的工作流" items={customs} />
        </div>
        <div style={{ padding: "1rem", borderTop: "1px solid var(--stroke)" }}>
          <button
            onClick={handleCreate}
            style={{
              width: "100%",
              padding: "0.625rem",
              borderRadius: "0.375rem",
              border: "1px dashed var(--stroke)",
              background: "transparent",
              cursor: "pointer",
              fontSize: "0.875rem",
              color: "var(--muted)",
            }}
          >
            + 新建工作流
          </button>
        </div>
      </aside>

      {/* Center: Pipeline editor */}
      <main style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
        {selected ? (
          <>
            <div style={{ marginBottom: "1.5rem" }}>
              {isPreset ? (
                <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
                  {selected.name}
                </h2>
              ) : (
                <input
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setDirty(true);
                  }}
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 600,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    width: "100%",
                    color: "var(--foreground)",
                  }}
                />
              )}
              {isPreset ? (
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--muted)",
                    marginTop: "0.25rem",
                  }}
                >
                  {selected.description}
                </p>
              ) : (
                <input
                  value={editDesc}
                  onChange={(e) => {
                    setEditDesc(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="工作流描述..."
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--muted)",
                    fontSize: "0.875rem",
                    marginTop: "0.25rem",
                  }}
                />
              )}
            </div>

            {/* Action buttons */}
            <div
              style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
            >
              {isPreset && (
                <button
                  onClick={handleDuplicate}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--accent)",
                    background: "var(--accent-bg)",
                    color: "var(--accent)",
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                  }}
                >
                  复制为自定义
                </button>
              )}
              {!isPreset && dirty && (
                <button
                  onClick={handleSave}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    border: "none",
                    background: "var(--accent)",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                  }}
                >
                  保存更改
                </button>
              )}
              {!isPreset && (
                <button
                  onClick={handleDelete}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--error)",
                    background: "transparent",
                    color: "var(--error)",
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                  }}
                >
                  删除
                </button>
              )}
            </div>

            {/* Steps */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={editSteps.map((s) => s._key)}
                  strategy={verticalListSortingStrategy}
                >
                  {editSteps.map((step) => (
                    <SortableStep
                      key={step._key}
                      step={step}
                      isPreset={!!isPreset}
                      onRemove={() => removeStep(step._key)}
                      onLabelChange={(label) =>
                        updateStepLabel(step._key, label)
                      }
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {/* Trigger keywords */}
            <div style={{ marginTop: "1.5rem" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--muted)",
                  marginBottom: "0.5rem",
                }}
              >
                触发关键词
              </div>
              {isPreset ? (
                <div
                  style={{
                    display: "flex",
                    gap: "0.375rem",
                    flexWrap: "wrap",
                  }}
                >
                  {selected.trigger_keywords.map((kw) => (
                    <span
                      key={kw}
                      style={{
                        padding: "0.25rem 0.625rem",
                        borderRadius: "1rem",
                        background: "var(--panel-strong)",
                        fontSize: "0.75rem",
                        color: "var(--muted)",
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              ) : (
                <input
                  value={editKeywords}
                  onChange={(e) => {
                    setEditKeywords(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="逗号分隔的关键词..."
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid var(--stroke)",
                    background: "var(--panel)",
                    fontSize: "0.8125rem",
                    outline: "none",
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--muted)",
              fontSize: "0.875rem",
            }}
          >
            从左侧选择一个工作流开始编辑
          </div>
        )}
      </main>

      {/* Right: Agent palette */}
      <aside
        style={{
          width: "200px",
          borderLeft: "1px solid var(--stroke)",
          background: "var(--panel)",
          overflow: "auto",
          padding: "1rem",
        }}
      >
        <div
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: "0.75rem",
          }}
        >
          可用 Agent
        </div>
        {AGENTS.map((group) => (
          <div key={group.group} style={{ marginBottom: "1rem" }}>
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--muted)",
                marginBottom: "0.375rem",
                fontWeight: 500,
              }}
            >
              {group.group}
            </div>
            {group.items.map((agent) => (
              <button
                key={agent.id}
                onClick={() => addStep(agent.id, agent.label)}
                disabled={!selected || selected.category === "preset"}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.375rem 0.5rem",
                  borderRadius: "0.25rem",
                  border: "none",
                  cursor:
                    selected && selected.category !== "preset"
                      ? "pointer"
                      : "default",
                  background: "transparent",
                  fontSize: "0.8125rem",
                  color:
                    selected && selected.category !== "preset"
                      ? "var(--foreground)"
                      : "var(--muted)",
                  opacity:
                    selected && selected.category !== "preset" ? 1 : 0.5,
                }}
              >
                {agent.label}
              </button>
            ))}
          </div>
        ))}
      </aside>
    </div>
  );
}
