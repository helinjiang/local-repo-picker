import { describe, expect, it } from 'vitest';

import { buildGitRepository } from '../src/core/domain';

describe('core domain', () => {
  it('buildGitRepository 支持通过 remoteHostProviders 识别自定义 provider', () => {
    const git = buildGitRepository('https://code.yourdomain.org/a/b.git', undefined, {
      'code.yourdomain.org': 'yourdomain',
    });
    expect(git?.provider).toBe('yourdomain');
    expect(git?.baseUrl).toBe('https://code.yourdomain.org');
    expect(git?.fullName).toBe('a/b');
  });

  it('buildGitRepository 支持通过 host suffix 识别自定义 provider', () => {
    const git = buildGitRepository('git@a.code.yourdomain.org:a/b.git', undefined, {
      'code.yourdomain.org': 'yourdomain',
    });
    expect(git?.provider).toBe('yourdomain');
    expect(git?.baseUrl).toBe('https://a.code.yourdomain.org');
  });
});

