import { Modal, Select } from 'antd';
import type { BaseSelectRef } from 'rc-select';
import { useEffect, useMemo, useRef } from 'react';

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
  const selectRef = useRef<BaseSelectRef | null>(null);
  const selectOptions = useMemo(
    () =>
      tagOptions.map((option) => ({
        label: option.label,
        value: option.label,
      })),
    [tagOptions],
  );
  const uniqueValues = useMemo(
    () => Array.from(new Set(quickTagsConfig.map((item) => item.trim()).filter(Boolean))),
    [quickTagsConfig],
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        selectRef.current?.focus();
      }, 0);
    }
  }, [open]);

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
        ref={selectRef}
        mode="tags"
        style={{ width: '100%' }}
        placeholder="选择或输入标签"
        value={uniqueValues}
        onChange={(nextValues) => {
          const normalized = nextValues.map((item) => item.trim()).filter(Boolean);
          const unique = Array.from(new Set(normalized));
          onQuickTagsChange(unique);
        }}
        options={selectOptions}
      />
    </Modal>
  );
}
