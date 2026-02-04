import { Table, Tag, Typography } from "antd"
import type { ColumnsType } from "antd/es/table"
import type { RepoItem } from "../types"

type Props = {
  repos: RepoItem[]
  selectedPath: string | null
  loading: boolean
  onSelect: (path: string) => void
}

export default function RepoList({ repos, selectedPath, loading, onSelect }: Props) {
  const columns: ColumnsType<RepoItem> = [
    {
      title: "仓库",
      dataIndex: "ownerRepo",
      render: (_, repo) => (
        <div>
          <Typography.Text strong>{repo.ownerRepo}</Typography.Text>
          <div style={{ color: "#8c8c8c", fontSize: 12 }}>{repo.path}</div>
        </div>
      )
    },
    {
      title: "标签",
      dataIndex: "tags",
      render: (tags: string[]) => (
        <div>
          {tags.map((tag) => (
            <Tag color={tag === "[dirty]" ? "red" : "blue"} key={tag}>
              {tag}
            </Tag>
          ))}
        </div>
      )
    }
  ]

  return (
    <Table
      size="small"
      rowKey="path"
      columns={columns}
      dataSource={repos}
      loading={loading}
      pagination={false}
      rowClassName={(record) => (record.path === selectedPath ? "repo-row-selected" : "")}
      onRow={(record) => ({
        onClick: () => onSelect(record.path)
      })}
    />
  )
}
