import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Space } from 'antd';
import type { FixedLink } from '../types';
import type { RepoLinksGroup } from '../hooks/useConfigManager';

type Props = {
  open: boolean;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  currentRepoLinksGroup: RepoLinksGroup | null;
  currentRepoLinksIndex: number;
  repoLinksConfig: RepoLinksGroup[];
  onRepoLinksGroupRepoChange: (groupIndex: number, value: string) => void;
  onRepoLinkUpdate: (groupIndex: number, linkIndex: number, patch: Partial<FixedLink>) => void;
  onRepoLinkRemove: (groupIndex: number, linkIndex: number) => void;
  onRepoLinkAdd: (groupIndex: number) => void;
};

export default function RepoLinksModal({
  open,
  onCancel,
  onSave,
  saving,
  currentRepoLinksGroup,
  currentRepoLinksIndex,
  repoLinksConfig,
  onRepoLinksGroupRepoChange,
  onRepoLinkUpdate,
  onRepoLinkRemove,
  onRepoLinkAdd,
}: Props) {
  return (
    <Modal
      title="固定链接"
      open={open}
      onCancel={onCancel}
      onOk={onSave}
      confirmLoading={saving}
      okText="保存"
      cancelText="关闭"
      width={720}
    >
      {currentRepoLinksGroup ? (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #f0f0f0',
          }}
        >
          <div style={{ fontSize: 14, marginBottom: 8 }}>{currentRepoLinksGroup.repo}</div>
          <Space direction="vertical" style={{ width: '100%' }}>
            {currentRepoLinksGroup.links.map((link, linkIndex) => (
              <Space key={link.id} style={{ width: '100%' }}>
                <Input
                  placeholder="链接名称"
                  value={link.label}
                  onChange={(event) =>
                    onRepoLinkUpdate(currentRepoLinksIndex, linkIndex, {
                      label: event.target.value,
                    })
                  }
                />
                <Input
                  placeholder="链接地址"
                  value={link.url}
                  onChange={(event) =>
                    onRepoLinkUpdate(currentRepoLinksIndex, linkIndex, {
                      url: event.target.value,
                    })
                  }
                />
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onRepoLinkRemove(currentRepoLinksIndex, linkIndex)}
                />
              </Space>
            ))}
            <Space>
              <Button icon={<PlusOutlined />} onClick={() => onRepoLinkAdd(currentRepoLinksIndex)}>
                添加链接
              </Button>
            </Space>
          </Space>
        </div>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          {repoLinksConfig.map((group, groupIndex) => (
            <div
              key={group.id}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #f0f0f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Input
                  placeholder="repoKey"
                  value={group.repo}
                  onChange={(event) => onRepoLinksGroupRepoChange(groupIndex, event.target.value)}
                />
              </div>
              <Space direction="vertical" style={{ width: '100%' }}>
                {group.links.map((link, linkIndex) => (
                  <Space key={link.id} style={{ width: '100%' }}>
                    <Input
                      placeholder="链接名称"
                      value={link.label}
                      onChange={(event) =>
                        onRepoLinkUpdate(groupIndex, linkIndex, {
                          label: event.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="链接地址"
                      value={link.url}
                      onChange={(event) =>
                        onRepoLinkUpdate(groupIndex, linkIndex, {
                          url: event.target.value,
                        })
                      }
                    />
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => onRepoLinkRemove(groupIndex, linkIndex)}
                    />
                  </Space>
                ))}
                <Space>
                  <Button icon={<PlusOutlined />} onClick={() => onRepoLinkAdd(groupIndex)}>
                    添加链接
                  </Button>
                </Space>
              </Space>
            </div>
          ))}
        </Space>
      )}
      <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 12 }}>
        Key 为 repoKey（provider:fullName），匹配后展示。支持占位符：{`{ownerRepo}`}、{`{path}`}、
        {`{originUrl}`}
      </div>
    </Modal>
  );
}
