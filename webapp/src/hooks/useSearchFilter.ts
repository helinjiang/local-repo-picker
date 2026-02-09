import { useState } from 'react';
import { useDebounce } from './useDebounce';

export function useSearchFilter() {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | undefined>();
  const debouncedQuery = useDebounce(query, 300);

  return { query, setQuery, tag, setTag, debouncedQuery };
}
