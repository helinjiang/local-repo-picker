import { Modal, Select } from 'antd';

type TagOption = { label: string; value: string };

type Props = {
  open: boolean;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  quickTagsConfig: string[];
  tagOptions: TagOption[];
  onQuickTagsChange: (values: string[]) => void;
};

export default function QuickTagsModal({
  open,
  onCancel,
  onSave,
  saving,
  quickTagsConfig,
  tagOptions,
  onQuickTagsChange,
}: Props) {
  return (
    <Modal
      title="快速标签"
      open={open}
      onCancel={onCancel}
      onOk={onSave}
      confirmLoading={saving}
      okText="保存"
      cancelText="关闭"
      width={600}
    >
      <Select
        mode="multiple"
        style={{ width: '100%' }}
        placeholder="选择标签"
        value={quickTagsConfig}
        onChange={onQuickTagsChange}
        options={tagOptions}
      />
    </Modal>
  );
}
