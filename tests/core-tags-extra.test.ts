import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { readManualTagEdits, setManualTags, updateManualTagEdits } from '../src/core/tags';

describe('core tags extra', () => {
  it('readManualTagEdits 解析 add/remove', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-tags-'));
    const file = path.join(root, 'repo_tags.tsv');
    await fs.writeFile(file, `/a\t[one]![two]\n`, 'utf8');
    const edits = await readManualTagEdits(file);
    expect(edits.get('/a')?.add).toEqual(['[one]']);
    expect(edits.get('/a')?.remove).toEqual(['[two]']);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('setManualTags 写入并合并 remove', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-tags-'));
    const file = path.join(root, 'repo_tags.tsv');
    await fs.writeFile(file, `/repo\t[old]![remove]\n`, 'utf8');
    await setManualTags(file, '/repo', ['[new]']);
    const content = await fs.readFile(file, 'utf8');
    expect(content).toContain('[new]');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('updateManualTagEdits 增删并清空', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lrp-tags-'));
    const file = path.join(root, 'repo_tags.tsv');
    await updateManualTagEdits(file, '/repo', { add: ['[a]'] });
    await updateManualTagEdits(file, '/repo', { remove: ['[a]'] });
    const content = await fs.readFile(file, 'utf8');
    expect(content).toContain('![a]');
    await fs.rm(root, { recursive: true, force: true });
  });
});
