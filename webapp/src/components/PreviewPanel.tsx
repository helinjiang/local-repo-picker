import { Card, Descriptions, Empty, Spin, Tag, Typography } from "antd"
import type { FixedLink, RepoItem, RepoPreviewResult } from "../types"

type Props = {
  loading: boolean
  preview: RepoPreviewResult | null
  repo: RepoItem | null
  repoLinks: Record<string, FixedLink[]>
}

export default function PreviewPanel({ loading, preview, repo, repoLinks }: Props) {
  if (!repo) {
    return <Empty description="请选择一个仓库" />
  }

  const originUrl =
    preview?.data.origin && preview.data.origin !== "-" ? preview.data.origin : ""
  const repoKeyValue =
    preview?.data.repoKey && preview.data.repoKey !== "-" ? preview.data.repoKey : repo.ownerRepo
  const resolvedFixedLinks = (repoLinks[repoKeyValue] ?? [])
    .map((link) => {
      const label = link.label.trim()
      const template = link.url.trim()
      if (!label || !template) return null
      if (template.includes("{originUrl}") && !originUrl) return null
      const url = template.replace(/\{(ownerRepo|path|originUrl)\}/g, (_, key) => {
        if (key === "ownerRepo") return repo.ownerRepo
        if (key === "path") return repo.path
        if (key === "originUrl") return originUrl
        return ""
      })
      return url ? { label, url } : null
    })
    .filter((item): item is { label: string; url: string } => Boolean(item))

  return (
    <Spin spinning={loading}>
      <Card title="预览" size="small" style={{ marginTop: 12 }} className="preview-card">
        <Descriptions bordered size="small" column={1} className="preview-meta">
          <Descriptions.Item label="路径">{repo.path}</Descriptions.Item>
          <Descriptions.Item label="repoKey">{preview?.data.repoKey ?? "-"}</Descriptions.Item>
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
          <Descriptions.Item label="固定链接">
            {resolvedFixedLinks.length ? (
              <div className="fixed-links">
                {resolvedFixedLinks.map((item) => (
                  <a key={`${item.label}-${item.url}`} href={item.url} target="_blank" rel="noreferrer">
                    {item.label}
                  </a>
                ))}
              </div>
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
