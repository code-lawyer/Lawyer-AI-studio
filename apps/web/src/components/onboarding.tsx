"use client";

import { useState } from "react";
import { updateSettings } from "@/lib/api";

const STEPS = [
  {
    title: "安装应用",
    description: "SuitAgent 桌面客户端已安装完成",
    auto: true,
  },
  {
    title: "安装 Claude Code",
    description: "检测到 Claude Code CLI 已安装",
    auto: true,
  },
  {
    title: "登录 Claude Code",
    description: "请在终端运行 claude login 完成登录",
    auto: false,
  },
  {
    title: "选择存储位置",
    description: "选择案件文件的默认存储目录",
    auto: false,
  },
  {
    title: "创建第一个案件",
    description: "前往案件列表创建您的第一个案件",
    auto: false,
  },
];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(2);

  async function handleNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await updateSettings({ onboarding_completed: true });
      onComplete();
    }
  }

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--stroke)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
      }}
    >
      <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
        快速上手指引
      </h3>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        {STEPS.map((step, index) => {
          const isDone = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div
              key={step.title}
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-start",
                opacity: !isDone && !isCurrent ? 0.5 : 1,
              }}
            >
              <div
                style={{
                  width: "1.5rem",
                  height: "1.5rem",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  flexShrink: 0,
                  background: isDone
                    ? "var(--success)"
                    : isCurrent
                      ? "var(--accent)"
                      : "var(--panel-strong)",
                  color: isDone || isCurrent ? "white" : "var(--muted)",
                }}
              >
                {isDone ? "\u2713" : index + 1}
              </div>
              <div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: isDone || isCurrent ? 500 : 400,
                    color: isDone
                      ? "var(--success)"
                      : isCurrent
                        ? "var(--foreground)"
                        : "var(--muted)",
                  }}
                >
                  {step.title}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    marginTop: "0.125rem",
                  }}
                >
                  {step.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        style={{
          marginTop: "1.25rem",
          background: "var(--panel-strong)",
          borderRadius: "0.25rem",
          height: "0.25rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${(currentStep / (STEPS.length - 1)) * 100}%`,
            height: "100%",
            background: "var(--accent)",
            transition: "width 0.3s",
            borderRadius: "0.25rem",
          }}
        />
      </div>

      <button
        onClick={handleNext}
        style={{
          marginTop: "1rem",
          width: "100%",
          padding: "0.625rem",
          borderRadius: "0.375rem",
          border: "none",
          background: "var(--accent)",
          color: "white",
          cursor: "pointer",
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        {currentStep < STEPS.length - 1 ? "下一步" : "完成设置"}
      </button>
    </div>
  );
}
