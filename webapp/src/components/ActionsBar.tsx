import {
  CodeOutlined,
  DesktopOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  QuestionCircleOutlined
} from "@ant-design/icons"
import { Button, Card, Space } from "antd"
import type { ActionInfo, RepoItem } from "../types"

type Props = {
  repo: RepoItem | null
  disabled: boolean
  actions: ActionInfo[]
  onRunAction: (actionId: string, path: string) => Promise<void>
}

export default function ActionsBar({ repo, disabled, actions, onRunAction }: Props) {
  const handleAction = async (actionId: string) => {
    if (!repo) return
    await onRunAction(actionId, repo.path)
  }

  return (
    <Card size="small" title="Actions" className="actions-card">
      <Space wrap>
        {actions.map((action) => (
          <Button
            key={action.id}
            icon={getActionIcon(action.id)}
            disabled={disabled}
            onClick={() => handleAction(action.id)}
          >
            {action.label}
          </Button>
        ))}
      </Space>
    </Card>
  )
}

function getActionIcon(actionId: string) {
  if (actionId === "builtin.open-vscode") return <CodeOutlined />
  if (actionId === "builtin.open-iterm") return <DesktopOutlined />
  if (actionId === "builtin.open-finder") return <FolderOpenOutlined />
  if (actionId === "builtin.open-site") return <GlobalOutlined />
  return <QuestionCircleOutlined />
}
