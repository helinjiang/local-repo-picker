import { InfoCircleOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Modal,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { fetchRecord } from '../api';
import type { FixedLink, ListItem, RepoPreviewResult, RepositoryRecord } from '../types';

type Props = {
  loading: boolean;
  preview: RepoPreviewResult | null;
  repo: ListItem | null;
  repoLinks: Record<string, FixedLink[]>;
};

export default function PreviewPanel({ loading, preview, repo, repoLinks }: Props) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [record, setRecord] = useState<RepositoryRecord | null>(null);
  const repoPath = repo?.record.fullPath;
  useEffect(() => {
    if (!repoPath) {
      return;
    }

    if (!infoOpen) {
      return;
    }

    let cancelled = false;
    setRecordLoading(true);
    setRecordError(null);
    fetchRecord(repoPath)
      .then((data) => {
        if (!cancelled) setRecord(data);
      })
      .catch((error: Error) => {
        if (!cancelled) setRecordError(error.message);
      })
      .finally(() => {
        if (!cancelled) setRecordLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [infoOpen, repoPath]);

  if (!repo) {
    return <Empty description="请选择一个仓库" />;
  }

  const originUrl = preview?.data.origin && preview.data.origin !== '-' ? preview.data.origin : '';
  const previewRepoKey =
    preview?.data.record.repoKey && preview.data.record.repoKey !== '-'
      ? preview.data.record.repoKey
      : '';
  const repoKeyValue =
    previewRepoKey ||
    (repo.record.repoKey && repo.record.repoKey !== '-'
      ? repo.record.repoKey
      : repo.record.relativePath);
  const resolvedFixedLinks = (repoLinks[repoKeyValue] ?? [])
    .map((link) => {
      const label = link.label.trim();
      const template = link.url.trim();

      if (!label || !template) {
        return null;
      }

      if (template.includes('{originUrl}') && !originUrl) {
        return null;
      }

      const url = template.replace(/\{(fullName|path|originUrl)\}/g, (_, key) => {
        if (key === 'fullName') {
          return repo.record.git?.fullName || repo.record.relativePath;
        }

        if (key === 'path') {
          return repo.record.fullPath;
        }

        if (key === 'originUrl') {
          return originUrl;
        }

        return '';
      });

      return url ? { label, url } : null;
    })
    .filter((item): item is { label: string; url: string } => Boolean(item));

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Space size="small">
            <span>预览</span>
            <Tooltip title="查看原始数据">
              <Button
                type="text"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => setInfoOpen(true)}
              />
            </Tooltip>
          </Space>
        }
        size="small"
        style={{ marginTop: 12 }}
        className="preview-card"
      >
        <Descriptions bordered size="small" column={1} className="preview-meta">
          <Descriptions.Item label="路径">{repo.record.fullPath}</Descriptions.Item>
          <Descriptions.Item label="repoKey">
            {preview?.data.record.repoKey ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Origin">{preview?.data.origin ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="站点">
            {preview?.data.siteUrl && preview.data.siteUrl !== '-' ? (
              <a href={preview.data.siteUrl} target="_blank" rel="noreferrer">
                {preview.data.siteUrl}
              </a>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="固定链接">
            {resolvedFixedLinks.length ? (
              <div className="fixed-links">
                {resolvedFixedLinks.map((item) => (
                  <a
                    key={`${item.label}-${item.url}`}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="分支">{preview?.data.branch ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={preview?.data.status === 'dirty' ? 'red' : 'green'}>
              {preview?.data.status ?? '-'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="同步">{preview?.data.sync ?? '-'}</Descriptions.Item>
        </Descriptions>

        {preview?.error && <Typography.Text type="warning">{preview.error}</Typography.Text>}

        <div className="preview-section">
          <Typography.Title level={5}>最近提交</Typography.Title>
          {preview?.data.recentCommits?.length ? (
            <pre className="preview-code">{preview.data.recentCommits.join('\n')}</pre>
          ) : (
            <Typography.Text type="secondary">暂无记录</Typography.Text>
          )}
        </div>

        <div className="preview-section">
          <Typography.Title level={5}>README</Typography.Title>
          {preview?.data.readme?.length ? (
            <pre className="preview-code">{preview.data.readme.join('\n')}</pre>
          ) : (
            <Typography.Text type="secondary">未找到 README</Typography.Text>
          )}
        </div>

        {preview?.data.extensions?.map((section) => (
          <div className="preview-section" key={section.title}>
            <Typography.Title level={5}>{section.title}</Typography.Title>
            <pre className="preview-code">{section.lines.join('\n')}</pre>
          </div>
        ))}
      </Card>
      <Modal
        title="Record JSON"
        open={infoOpen}
        onCancel={() => setInfoOpen(false)}
        footer={null}
        width={720}
      >
        <Spin spinning={recordLoading}>
          {recordError ? (
            <Typography.Text type="warning">{recordError}</Typography.Text>
          ) : (
            <Tabs
              items={[
                {
                  key: 'record',
                  label: 'RepositoryRecord',
                  children: (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {record ? JSON.stringify(record, null, 2) : '-'}
                    </pre>
                  ),
                },
                {
                  key: 'preview',
                  label: 'Preview',
                  children: (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {preview ? JSON.stringify(preview, null, 2) : '-'}
                    </pre>
                  ),
                },
                {
                  key: 'list',
                  label: 'ListItem',
                  children: (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {repo ? JSON.stringify(repo, null, 2) : '-'}
                    </pre>
                  ),
                },
              ]}
            />
          )}
        </Spin>
      </Modal>
    </Spin>
  );
}
