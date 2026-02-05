import { Modal, Input, Typography } from "antd"
import { useEffect, useState } from "react"
import type { RepoItem } from "../types"

type Props = {
  open: boolean
  repo: RepoItem | null
  mode: "add" | "edit"
  onCancel: () => void
  onSave: (value: string) => void
}

export default function TagModal({ open, repo, mode, onCancel, onSave }: Props) {
  const [value, setValue] = useState("")

  useEffect(() => {
    if (!repo) return
    if (mode === "edit") {
      setValue((repo.manualTags ?? []).join(" "))
      return
    }
    setValue("")
  }, [repo, mode])

  return (
    <Modal
      open={open}
      title={mode === "edit" ? "编辑标签" : "新增标签"}
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => onSave(value)}
    >
      <Typography.Paragraph type="secondary">
        {mode === "edit" ? "使用空格或逗号分隔多个标签" : "输入一个标签名称"}
      </Typography.Paragraph>
      <Input
        placeholder={mode === "edit" ? "例如：frontend urgent" : "例如：frontend"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </Modal>
  )
}
