import type {
  ArtifactExportResult,
  ArtifactRecord,
  CaseDetail,
  CaseRecord,
  DocumentDetail,
  TaskRecord,
  ReviewRecord,
  WorkflowTemplate,
  WorkflowPayload,
  Settings,
  WorkflowExecutionResult,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchCases(): Promise<CaseRecord[]> {
  const response = await fetch(`${API_BASE}/api/cases`, { cache: "no-store" });
  return readJson<CaseRecord[]>(response);
}

export async function createCase(payload: {
  case_code: string;
  title: string;
  case_type: string;
  case_cause: string;
  owner_name: string;
}): Promise<CaseRecord> {
  const response = await fetch(`${API_BASE}/api/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<CaseRecord>(response);
}

export async function fetchCase(caseId: string): Promise<CaseDetail> {
  const response = await fetch(`${API_BASE}/api/cases/${caseId}`, { cache: "no-store" });
  return readJson<CaseDetail>(response);
}

export async function fetchDocument(documentId: string): Promise<DocumentDetail> {
  const response = await fetch(`${API_BASE}/api/documents/${documentId}`, { cache: "no-store" });
  return readJson<DocumentDetail>(response);
}

export async function uploadDocument(caseId: string, formData: FormData): Promise<void> {
  const response = await fetch(`${API_BASE}/api/cases/${caseId}/documents`, {
    method: "POST",
    body: formData,
  });
  await readJson(response);
}

export async function createTask(
  caseId: string,
  payload: {
    task_type: string;
    title: string;
    document_ids: string[];
  },
): Promise<TaskRecord> {
  const response = await fetch(`${API_BASE}/api/cases/${caseId}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<TaskRecord>(response);
}

export async function fetchTask(taskId: string): Promise<TaskRecord> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}`, { cache: "no-store" });
  return readJson<TaskRecord>(response);
}

export async function retryTask(taskId: string): Promise<TaskRecord> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}/retry`, {
    method: "POST",
  });
  return readJson<TaskRecord>(response);
}

export async function cancelTask(taskId: string): Promise<TaskRecord> {
  const response = await fetch(`${API_BASE}/api/tasks/${taskId}/cancel`, {
    method: "POST",
  });
  return readJson<TaskRecord>(response);
}

export async function reviewArtifact(
  artifactId: string,
  payload: {
    action: "approved" | "rejected";
    reviewer_name: string;
    comment: string;
  },
): Promise<ArtifactRecord> {
  const response = await fetch(`${API_BASE}/api/artifacts/${artifactId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<ArtifactRecord>(response);
}

export async function fetchArtifactReviews(artifactId: string): Promise<ReviewRecord[]> {
  const response = await fetch(`${API_BASE}/api/artifacts/${artifactId}/reviews`, { cache: "no-store" });
  return readJson<ReviewRecord[]>(response);
}

export async function exportArtifact(
  artifactId: string,
  payload: { format: "docx" | "md" },
): Promise<ArtifactExportResult> {
  const response = await fetch(`${API_BASE}/api/artifacts/${artifactId}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<ArtifactExportResult>(response);
}

// Workflow API
export async function fetchWorkflows(): Promise<WorkflowTemplate[]> {
  const response = await fetch(`${API_BASE}/api/workflows`, { cache: "no-store" });
  return readJson<WorkflowTemplate[]>(response);
}

export async function fetchWorkflow(id: string): Promise<WorkflowTemplate> {
  const response = await fetch(`${API_BASE}/api/workflows/${id}`, { cache: "no-store" });
  return readJson<WorkflowTemplate>(response);
}

export async function createWorkflow(payload: WorkflowPayload): Promise<WorkflowTemplate> {
  const response = await fetch(`${API_BASE}/api/workflows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<WorkflowTemplate>(response);
}

export async function updateWorkflow(
  id: string,
  payload: WorkflowPayload,
): Promise<WorkflowTemplate> {
  const response = await fetch(`${API_BASE}/api/workflows/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<WorkflowTemplate>(response);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/workflows/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Delete failed: ${response.status}`);
  }
}

export async function duplicateWorkflow(id: string): Promise<WorkflowTemplate> {
  const response = await fetch(`${API_BASE}/api/workflows/${id}/duplicate`, {
    method: "POST",
  });
  return readJson<WorkflowTemplate>(response);
}

export async function executeWorkflow(
  caseId: string,
  workflowId: string,
  documentIds: string[],
): Promise<WorkflowExecutionResult> {
  const response = await fetch(`${API_BASE}/api/cases/${caseId}/execute-workflow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflow_id: workflowId, document_ids: documentIds }),
  });
  return readJson<WorkflowExecutionResult>(response);
}

// Settings API
export async function fetchSettings(): Promise<Settings> {
  const response = await fetch(`${API_BASE}/api/settings`, { cache: "no-store" });
  return readJson<Settings>(response);
}

export async function updateSettings(payload: Partial<Settings>): Promise<Settings> {
  const response = await fetch(`${API_BASE}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return readJson<Settings>(response);
}
