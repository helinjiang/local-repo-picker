import { logger } from './logger';
import { uniqueTags } from './tags';
import type {
  Action,
  PluginModule,
  PreviewPlugin,
  PreviewPluginInput,
  PreviewSection,
  TagPlugin,
  TagPluginInput,
} from './types';

const plugins = new Map<string, PluginModule>();

export function registerPlugin(plugin: PluginModule): void {
  if (!plugin || !plugin.id) {
    logger.warn('插件注册失败: 缺少 id');
    return;
  }
  plugins.set(plugin.id, plugin);
}

export function registerPlugins(input: PluginModule[]): void {
  for (const plugin of input) {
    registerPlugin(plugin);
  }
}

export async function loadPlugins(
  loaders: Array<() => Promise<PluginModule | PluginModule[]>>,
): Promise<void> {
  for (const loader of loaders) {
    try {
      const result = await loader();
      if (Array.isArray(result)) {
        registerPlugins(result);
      } else if (result) {
        registerPlugin(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      logger.warn(`插件加载失败: ${message}`);
    }
  }
}

export function getRegisteredPlugins(): PluginModule[] {
  return Array.from(plugins.values());
}

export function getRegisteredActions(): Action[] {
  const actions: Action[] = [];
  for (const plugin of plugins.values()) {
    if (plugin.actions && plugin.actions.length > 0) {
      actions.push(...plugin.actions);
    }
  }
  return actions;
}

export async function resolveTagExtensions(input: TagPluginInput): Promise<string[]> {
  const tags: string[] = [];
  for (const plugin of collectTagPlugins()) {
    const result = await safeApplyTagPlugin(plugin, input);
    if (result.length > 0) {
      tags.push(...result);
    }
  }
  return uniqueTags(tags);
}

export async function resolvePreviewExtensions(
  input: PreviewPluginInput,
): Promise<PreviewSection[]> {
  const sections: PreviewSection[] = [];
  for (const plugin of collectPreviewPlugins()) {
    const section = await safeApplyPreviewPlugin(plugin, input);
    if (section && section.lines.length > 0) {
      sections.push(section);
    }
  }
  return sections;
}

export function clearPlugins(): void {
  plugins.clear();
}

function collectTagPlugins(): TagPlugin[] {
  const result: TagPlugin[] = [];
  for (const plugin of plugins.values()) {
    if (plugin.tags && plugin.tags.length > 0) {
      result.push(...plugin.tags);
    }
  }
  return result;
}

function collectPreviewPlugins(): PreviewPlugin[] {
  const result: PreviewPlugin[] = [];
  for (const plugin of plugins.values()) {
    if (plugin.previews && plugin.previews.length > 0) {
      result.push(...plugin.previews);
    }
  }
  return result;
}

async function safeApplyTagPlugin(plugin: TagPlugin, input: TagPluginInput): Promise<string[]> {
  try {
    const result = await plugin.apply(input);
    if (!result || result.length === 0) {
      return [];
    }
    return normalizeTags(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    logger.warn(`插件 tag 失败: ${plugin.id} ${message}`);
    return [];
  }
}

async function safeApplyPreviewPlugin(
  plugin: PreviewPlugin,
  input: PreviewPluginInput,
): Promise<PreviewSection | null> {
  try {
    return await plugin.render(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    logger.warn(`插件 preview 失败: ${plugin.id} ${message}`);
    return null;
  }
}

function normalizeTags(tags: string[]): string[] {
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      result.push(trimmed);
    } else {
      result.push(`[${trimmed}]`);
    }
  }
  return result;
}
