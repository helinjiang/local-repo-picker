import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Space } from 'antd';
import type { FixedLink } from '../types';

type Props = {
  open: boolean;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  links: { id: string; label: string; url: string }[];
  onLinkUpdate: (index: number, patch: Partial<FixedLink>) => void;
  onLinkRemove: (index: number) => void;
  onLinkAdd: () => void;
};

export default function GlobalLinksModal({
  open,
  onCancel,
  onSave,
  saving,
  links,
  onLinkUpdate,
  onLinkRemove,
  onLinkAdd,
}: Props) {
  return (
    <Modal
      title="自定义链接"
      open={open}
      onCancel={onCancel}
      onOk={onSave}
      confirmLoading={saving}
      okText="保存"
      cancelText="关闭"
      width={720}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {links.map((link, index) => (
          <Space key={link.id} style={{ width: '100%' }}>
            <Input
              placeholder="链接名称"
              value={link.label}
              onChange={(event) => onLinkUpdate(index, { label: event.target.value })}
            />
            <Input
              placeholder="链接地址"
              value={link.url}
              onChange={(event) => onLinkUpdate(index, { url: event.target.value })}
            />
            <Button danger icon={<DeleteOutlined />} onClick={() => onLinkRemove(index)} />
          </Space>
        ))}
        <Space>
          <Button icon={<PlusOutlined />} onClick={onLinkAdd}>
            添加链接
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}
