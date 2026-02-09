import { Modal, Select, Typography } from 'antd';
import type { BaseSelectRef } from 'rc-select';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTagLabel } from '../utils/tagUtils';

type TagOption = { label: string; value: string };

type Props = {
  open: boolean;
  currentTag: string | null;
  tagOptions: TagOption[];
  onCancel: () => void;
  onSave: (value: string) => void;
};

export default function TagRenameModal({
  open,
  currentTag,
  tagOptions,
  onCancel,
  onSave,
}: Props) {
  const [value, setValue] = useState('');
  const selectRef = useRef<BaseSelectRef | null>(null);
  const selectOptions = useMemo(
    () =>
      tagOptions.map((option) => ({
        label: option.label,
        value: formatTagLabel(option.value),
      })),
    [tagOptions],
  );

  useEffect(() => {
    setValue(currentTag ? formatTagLabel(currentTag) : '');
  }, [currentTag]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        selectRef.current?.focus();
      }, 0);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      title="重命名标签"
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => onSave(value)}
    >
      <Typography.Paragraph type="secondary">支持选择或输入新标签</Typography.Paragraph>
      <Select
        ref={selectRef}
        mode="tags"
        style={{ width: '100%' }}
        placeholder="输入新标签"
        options={selectOptions}
        value={value ? [value] : []}
        maxCount={1}
        onChange={(nextValues) => {
          const next = nextValues[0] ?? '';
          setValue(next ? formatTagLabel(next) : '');
        }}
      />
    </Modal>
  );
}
