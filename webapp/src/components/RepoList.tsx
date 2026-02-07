import { DeleteOutlined, PlusOutlined } from "@ant-design/icons"
import { Button, Popconfirm, Space, Table, Tag, Tooltip, Typography } from "antd"
import type { ColumnsType } from "antd/es/table"
import { useState } from "react"
import type { RepoItem } from "../types"

type Props = {
  repos: RepoItem[]
  selectedPath: string | null
  loading: boolean
  page: number
  pageSize: number
  total: number
  onSelect: (path: string) => void
  onPageChange: (page: number, pageSize: number) => void
  onAddTag: (repo: RepoItem) => void
  onRemoveTag: (repo: RepoItem, tag: string) => void
}

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
  onRemoveTag
}: Props) {
  const [hoveredTagKey, setHoveredTagKey] = useState<string | null>(null)
  const formatTagLabel = (raw: string) => raw.replace(/^\[(.*)\]$/, "$1")
  const columns: ColumnsType<RepoItem> = [
    {
      title: "仓库",
      dataIndex: "folderRelativePath",
      render: (_, repo) => (
        <div>
          <Space size="small" wrap>
            <Typography.Text strong>{repo.displayName}</Typography.Text>
            {repo.codePlatform ? <Tag color="blue">{repo.codePlatform}</Tag> : null}
            <Tag color={repo.isDirty ? "red" : "green"}>{repo.isDirty ? "dirty" : "clean"}</Tag>
          </Space>
          <div style={{ color: "#8c8c8c", fontSize: 12 }}>{repo.key}</div>
        </div>
      )
    },
    {
      title: "标签",
      dataIndex: "tags",
      render: (_: string[], repo) => (
        <div className="repo-tags">
          {repo.tags.map((tag) => {
            const tagKey = `${repo.folderFullPath}::${tag}`
            const hovered = hoveredTagKey === tagKey
            return (
              <Tag
                color="blue"
                key={tagKey}
                className="repo-tag"
                onMouseEnter={() => {
                  setHoveredTagKey(tagKey)
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
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    style={{
                      position: "absolute",
                      right: -6,
                      top: "50%",
                      transform: "translateY(-50%)",
                      opacity: hovered ? 1 : 0,
                      pointerEvents: hovered ? "auto" : "none"
                    }}
                  />
                </Popconfirm>
              </Tag>
            )
          })}
          <Tooltip title="新增标签">
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined />}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onAddTag(repo)
              }}
            />
          </Tooltip>
        </div>
      )
    },
  
  ]

  return (
    <Table
      size="middle"
      rowKey="folderFullPath"
      columns={columns}
      dataSource={repos}
      loading={loading}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        onChange: onPageChange
      }}
      rowClassName={(record) =>
        record.folderFullPath === selectedPath ? "repo-row-selected" : ""
      }
      onRow={(record) => ({
        onClick: () => onSelect(record.folderFullPath)
      })}
    />
  )
}
