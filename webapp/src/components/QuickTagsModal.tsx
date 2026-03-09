import { MenuOutlined } from '@ant-design/icons';
import { Modal, Select, Typography } from 'antd';
import type { BaseSelectRef } from 'rc-select';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatTagLabel } from '../utils/tagUtils';

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
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const selectOptions = useMemo(
    () =>
      tagOptions.map((option) => ({
        label: option.label,
        value: option.value,
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
      {uniqueValues.length > 1 ? (
        <div className="quick-tags-sort">
          <Typography.Text type="secondary">拖拽排序</Typography.Text>
          <div className="quick-tags-sort-list">
            {uniqueValues.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="quick-tags-sort-item"
                draggable
                onDragStart={() => setDraggingIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDragEnd={() => setDraggingIndex(null)}
                onDrop={() => {
                  if (draggingIndex === null || draggingIndex === index) {
                    return;
                  }

                  const next = [...uniqueValues];
                  const [moved] = next.splice(draggingIndex, 1);
                  next.splice(index, 0, moved);
                  onQuickTagsChange(next);
                  setDraggingIndex(null);
                }}
              >
                <MenuOutlined className="quick-tags-sort-handle" />
                <span>{formatTagLabel(item)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
