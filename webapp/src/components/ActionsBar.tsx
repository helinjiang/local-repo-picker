import {
  CodeOutlined,
  DesktopOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  ReloadOutlined,
  TagsOutlined
} from "@ant-design/icons"
import { Button, Card, Space } from "antd"
import type { RepoItem } from "../types"

type Props = {
  repo: RepoItem | null
  disabled: boolean
  onAddTag: () => void
  onRefreshCache: () => void
  onRunAction: (actionId: string, path: string) => Promise<void>
}

export default function ActionsBar({ repo, disabled, onAddTag, onRefreshCache, onRunAction }: Props) {
  const handleAction = async (actionId: string) => {
    if (!repo) return
    await onRunAction(actionId, repo.path)
  }

  return (
    <Card size="small" title="Actions">
      <Space wrap>
        <Button
          icon={<CodeOutlined />}
          disabled={disabled}
          onClick={() => handleAction("builtin.open-vscode")}
        >
          VSCode
        </Button>
        <Button
          icon={<DesktopOutlined />}
          disabled={disabled}
          onClick={() => handleAction("builtin.open-iterm")}
        >
          iTerm
        </Button>
        <Button
          icon={<FolderOpenOutlined />}
          disabled={disabled}
          onClick={() => handleAction("builtin.open-finder")}
        >
          Finder
        </Button>
        <Button
          icon={<GlobalOutlined />}
          disabled={disabled}
          onClick={() => handleAction("builtin.open-site")}
        >
          Site
        </Button>
        <Button icon={<TagsOutlined />} disabled={disabled} onClick={onAddTag}>
          Add Tag
        </Button>
        <Button icon={<ReloadOutlined />} disabled={disabled} onClick={onRefreshCache}>
          Refresh Cache
        </Button>
      </Space>
    </Card>
  )
}
