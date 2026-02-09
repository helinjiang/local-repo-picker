import type {
  ActionInfo,
  AppConfig,
  ConfigResponse,
  RepositoryRecord,
  RepoListResult,
  RepoPreviewResult,
  SaveConfigResponse,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${input}`, {
    headers,
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  return (await response.json()) as T;
}

export async function fetchRepos(params: {
  q?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}): Promise<RepoListResult> {
  const search = new URLSearchParams();

  if (params.q) {
    search.set('q', params.q);
  }

  if (params.tag) {
    search.set('tag', params.tag);
  }

  if (params.page) {
    search.set('page', String(params.page));
  }

  if (params.pageSize) {
    search.set('pageSize', String(params.pageSize));
  }

  const suffix = search.toString() ? `?${search.toString()}` : '';

  return request<RepoListResult>(`/repos${suffix}`);
}

export async function fetchPreview(path: string): Promise<RepoPreviewResult> {
  const search = new URLSearchParams({ path });

  return request<RepoPreviewResult>(`/preview?${search.toString()}`);
}

export async function fetchRecord(path: string): Promise<RepositoryRecord> {
  const search = new URLSearchParams({ path });

  return request<RepositoryRecord>(`/record?${search.toString()}`);
}

export async function runAction(actionId: string, path: string): Promise<void> {
  await request('/action', {
    method: 'POST',
    body: JSON.stringify({ actionId, path }),
  });
}

export async function fetchActions(): Promise<ActionInfo[]> {
  return request<ActionInfo[]>('/actions');
}

export async function refreshCache(): Promise<{ ok: boolean; repoCount: number }> {
  return request('/cache/refresh', { method: 'POST' });
}

export async function upsertTags(path: string, tags: string): Promise<void> {
  await request('/tags', {
    method: 'POST',
    body: JSON.stringify({ path, tags, refresh: true }),
  });
}

export async function updateTags(
  path: string,
  edits: { add?: string[]; remove?: string[] },
): Promise<void> {
  await request('/tags', {
    method: 'POST',
    body: JSON.stringify({ path, tags: edits, refresh: true }),
  });
}

export async function fetchConfig(): Promise<ConfigResponse> {
  return request<ConfigResponse>('/config');
}

export async function saveConfig(config: AppConfig): Promise<SaveConfigResponse> {
  return request<SaveConfigResponse>('/config', {
    method: 'POST',
    body: JSON.stringify({ config }),
  });
}
