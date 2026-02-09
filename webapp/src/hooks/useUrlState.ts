import { useEffect, useMemo } from 'react';

export type UrlState = {
  query: string;
  tag?: string;
  page?: number;
  pageSize?: number;
  pick?: string;
};

function readUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q') ?? '';
  const tag = params.get('tag') ?? undefined;
  const page = Number(params.get('page'));
  const pageSize = Number(params.get('pageSize'));
  const pick = params.get('pick') ?? undefined;

  return {
    query,
    tag,
    page: Number.isFinite(page) && page > 0 ? page : undefined,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : undefined,
    pick,
  };
}

export function useUrlState(): UrlState {
  return useMemo(() => readUrlState(), []);
}

export function useUrlSync(state: {
  query: string;
  tag?: string;
  page: number;
  pageSize: number;
  pick?: string | null;
}): void {
  const { query, tag, page, pageSize, pick } = state;

  useEffect(() => {
    const params = new URLSearchParams();

    if (query) {
      params.set('q', query);
    }

    if (tag) {
      params.set('tag', tag);
    }

    if (page) {
      params.set('page', String(page));
    }

    if (pageSize) {
      params.set('pageSize', String(pageSize));
    }

    if (pick) {
      params.set('pick', pick);
    }

    const next = params.toString();
    const nextUrl = next ? `${window.location.pathname}?${next}` : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [query, tag, page, pageSize, pick]);
}
