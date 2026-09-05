/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useState, type ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button, Input, Popover, Select } from '@superset-ui/core/components';
import { Radio } from '@superset-ui/core/components/Radio';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  HeaderGroupColumnOption,
  HeaderGroupConfig,
  HeaderGroupLabelAlign,
  HeaderGroupPlacement,
  MAX_HEADER_GROUP_DEPTH,
} from './types';
import {
  canSaveHeaderGroup,
  createHeaderGroup,
  removeHeaderGroupAt,
  updateHeaderGroupAt,
} from './utils';

export type HeaderGroupEditorProps = {
  group?: HeaderGroupConfig;
  path: number[];
  columnOptions: HeaderGroupColumnOption[];
  usedColumns: Set<string>;
  onChange?: (path: number[], next: HeaderGroupConfig) => void;
  onAddChild?: (path: number[]) => void;
  onRemove?: (path: number[]) => void;
  onSave?: (group: HeaderGroupConfig) => void;
  mode?: 'add' | 'edit';
  children?: ReactNode;
};

const FormStack = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
    min-width: ${theme.sizeUnit * 92}px;
  `}
`;

const FieldRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
  `}
`;

const InlineFields = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 3}px;

    & > *:first-of-type {
      flex: 1.4 1 auto;
    }

    & > *:last-of-type {
      flex: 1 1 auto;
    }
  `}
`;

const CompactRadioGroup = styled.div`
  ${({ theme }) => css`
    .ant-radio-group {
      display: flex;
      flex-wrap: nowrap;
      width: 100%;
    }

    .ant-radio-button-wrapper {
      flex: 1 1 auto;
      height: ${theme.sizeUnit * 6}px;
      line-height: ${theme.sizeUnit * 6 - 2}px;
      padding-inline: ${theme.sizeUnit}px;
      font-size: ${theme.fontSizeSM}px;
      text-align: center;
    }
  `}
`;

const FieldLabel = styled.span`
  ${({ theme }) => css`
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const NestedCard = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
  `}
`;

const NestedHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const ApplyRow = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const LABEL_ALIGN_OPTIONS: { label: string; value: HeaderGroupLabelAlign }[] = [
  { label: t('Left'), value: 'left' },
  { label: t('Center'), value: 'center' },
  { label: t('Right'), value: 'right' },
];

const PLACEMENT_OPTIONS: { label: string; value: HeaderGroupPlacement }[] = [
  { label: t('Left'), value: 'left' },
  { label: t('Right'), value: 'right' },
];

export function getGroupTitle(path: number[]): string {
  const numberedPath = path.map(index => index + 1).join('.');
  return path.length === 1
    ? t('Group %s', numberedPath)
    : t('Subgroup %s', numberedPath);
}

function HeaderGroupForm({
  group,
  path,
  columnOptions,
  usedColumns,
  onChange,
  onAddChild,
  onRemove,
  onApply,
  showRemove = false,
}: {
  group: HeaderGroupConfig;
  path: number[];
  columnOptions: HeaderGroupColumnOption[];
  usedColumns: Set<string>;
  onChange: (path: number[], next: HeaderGroupConfig) => void;
  onAddChild: (path: number[]) => void;
  onRemove: (path: number[]) => void;
  onApply?: () => void;
  showRemove?: boolean;
}) {
  const availableOptions = columnOptions.filter(
    option =>
      (group.columns ?? []).includes(option.value) ||
      !usedColumns.has(option.value),
  );
  const canSave = canSaveHeaderGroup(group);
  const isTimeCompareGroup = group.source === 'time_compare';
  const isTopLevel = path.length === 1;

  return (
    <FormStack data-test="header-group-editor">
      {showRemove && (
        <NestedHeader>
          <span>{getGroupTitle(path)}</span>
          <Button
            buttonStyle="link"
            buttonSize="small"
            aria-label={t('Remove group')}
            onClick={() => onRemove(path)}
            icon={<Icons.DeleteOutlined iconSize="s" />}
          />
        </NestedHeader>
      )}
      <FieldRow>
        <FieldLabel>{t('Name')}</FieldLabel>
        <Input
          aria-label={t('Group name')}
          value={group.label}
          placeholder={t('Enter group name')}
          onChange={event =>
            onChange(path, { ...group, label: event.target.value })
          }
        />
      </FieldRow>
      <FieldRow>
        <FieldLabel>{t('Columns')}</FieldLabel>
        <Select
          ariaLabel={t('Group columns')}
          mode="multiple"
          allowClear={!isTimeCompareGroup}
          showSearch={!isTimeCompareGroup}
          disabled={isTimeCompareGroup}
          value={group.columns ?? []}
          options={availableOptions}
          placeholder={t('Select columns')}
          maxTagCount={3}
          onChange={columns => {
            if (isTimeCompareGroup) {
              return;
            }
            onChange(path, {
              ...group,
              columns: Array.isArray(columns) ? columns : [],
            });
          }}
        />
      </FieldRow>
      <InlineFields>
        <FieldRow>
          <FieldLabel>{t('Label position')}</FieldLabel>
          <CompactRadioGroup>
            <Radio.Group
              size="small"
              optionType="button"
              value={group.labelAlign ?? 'center'}
              onChange={event =>
                onChange(path, {
                  ...group,
                  labelAlign: event.target.value as HeaderGroupLabelAlign,
                })
              }
            >
              {LABEL_ALIGN_OPTIONS.map(option => (
                <Radio.Button key={option.value} value={option.value}>
                  {option.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </CompactRadioGroup>
        </FieldRow>
        {isTopLevel && (
          <FieldRow>
            <FieldLabel>{t('Table side')}</FieldLabel>
            <CompactRadioGroup>
              <Radio.Group
                size="small"
                optionType="button"
                value={group.placement ?? 'right'}
                onChange={event =>
                  onChange(path, {
                    ...group,
                    placement: event.target.value as HeaderGroupPlacement,
                  })
                }
              >
                {PLACEMENT_OPTIONS.map(option => (
                  <Radio.Button key={option.value} value={option.value}>
                    {option.label}
                  </Radio.Button>
                ))}
              </Radio.Group>
            </CompactRadioGroup>
          </FieldRow>
        )}
      </InlineFields>
      {(group.children ?? []).length > 0 && (
        <FieldRow>
          {(group.children ?? []).map((child, index) => (
            <NestedCard key={child.id}>
              <HeaderGroupForm
                group={child}
                path={[...path, index]}
                columnOptions={columnOptions}
                usedColumns={usedColumns}
                onChange={onChange}
                onAddChild={onAddChild}
                onRemove={onRemove}
                showRemove
              />
            </NestedCard>
          ))}
        </FieldRow>
      )}
      {path.length < MAX_HEADER_GROUP_DEPTH && !isTimeCompareGroup && (
        <Button
          buttonStyle="dashed"
          buttonSize="small"
          disabled={!canSave}
          icon={<Icons.PlusOutlined iconSize="s" />}
          onClick={() => {
            if (canSave) {
              onAddChild(path);
            }
          }}
        >
          {t('Add subgroup')}
        </Button>
      )}
      {onApply && (
        <ApplyRow>
          <Button buttonStyle="primary" disabled={!canSave} onClick={onApply}>
            {t('Apply')}
          </Button>
        </ApplyRow>
      )}
    </FormStack>
  );
}

export default function HeaderGroupEditor({
  children,
  group,
  path,
  columnOptions,
  usedColumns,
  onChange,
  onAddChild,
  onRemove,
  onSave,
  mode = 'edit',
}: HeaderGroupEditorProps) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<HeaderGroupConfig>(
    group ?? createHeaderGroup(),
  );

  const isAddMode = mode === 'add';
  const currentGroup = isAddMode ? draft : (group ?? draft);

  const handleOpenChange = (open: boolean) => {
    setVisible(open);
    if (open && isAddMode) {
      setDraft(createHeaderGroup());
    }
  };

  const handleChange = (nextPath: number[], next: HeaderGroupConfig) => {
    if (isAddMode) {
      setDraft(updateHeaderGroupAt([draft], nextPath, () => next)[0]);
      return;
    }
    onChange?.(nextPath, next);
  };

  const handleAddChild = (nextPath: number[]) => {
    if (isAddMode) {
      setDraft(
        updateHeaderGroupAt([draft], nextPath, current => ({
          ...current,
          children: [...(current.children ?? []), createHeaderGroup()],
        }))[0],
      );
      return;
    }
    onAddChild?.(nextPath);
  };

  const handleRemove = (nextPath: number[]) => {
    if (isAddMode) {
      const nextGroups = removeHeaderGroupAt([draft], nextPath);
      if (nextGroups[0]) {
        setDraft(nextGroups[0]);
      }
      return;
    }
    onRemove?.(nextPath);
  };

  const handleApply = () => {
    if (!canSaveHeaderGroup(draft)) {
      return;
    }
    onSave?.(draft);
    setVisible(false);
    setDraft(createHeaderGroup());
  };

  return (
    <Popover
      title={isAddMode ? t('Add group') : getGroupTitle(path)}
      trigger={['click']}
      open={visible}
      onOpenChange={handleOpenChange}
      destroyOnHidden
      overlayStyle={{ maxWidth: 480 }}
      content={
        <HeaderGroupForm
          group={currentGroup}
          path={isAddMode ? [0] : path}
          columnOptions={columnOptions}
          usedColumns={usedColumns}
          onChange={handleChange}
          onAddChild={handleAddChild}
          onRemove={handleRemove}
          onApply={isAddMode ? handleApply : undefined}
        />
      }
    >
      {children}
    </Popover>
  );
}
