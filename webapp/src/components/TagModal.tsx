import { Modal, Input, Typography } from "antd"
import { useEffect, useState } from "react"
import type { RepoItem } from "../types"

type Props = {
  open: boolean
  repo: RepoItem | null
  onCancel: () => void
  onSave: (value: string) => void
}

export default function TagModal({ open, repo, onCancel, onSave }: Props) {
  const [value, setValue] = useState("")

  useEffect(() => {
    if (repo) {
      setValue(repo.tags.join(" "))
    }
  }, [repo])

  return (
    <Modal
      open={open}
      title="编辑标签"
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => onSave(value)}
    >
      <Typography.Paragraph type="secondary">
        使用空格或逗号分隔多个标签
      </Typography.Paragraph>
      <Input
        placeholder="例如：frontend urgent"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </Modal>
  )
}
