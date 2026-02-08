import { Modal, Input, Typography } from 'antd';
import type { InputRef } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { ListItem } from '../types';
import { formatTagLabel } from '../utils/tagUtils';

type Props = {
  open: boolean;
  repo: ListItem | null;
  mode: 'add' | 'edit';
  onCancel: () => void;
  onSave: (value: string) => void;
};

export default function TagModal({ open, repo, mode, onCancel, onSave }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<InputRef | null>(null);

  useEffect(() => {
    if (!repo) {
      return;
    }

    if (mode === 'edit') {
      setValue((repo.record.manualTags ?? []).map(formatTagLabel).join(' '));

      return;
    }

    setValue('');
  }, [repo, mode]);

  useEffect(() => {
    if (open && mode === 'add') {
      inputRef.current?.focus({ cursor: 'end' });
    }
  }, [open, mode]);

  return (
    <Modal
      open={open}
      title={mode === 'edit' ? '编辑标签' : '新增标签'}
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => onSave(value)}
    >
      <Typography.Paragraph type="secondary">
        {mode === 'edit' ? '使用空格或逗号分隔多个标签' : '仅支持一个标签'}
      </Typography.Paragraph>
      <Input
        ref={inputRef}
        placeholder={mode === 'edit' ? '例如：frontend urgent' : '例如：frontend urgent'}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </Modal>
  );
}
