import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import type { ListItem } from '../types';

type Props = {
  repos: ListItem[];
  selectedPath: string | null;
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onSelect: (path: string) => void;
  onPageChange: (page: number, pageSize: number) => void;
  onAddTag: (repo: ListItem) => void;
  onRemoveTag: (repo: ListItem, tag: string) => void;
};

export default function RepoList({
  repos,
  selectedPath,
  loading,
  page,
  pageSize,
  total,
  onSelect,
  onPageChange,
  onAddTag,
  onRemoveTag,
}: Props) {
  const [hoveredTagKey, setHoveredTagKey] = useState<string | null>(null);
  const formatTagLabel = (raw: string) => raw.replace(/^\[(.*)\]$/, '$1');
  const columns: ColumnsType<ListItem> = [
    {
      title: '仓库',
      dataIndex: 'record',
      render: (_, repo) => (
        <div>
          <Space size="small" wrap>
            <Typography.Text strong>{repo.displayName}</Typography.Text>
            {repo.record.git?.provider ? (
              <Tag color="blue">{repo.record.git.provider}</Tag>
            ) : null}
            <Tag color={repo.record.isDirty ? 'red' : 'green'}>
              {repo.record.isDirty ? 'dirty' : 'clean'}
            </Tag>
          </Space>
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{repo.record.repoKey}</div>
        </div>
      ),
    },
    {
      title: '标签',
      dataIndex: 'record',
      render: (_: string[], repo) => (
        <div className="repo-tags">
          {[...repo.record.autoTags, ...repo.record.manualTags].map((tag) => {
            const tagKey = `${repo.record.fullPath}::${tag}`;
            const hovered = hoveredTagKey === tagKey;

            return (
              <Tag
                color="blue"
                key={tagKey}
                className="repo-tag"
                onMouseEnter={() => {
                  setHoveredTagKey(tagKey);
                }}
                onMouseLeave={() => setHoveredTagKey(null)}
              >
                <span>{formatTagLabel(tag)}</span>
                <Popconfirm
                  title="删除该标签？"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => onRemoveTag(repo, tag)}
                >
                  <Button
                    size="small"
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    style={{
                      position: 'absolute',
                      right: -6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      opacity: hovered ? 1 : 0,
                      pointerEvents: hovered ? 'auto' : 'none',
                    }}
                  />
                </Popconfirm>
              </Tag>
            );
          })}
          <Tooltip title="新增标签">
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined />}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAddTag(repo);
              }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <Table
      size="middle"
      rowKey={(record) => record.record.fullPath}
      columns={columns}
      dataSource={repos}
      loading={loading}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        onChange: onPageChange,
      }}
      rowClassName={(record) =>
        record.record.fullPath === selectedPath ? 'repo-row-selected' : ''
      }
      onRow={(record) => ({
        onClick: () => onSelect(record.record.fullPath),
      })}
    />
  );
}
