export type RepoInfo = {
  path: string;
  fullName: string;
  originUrl?: string;
  codePlatform?: string;
  tags: string[];
  isDirty?: boolean;
  lastScannedAt: number;
};

export type GitProvider =
  | 'github'
  | 'gitee'
  | 'gitlab'
  | 'bitbucket'
  | 'azure'
  | 'unknown'
  | (string & {});

export type GitRepository = {
  provider: GitProvider;
  namespace: string;
  repo: string;
  fullName: string;
  baseUrl: string;
  originUrl: string;
  isValid: boolean;
};

export type RepositoryRecord = {
  recordId: string;
  fullPath: string;
  scanRoot: string;
  relativePath: string;
  repoKey: string;
  git?: GitRepository;
  isDirty: boolean;
  manualTags: string[];
  autoTags: string[];
  lastScannedAt: number;
};

export type PreviewSection = {
  title: string;
  lines: string[];
};

export type RepoPreview = {
  record: RepositoryRecord;
  repoPath: string;
  origin: string;
  siteUrl: string;
  branch: string;
  status: 'dirty' | 'clean';
  sync: string;
  recentCommits: string[];
  readme: string[];
  readmeStatus: 'ok' | 'missing' | 'unavailable';
  extensions: PreviewSection[];
};

export type ListItem = {
  record: RepositoryRecord;
  displayName: string;
};

export type ScanOptions = {
  scanRoots: string[];
  maxDepth?: number;
  pruneDirs?: string[];
  cacheTtlMs?: number;
  followSymlinks?: boolean;
  remoteHostProviders?: Record<string, string>;
  cacheFile?: string;
  manualTagsFile?: string;
  lruFile?: string;
  lruLimit?: number;
  onWarning?: (warning: ScanWarning) => void;
};

export type CacheData = {
  savedAt: number;
  ttlMs: number;
  metadata: CacheMetadata;
  repos: RepositoryRecord[];
};

export type CacheMetadata = {
  cacheVersion: number;
  scanStartedAt: number;
  scanFinishedAt: number;
  scanDurationMs: number;
  buildDurationMs: number;
  repoCount: number;
  scanRoots: string[];
  prunedAt?: number;
  prunedRepoCount?: number;
  warningCount?: number;
  warningSamples?: string[];
};

export type FoundRepo = {
  path: string;
  scanRoot: string;
  autoTag?: string;
};

export type ScanWarning = {
  path: string;
  reason: 'not_found' | 'no_permission' | 'not_directory' | 'symlink_skipped' | 'readdir_failed';
};

export type Action = {
  id: string;
  label: string;
  run: (repo: RepositoryRecord) => Promise<void>;
  scopes?: Array<'cli' | 'web'>;
};

export type TagPluginInput = {
  repoPath: string;
  scanRoot: string;
  originUrl?: string;
  fullName: string;
  provider?: GitProvider;
  autoTags: string[];
  manualTags: string[];
  dirty: boolean;
  baseTags: string[];
};

export type TagPlugin = {
  id: string;
  label: string;
  apply: (input: TagPluginInput) => Promise<string[] | null> | string[] | null;
};

export type PreviewPluginInput = {
  repo: RepositoryRecord;
  preview: RepoPreview;
};

export type PreviewPlugin = {
  id: string;
  label: string;
  render: (input: PreviewPluginInput) => Promise<PreviewSection | null> | PreviewSection | null;
};

export type PluginModule = {
  id: string;
  label: string;
  actions?: Action[];
  tags?: TagPlugin[];
  previews?: PreviewPlugin[];
};
