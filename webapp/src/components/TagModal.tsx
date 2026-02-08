import { Modal, Select, Typography } from 'antd';
import type { BaseSelectRef } from 'rc-select';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ListItem } from '../types';
import { formatTagLabel } from '../utils/tagUtils';

type TagOption = { label: string; value: string };

type Props = {
  open: boolean;
  repo: ListItem | null;
  mode: 'add' | 'edit';
  tagOptions: TagOption[];
  onCancel: () => void;
  onSave: (values: string[]) => void;
};

export default function TagModal({ open, repo, mode, tagOptions, onCancel, onSave }: Props) {
  const [values, setValues] = useState<string[]>([]);
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
    if (!repo) {
      return;
    }

    if (mode === 'edit') {
      const tags = (repo.record.manualTags ?? []).map(formatTagLabel).filter(Boolean);
      setValues(tags.length > 0 ? [tags[0]] : []);

      return;
    }

    setValues([]);
  }, [repo, mode]);

  useEffect(() => {
    if (open && mode === 'add') {
      setTimeout(() => {
        selectRef.current?.focus();
      }, 0);
    }
  }, [open, mode]);

  return (
    <Modal
      open={open}
      title={mode === 'edit' ? '编辑标签' : '新增标签'}
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      onOk={() => onSave(values)}
    >
      <Typography.Paragraph type="secondary">支持空格，视为一个标签</Typography.Paragraph>
      {mode === 'add' ? (
        <Select
          ref={selectRef}
          mode="tags"
          style={{ width: '100%' }}
          placeholder="例如：frontend urgent"
          options={selectOptions}
          value={values}
          onChange={(nextValues) => {
            const normalized = nextValues
              .map((item) => formatTagLabel(item))
              .filter(Boolean);
            const unique = Array.from(new Set(normalized));
            setValues(unique);
          }}
        />
      ) : (
        <Select
          ref={selectRef}
          mode="tags"
          style={{ width: '100%' }}
          placeholder="例如：frontend urgent"
          options={selectOptions}
          value={values}
          maxCount={1}
          onChange={(nextValues) => {
            const next = nextValues[0] ?? '';
            setValues(next ? [formatTagLabel(next)] : []);
          }}
        />
      )}
    </Modal>
  );
}
