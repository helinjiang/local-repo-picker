import { promises as fs } from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');

await processDir(distDir);

async function processDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await processDir(fullPath);

        return;
      }

      if (!entry.isFile() || !entry.name.endsWith('.js')) {
        return;
      }

      const content = await fs.readFile(fullPath, 'utf8');
      const updated = rewriteImports(content);

      if (updated !== content) {
        await fs.writeFile(fullPath, updated, 'utf8');
      }
    }),
  );
}

function rewriteImports(content) {
  const fromRegex = /\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g;
  const dynamicRegex = /\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
  const replacedFrom = content.replace(fromRegex, (match, specifier) => {
    const next = appendJsIfNeeded(specifier);

    return next === specifier ? match : match.replace(specifier, next);
  });

  return replacedFrom.replace(dynamicRegex, (match, specifier) => {
    const next = appendJsIfNeeded(specifier);

    return next === specifier ? match : match.replace(specifier, next);
  });
}

function appendJsIfNeeded(specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('..')) {
    return specifier;
  }

  const ext = path.extname(specifier);

  if (ext) {
    return specifier;
  }

  return `${specifier}.js`;
}
