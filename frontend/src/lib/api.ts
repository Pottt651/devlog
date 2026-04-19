const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

export interface Project {
  id: number;
  slug: string;
  name: string;
  description: string;
  status: string;
  total_commits: number;
  first_commit_at: string;
  last_commit_at: string;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  claude_sessions: number;
  claude_messages: number;
  recent_commits: { hash: string; subject: string; date: string }[];
  links: { live?: string; github?: string };
  tech_stack: string[];
  related_projects: string[];
  local_path: string;
  has_claude_md: boolean;
  claude_resume_cmd: string;
  is_manual: boolean;
  notes: string;
  scanned_at: string;
}

export interface DiaryEntry {
  id: number;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export const api = {
  getProjects: () => request<Project[]>("/projects"),
  getProject: (slug: string) => request<Project>(`/projects/${slug}`),
  createProject: (body: { slug: string; name: string; description?: string; tech_stack?: string[]; notes?: string }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
  updateProjectNotes: (slug: string, notes: string) =>
    request<void>(`/projects/${slug}`, { method: "PUT", body: JSON.stringify({ notes }) }),

  getDiaryEntries: (tag?: string) =>
    request<DiaryEntry[]>(`/diary${tag ? `?tag=${tag}` : ""}`),
  getDiaryEntry: (id: number) => request<DiaryEntry>(`/diary/${id}`),
  createDiary: (body: { title: string; content: string; tags: string[] }) =>
    request<DiaryEntry>("/diary", { method: "POST", body: JSON.stringify(body) }),
  updateDiary: (id: number, body: Partial<{ title: string; content: string; tags: string[] }>) =>
    request<DiaryEntry>(`/diary/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteDiary: (id: number) =>
    request<void>(`/diary/${id}`, { method: "DELETE" }),
};
