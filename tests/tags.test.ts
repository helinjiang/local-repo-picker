import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { buildTags, parseTagList, readManualTags } from '../src/core/tags';
import { normalizeRepoKey } from '../src/core/path-utils';

describe('tags', () => {
  it('解析 tag 列表', () => {
    expect(parseTagList('[a][b]')).toEqual(['[a]', '[b]']);
    expect(parseTagList('foo bar')).toEqual(['[foo]', '[bar]']);
  });

  it('构建最终 tags', () => {
    expect(
      buildTags({
        autoTag: '[team]',
        manualTags: ['[manual]'],
      }),
    ).toEqual(['[manual]']);
    expect(
      buildTags({
        autoTag: '[team]',
      }),
    ).toEqual(['[team]']);
  });

  it('读取手动 tags 时进行路径归一化', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-tags-'));
    const repoPath = path.join(root, 'repo-a');
    await fs.mkdir(repoPath, { recursive: true });
    const manualTagsFile = path.join(root, 'repo_tags.tsv');
    const pathWithSegments = path.join(repoPath, '..', 'repo-a');
    await fs.writeFile(manualTagsFile, `${pathWithSegments}\t[manual]\n`, 'utf8');
    const map = await readManualTags(manualTagsFile);
    expect(map.get(normalizeRepoKey(repoPath))).toEqual(['[manual]']);
    await fs.rm(root, { recursive: true, force: true });
  });
});
