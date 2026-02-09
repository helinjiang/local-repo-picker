import { useState } from 'react';
import { useDebounce } from './useDebounce';

export function useSearchFilter(initial?: { query?: string; tag?: string }) {
  const [query, setQuery] = useState(initial?.query ?? '');
  const [tag, setTag] = useState<string | undefined>(initial?.tag);
  const debouncedQuery = useDebounce(query, 300);

  return { query, setQuery, tag, setTag, debouncedQuery };
}
