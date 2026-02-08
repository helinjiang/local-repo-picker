import React from 'react';
import { render } from 'ink';
import { RepoPicker } from '../dist/ui/index.js';

const repos = [
  { path: '/tmp/demo-a', fullName: 'demo/a', tags: ['[github]'], lastScannedAt: Date.now() },
  { path: '/tmp/demo-b', fullName: 'demo/b', tags: ['[gitee]'], lastScannedAt: Date.now() },
  { path: '/tmp/demo-c', fullName: 'demo/c', tags: ['[internal]'], lastScannedAt: Date.now() },
];

render(
  React.createElement(RepoPicker, {
    repos,
    onSelect: (repo) => {
      console.log(JSON.stringify(repo, null, 2));
    },
    onCancel: () => {
      console.log('cancel');
    },
  }),
);
