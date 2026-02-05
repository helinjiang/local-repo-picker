import {
  CodeOutlined,
  DesktopOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  QuestionCircleOutlined,
  TagsOutlined
} from "@ant-design/icons"
import { Button, Card, Space } from "antd"
import type { ActionInfo, RepoItem } from "../types"

type Props = {
  repo: RepoItem | null
  disabled: boolean
  actions: ActionInfo[]
  onAddTag: () => void
  onRunAction: (actionId: string, path: string) => Promise<void>
}

export default function ActionsBar({ repo, disabled, actions, onAddTag, onRunAction }: Props) {
  const handleAction = async (actionId: string) => {
    if (!repo) return
    await onRunAction(actionId, repo.path)
  }

  return (
    <Card size="small" title="Actions">
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
        <Button icon={<TagsOutlined />} disabled={disabled} onClick={onAddTag}>
          Add Tag
        </Button>
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
