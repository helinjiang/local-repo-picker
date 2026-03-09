import {
  CodeOutlined,
  DesktopOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { Button, Card, Popconfirm, Space } from 'antd';
import type { ActionInfo, ListItem } from '../types';

type Props = {
  repo: ListItem | null;
  disabled: boolean;
  actions: ActionInfo[];
  onRunAction: (actionId: string, path: string) => Promise<void>;
};

export default function ActionsBar({ repo, disabled, actions, onRunAction }: Props) {
  const handleAction = async (actionId: string) => {
    if (!repo) {
      return;
    }

    await onRunAction(actionId, repo.record.fullPath);
  };

  return (
    <Card size="small" title="Actions" className="actions-card">
      <Space wrap>
        {actions.map((action) =>
          action.id === 'builtin.clear-node-modules' ? (
            <Popconfirm
              key={action.id}
              title="确认清理该仓库下的所有 node_modules？"
              okText="清理"
              cancelText="取消"
              onConfirm={() => handleAction(action.id)}
            >
              <Button icon={getActionIcon(action.id)} disabled={disabled}>
                {action.label}
              </Button>
            </Popconfirm>
          ) : (
            <Button
              key={action.id}
              icon={getActionIcon(action.id)}
              disabled={disabled}
              onClick={() => handleAction(action.id)}
            >
              {action.label}
            </Button>
          ),
        )}
      </Space>
    </Card>
  );
}

function getActionIcon(actionId: string) {
  if (actionId === 'builtin.open-vscode') {
    return <CodeOutlined />;
  }

  if (actionId === 'builtin.open-iterm') {
    return <DesktopOutlined />;
  }

  if (actionId === 'builtin.open-finder') {
    return <FolderOpenOutlined />;
  }

  if (actionId === 'builtin.open-site') {
    return <GlobalOutlined />;
  }

  if (actionId === 'web.edit-repo-links') {
    return <LinkOutlined />;
  }

  if (actionId === 'builtin.clear-node-modules') {
    return <DeleteOutlined />;
  }

  return <QuestionCircleOutlined />;
}
