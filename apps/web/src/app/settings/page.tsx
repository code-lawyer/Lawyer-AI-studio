"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSettings, updateSettings } from "@/lib/api";
import { Onboarding } from "@/components/onboarding";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    fetchSettings().then(setSettings).catch(console.error);
  }, []);

  const persistSetting = useCallback(async (key: keyof Settings, value: string | boolean) => {
    setSaving(true);
    try {
      const updated = await updateSettings({ [key]: value });
      setSettings(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }, []);

  function handleChange(key: keyof Settings, value: string | boolean) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    if (typeof value === "boolean") {
      void persistSetting(key, value);
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void persistSetting(key, value), 500);
    }
  }

  if (!settings) {
    return (
      <div style={{ padding: "2rem", color: "var(--muted)" }}>加载中...</div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "2rem 1.5rem",
        display: "grid",
        gridTemplateColumns: !settings.onboarding_completed
          ? "1fr 320px"
          : "1fr",
        gap: "2rem",
        alignItems: "start",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            marginBottom: "1.5rem",
          }}
        >
          设置
        </h1>

        {/* Claude Code Config */}
        <section
          style={{
            background: "var(--panel)",
            border: "1px solid var(--stroke)",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            marginBottom: "1rem",
          }}
        >
          <h2
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "1rem",
            }}
          >
            Claude Code 配置
          </h2>
          <label style={{ display: "block", marginBottom: "0.75rem" }}>
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--muted)",
                display: "block",
                marginBottom: "0.375rem",
              }}
            >
              CLI 路径
            </span>
            <input
              value={settings.claude_cli_path}
              onChange={(e) => handleChange("claude_cli_path", e.target.value)}
              placeholder="留空使用系统 PATH 中的 claude"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--stroke)",
                fontSize: "0.8125rem",
                outline: "none",
                background: "var(--background)",
              }}
            />
          </label>
        </section>

        {/* Storage Config */}
        <section
          style={{
            background: "var(--panel)",
            border: "1px solid var(--stroke)",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            marginBottom: "1rem",
          }}
        >
          <h2
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "1rem",
            }}
          >
            存储配置
          </h2>
          <label style={{ display: "block" }}>
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--muted)",
                display: "block",
                marginBottom: "0.375rem",
              }}
            >
              案件存储目录
            </span>
            <input
              value={settings.case_storage_dir}
              onChange={(e) =>
                handleChange("case_storage_dir", e.target.value)
              }
              placeholder="默认使用项目 output 目录"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--stroke)",
                fontSize: "0.8125rem",
                outline: "none",
                background: "var(--background)",
              }}
            />
          </label>
        </section>

        {/* Preferences */}
        <section
          style={{
            background: "var(--panel)",
            border: "1px solid var(--stroke)",
            borderRadius: "0.75rem",
            padding: "1.25rem",
          }}
        >
          <h2
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "1rem",
            }}
          >
            偏好设置
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <ToggleRow
              label="审核提醒"
              description="产物生成后自动提醒审核"
              checked={settings.auto_review_reminder}
              onChange={(v) => handleChange("auto_review_reminder", v)}
            />
            <ToggleRow
              label="默认导出 Word"
              description="导出产物时默认使用 .docx 格式"
              checked={settings.default_export_docx}
              onChange={(v) => handleChange("default_export_docx", v)}
            />
            <ToggleRow
              label="显示执行日志"
              description="在任务面板中显示详细执行日志"
              checked={settings.show_execution_logs}
              onChange={(v) => handleChange("show_execution_logs", v)}
            />
          </div>
        </section>

        {saving && (
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--muted)",
              marginTop: "0.75rem",
            }}
          >
            保存中...
          </p>
        )}
      </div>

      {/* Onboarding card */}
      {!settings.onboarding_completed && (
        <Onboarding
          onComplete={() =>
            setSettings((s) => (s ? { ...s, onboarding_completed: true } : s))
          }
        />
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ fontSize: "0.875rem" }}>{label}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          {description}
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: "2.5rem",
          height: "1.375rem",
          borderRadius: "0.75rem",
          border: "none",
          cursor: "pointer",
          position: "relative",
          background: checked ? "var(--accent)" : "var(--panel-strong)",
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "0.125rem",
            left: checked ? "1.25rem" : "0.125rem",
            width: "1.125rem",
            height: "1.125rem",
            borderRadius: "50%",
            background: "white",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }}
        />
      </button>
    </div>
  );
}
