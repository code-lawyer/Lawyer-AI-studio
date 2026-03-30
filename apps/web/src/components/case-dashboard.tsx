"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { createCase, fetchCases } from "@/lib/api";
import type { CaseRecord } from "@/lib/types";

const initialForm = {
  case_code: "",
  title: "",
  case_type: "民事诉讼",
  case_cause: "",
  owner_name: "",
};

export function CaseDashboard() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetchCases().then(setCases).catch(() => {
      setError("案件列表加载失败。");
    });
  }, []);

  function updateField(key: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submitCase(formData: FormData) {
    setError("");
    startTransition(async () => {
      try {
        const payload = {
          case_code: String(formData.get("case_code") || "").trim(),
          title: String(formData.get("title") || "").trim(),
          case_type: String(formData.get("case_type") || "").trim(),
          case_cause: String(formData.get("case_cause") || "").trim(),
          owner_name: String(formData.get("owner_name") || "").trim(),
        };
        const created = await createCase(payload);
        setCases((current) => [created, ...current]);
        setForm(initialForm);
      } catch {
        setError("创建案件失败，请检查输入内容。");
      }
    });
  }

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8">
      <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.25fr_0.9fr]">
        <div className="rounded-[32px] border border-[var(--stroke)] bg-[var(--panel)] p-6 shadow-[0_18px_60px_rgba(84,63,42,0.08)] sm:p-8">
          <div className="flex flex-col gap-4 border-b border-[var(--stroke)] pb-6">
            <p className="text-sm font-medium uppercase tracking-[0.26em] text-[var(--accent)]">
              SuitAgent Workspace
            </p>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">半自动案件工作台</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                  用案件作为主视图，把材料、任务、AI 产物和审核状态放到一个工作面板里。
                  当前版本已经支持案件建档、文档上传、任务发起、结果审核和导出。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-[24px] bg-[var(--panel-strong)] p-4 text-sm">
                <div>
                  <div className="text-[var(--muted)]">案件数</div>
                  <div className="mt-1 text-2xl font-semibold">{cases.length}</div>
                </div>
                <div>
                  <div className="text-[var(--muted)]">当前阶段</div>
                  <div className="mt-1 text-2xl font-semibold">MVP</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cases.map((item) => (
              <Link
                key={item.id}
                href={`/cases/${item.id}`}
                className="group rounded-[24px] border border-[var(--stroke)] bg-white/80 p-5 transition-transform duration-200 hover:-translate-y-1 hover:border-[var(--accent-soft)]"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
                    {item.case_type}
                  </span>
                  <span className="text-xs text-[var(--muted)]">{item.phase}</span>
                </div>
                <h2 className="mt-4 text-xl font-semibold leading-8">{item.title}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{item.case_code}</p>
                <div className="mt-6 flex items-center justify-between text-sm">
                  <span className="text-[var(--muted)]">负责人：{item.owner_name}</span>
                  <span className="font-medium text-[var(--accent)]">进入工作台</span>
                </div>
              </Link>
            ))}
            {cases.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[var(--stroke)] bg-white/70 p-6 text-sm leading-7 text-[var(--muted)]">
                还没有案件。右侧新建一个案件后，就可以进入案件工作台继续上传材料和发起任务。
              </div>
            ) : null}
          </div>
        </div>

        <aside className="rounded-[32px] border border-[var(--stroke)] bg-[#1d2c2f] p-6 text-[#f7f0e5] shadow-[0_18px_60px_rgba(29,44,47,0.28)] sm:p-8">
          <div className="border-b border-white/10 pb-5">
            <p className="text-sm uppercase tracking-[0.22em] text-[#f4b596]">创建案件</p>
            <h2 className="mt-3 text-3xl font-semibold">先把案件骨架建起来</h2>
          </div>

          <form action={submitCase} className="mt-6 space-y-4">
            <LabeledInput
              label="案件编号"
              name="case_code"
              value={form.case_code}
              onChange={updateField}
              placeholder="SUIT-2026-001"
            />
            <LabeledInput
              label="案件标题"
              name="title"
              value={form.title}
              onChange={updateField}
              placeholder="委托合同纠纷"
            />
            <LabeledSelect
              label="案件类型"
              name="case_type"
              value={form.case_type}
              onChange={updateField}
              options={["民事诉讼", "商事争议", "劳动争议", "执行案件"]}
            />
            <LabeledInput
              label="案由"
              name="case_cause"
              value={form.case_cause}
              onChange={updateField}
              placeholder="服务合同纠纷"
            />
            <LabeledInput
              label="负责人"
              name="owner_name"
              value={form.owner_name}
              onChange={updateField}
              placeholder="张律师"
            />

            {error ? <p className="text-sm text-[#ffcab8]">{error}</p> : null}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-full bg-[#efb582] px-5 py-3 text-sm font-semibold text-[#1d2c2f] transition hover:bg-[#f6caa1] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "创建中..." : "创建案件工作台"}
            </button>
          </form>

          <div className="mt-8 rounded-[24px] bg-white/6 p-5 text-sm leading-7 text-[#d4cec2]">
            <p className="font-medium text-white">MVP 已支持</p>
            <ul className="mt-3 space-y-2">
              <li>案件目录初始化</li>
              <li>文档上传与提取预览</li>
              <li>AI 任务执行与重试</li>
              <li>产物审核、审核历史和导出</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}

type InputProps = {
  label: string;
  name: keyof typeof initialForm;
  value: string;
  placeholder?: string;
  onChange: (key: keyof typeof initialForm, value: string) => void;
};

function LabeledInput({ label, name, value, placeholder, onChange }: InputProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[#d2d7d7]">{label}</span>
      <input
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(name, event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition placeholder:text-[#8ba0a2] focus:border-[#efb582]"
      />
    </label>
  );
}

type SelectProps = {
  label: string;
  name: keyof typeof initialForm;
  value: string;
  options: string[];
  onChange: (key: keyof typeof initialForm, value: string) => void;
};

function LabeledSelect({ label, name, value, options, onChange }: SelectProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[#d2d7d7]">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition focus:border-[#efb582]"
      >
        {options.map((option) => (
          <option key={option} value={option} className="text-black">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
