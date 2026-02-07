import { ReloadOutlined, SettingOutlined, TagOutlined } from '@ant-design/icons';
import { Button, Input, Select, Space, Tag, Tooltip } from 'antd';

type TagOption = { label: string; value: string };

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  tag?: string;
  onTagChange: (value?: string) => void;
  tagOptions: TagOption[];
  quickTagOptions: TagOption[];
  onQuickTagClick: (value: string) => void;
  onManageQuickTags: () => void;
  refreshingCache: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
};

export default function Toolbar({
  query,
  onQueryChange,
  tag,
  onTagChange,
  tagOptions,
  quickTagOptions,
  onQuickTagClick,
  onManageQuickTags,
  refreshingCache,
  onRefresh,
  onOpenSettings,
}: Props) {
  return (
    <div className="toolbar">
      <div className="toolbar-row">
        <div className="toolbar-group toolbar-group--filters">
          <Input.Search
            allowClear
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索 owner/repo、路径或标签"
            style={{ width: 320 }}
          />
        </div>
        <div className="toolbar-group toolbar-group--actions">
          <Space>
            <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={refreshingCache}>
              刷新缓存
            </Button>
            <Button icon={<SettingOutlined />} onClick={onOpenSettings}>
              配置
            </Button>
          </Space>
        </div>
      </div>
      <div className="toolbar-row">
        <div className="toolbar-group toolbar-group--filters">
          <Select
            allowClear
            placeholder="按标签过滤"
            value={tag}
            onChange={(value) => onTagChange(value)}
            style={{ width: 320 }}
            options={tagOptions}
          />
        </div>
        <div className="toolbar-group toolbar-group--quick-tags">
          <Space size={[6, 6]} wrap>
            {quickTagOptions.length > 0 ? (
              quickTagOptions.map((item) => (
                <Tag
                  key={item.value}
                  color={item.value === tag ? 'blue' : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onQuickTagClick(item.value)}
                >
                  {item.label}
                </Tag>
              ))
            ) : (
              <span className="toolbar-placeholder">暂无快速标签</span>
            )}
            <Tooltip title="管理快速标签">
              <Button size="small" type="text" icon={<TagOutlined />} onClick={onManageQuickTags} />
            </Tooltip>
          </Space>
        </div>
      </div>
    </div>
  );
}
