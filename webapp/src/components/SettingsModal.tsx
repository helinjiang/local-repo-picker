import { CopyOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Tooltip, Tree, message } from 'antd';
import type { ConfigPaths } from '../types';
import { copyPathToClipboard } from '../utils/clipboard';
import { buildConfigTree } from '../utils/configTree';

type Props = {
  open: boolean;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  configPaths: ConfigPaths | null;
  hoveredConfigKey: string | null;
  onHoveredConfigKeyChange: (value: string | null) => void;
  configEditorOpen: boolean;
  onToggleConfigEditor: () => void;
  configText: string;
  onConfigTextChange: (value: string) => void;
  loadingConfig: boolean;
  messageApi: ReturnType<typeof message.useMessage>[0];
};

export default function SettingsModal({
  open,
  onCancel,
  onSave,
  saving,
  configPaths,
  hoveredConfigKey,
  onHoveredConfigKeyChange,
  configEditorOpen,
  onToggleConfigEditor,
  configText,
  onConfigTextChange,
  loadingConfig,
  messageApi,
}: Props) {
  return (
    <Modal
      title="配置"
      open={open}
      onCancel={onCancel}
      onOk={onSave}
      confirmLoading={saving}
      okText="保存"
      cancelText="关闭"
      width={900}
    >
      <div className="settings-grid">
        <div className="settings-left">
          <div className="settings-section">
            <div className="settings-section__title">配置文件</div>
            <Tree
              showLine
              blockNode
              defaultExpandAll
              treeData={buildConfigTree(configPaths)}
              titleRender={(node) => (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
                  onMouseEnter={() => onHoveredConfigKeyChange(node.key)}
                  onMouseLeave={() => onHoveredConfigKeyChange(null)}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {node.title}
                  </span>
                  {node.path && hoveredConfigKey === node.key ? (
                    <Tooltip title="复制路径">
                      <Button
                        size="small"
                        type="text"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          if (!node.path) {
                            return;
                          }

                          void copyPathToClipboard(node.path, messageApi);
                        }}
                        icon={<CopyOutlined />}
                      ></Button>
                    </Tooltip>
                  ) : null}
                </div>
              )}
            />
          </div>
        </div>
        <div className="settings-right">
          <div className="settings-section">
            <div className="settings-section__title">配置 JSON</div>
            <div className="settings-config-actions">
              <Button type="text" icon={<EditOutlined />} onClick={onToggleConfigEditor}>
                {configEditorOpen ? '收起' : '编辑'}
              </Button>
            </div>
            {configEditorOpen ? (
              <Input.TextArea
                value={configText}
                onChange={(event) => onConfigTextChange(event.target.value)}
                rows={20}
                placeholder="配置 JSON"
                disabled={loadingConfig}
              />
            ) : (
              <pre className="settings-config-preview">{configText}</pre>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
