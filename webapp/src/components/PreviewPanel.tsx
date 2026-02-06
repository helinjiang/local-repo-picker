import { Card, Descriptions, Empty, Spin, Tag, Typography } from "antd"
import type { RepoItem, RepoPreviewResult } from "../types"

type Props = {
  loading: boolean
  preview: RepoPreviewResult | null
  repo: RepoItem | null
}

export default function PreviewPanel({ loading, preview, repo }: Props) {
  if (!repo) {
    return <Empty description="请选择一个仓库" />
  }

  return (
    <Spin spinning={loading}>
      <Card title="预览" size="small" style={{ marginTop: 12 }} className="preview-card">
        <Descriptions size="small" column={1} className="preview-meta">
          <Descriptions.Item label="路径">{repo.path}</Descriptions.Item>
          <Descriptions.Item label="Origin">{preview?.data.origin ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="站点">
            {preview?.data.siteUrl && preview.data.siteUrl !== "-" ? (
              <a href={preview.data.siteUrl} target="_blank" rel="noreferrer">
                {preview.data.siteUrl}
              </a>
            ) : (
              "-"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="分支">{preview?.data.branch ?? "-"}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={preview?.data.status === "dirty" ? "red" : "green"}>
              {preview?.data.status ?? "-"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="同步">{preview?.data.sync ?? "-"}</Descriptions.Item>
        </Descriptions>

        {preview?.error && (
          <Typography.Text type="warning">{preview.error}</Typography.Text>
        )}

        <div className="preview-section">
          <Typography.Title level={5}>最近提交</Typography.Title>
          {preview?.data.recentCommits?.length ? (
            <pre className="preview-code">{preview.data.recentCommits.join("\n")}</pre>
          ) : (
            <Typography.Text type="secondary">暂无记录</Typography.Text>
          )}
        </div>

        <div className="preview-section">
          <Typography.Title level={5}>README</Typography.Title>
          {preview?.data.readme?.length ? (
            <pre className="preview-code">{preview.data.readme.join("\n")}</pre>
          ) : (
            <Typography.Text type="secondary">未找到 README</Typography.Text>
          )}
        </div>

        {preview?.data.extensions?.map((section) => (
          <div className="preview-section" key={section.title}>
            <Typography.Title level={5}>{section.title}</Typography.Title>
            <pre className="preview-code">{section.lines.join("\n")}</pre>
          </div>
        ))}
      </Card>
    </Spin>
  )
}
