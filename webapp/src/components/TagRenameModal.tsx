import { Input, Modal, Typography } from 'antd';
import type { InputRef } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { formatTagLabel } from '../utils/tagUtils';

type Props = {
  open: boolean;
  currentTag: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (value: string) => void;
};

export default function TagRenameModal({
  open,
  currentTag,
  saving,
  onCancel,
  onSave,
}: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<InputRef | null>(null);

  useEffect(() => {
    setValue(currentTag ? formatTagLabel(currentTag) : '');
  }, [currentTag]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus({ cursor: 'end' });
      }, 0);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      title="重命名标签"
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={() => onSave(value)}
    >
      <Typography.Paragraph type="secondary">直接输入新的标签名称</Typography.Paragraph>
      <Input
        ref={inputRef}
        placeholder="输入新标签"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </Modal>
  );
}
