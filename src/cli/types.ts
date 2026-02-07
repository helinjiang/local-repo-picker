import type { AppConfig } from '../config/schema';

export type CliOptions = AppConfig & {
  cacheFile: string;
  manualTagsFile: string;
  lruFile: string;
};
