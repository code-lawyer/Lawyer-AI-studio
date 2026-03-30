export type CaseRecord = {
  id: string;
  case_code: string;
  title: string;
  case_type: string;
  case_cause: string;
  owner_name: string;
  phase: string;
  workspace_initialized: boolean;
  created_at: string;
  updated_at: string;
};

export type DocumentRecord = {
  id: string;
  case_id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  extracted_text_path: string;
  category: string;
  processing_status: string;
  uploaded_at: string;
};

export type DocumentDetail = DocumentRecord & {
  extracted_text: string;
};

export type WorkflowRunRecord = {
  id: string;
  case_id: string;
  workflow_type: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed" | "canceled";
  task_ids: string[];
  started_by: string;
  error_message: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
};

export type TaskRecord = {
  id: string;
  case_id: string;
  workflow_run_id: string;
  task_type: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed" | "canceled";
  artifact_ids: string[];
  attempts: number;
  execution_mode: string;
  external_task_id: string;
  error_message: string;
  logs: string[];
  created_at: string;
  updated_at: string;
};

export type ArtifactRecord = {
  id: string;
  case_id: string;
  source_task_id: string;
  artifact_type: string;
  title: string;
  content: string;
  file_path: string;
  review_status: "draft" | "waiting_review" | "approved" | "rejected";
  review_comment: string;
  reviewed_by: string;
  reviewed_at: string;
  created_at: string;
};

export type ReviewRecord = {
  id: string;
  case_id: string;
  artifact_id: string;
  action: "approved" | "rejected";
  reviewer_name: string;
  comment: string;
  created_at: string;
};

export type TimelineItem = {
  id: string;
  case_id: string;
  kind: string;
  message: string;
  created_at: string;
};

export type ArtifactExportResult = {
  artifact_id: string;
  format: "docx" | "md";
  file_path: string;
  exported_at: string;
};

export type CaseDetail = CaseRecord & {
  documents: DocumentRecord[];
  tasks: TaskRecord[];
  artifacts: ArtifactRecord[];
  workflow_runs: WorkflowRunRecord[];
  review_records: ReviewRecord[];
  timeline: TimelineItem[];
};

export interface WorkflowStep {
  order: number;
  agent: string;
  label: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "preset" | "custom";
  trigger_keywords: string[];
  steps: WorkflowStep[];
  expected_outputs: string[];
  created_at: string;
  updated_at: string;
}

export interface Settings {
  claude_cli_path: string;
  case_storage_dir: string;
  auto_review_reminder: boolean;
  default_export_docx: boolean;
  show_execution_logs: boolean;
  onboarding_completed: boolean;
}

export interface WorkflowPayload {
  name: string;
  description: string;
  steps: WorkflowStep[];
  trigger_keywords?: string[];
  expected_outputs?: string[];
}

export interface WorkflowExecutionResult {
  workflow_run_id: string;
  workflow_name: string;
  status: string;
  step_tasks: TaskRecord[];
}
