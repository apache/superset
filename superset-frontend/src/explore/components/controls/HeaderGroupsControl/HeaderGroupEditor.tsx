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
  normalizeSelectedColumns,
  moveHeaderGroupAt,
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
    gap: ${theme.sizeUnit}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const NestedHeaderActions = styled.div`
  display: inline-flex;
  align-items: center;
`;

const PopoverTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const ApplyRow = styled.div`
  display: flex;
  justify-content: flex-end;
`;

function SettingsToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      buttonStyle="link"
      buttonSize="small"
      aria-label={collapsed ? t('Expand settings') : t('Collapse settings')}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      icon={
        collapsed ? (
          <Icons.DownOutlined iconSize="s" />
        ) : (
          <Icons.UpOutlined iconSize="s" />
        )
      }
    />
  );
}

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
  onMove,
  onApply,
  showRemove = false,
  siblingCount = 1,
  settingsCollapsed: settingsCollapsedProp,
  onToggleSettings,
}: {
  group: HeaderGroupConfig;
  path: number[];
  columnOptions: HeaderGroupColumnOption[];
  usedColumns: Set<string>;
  onChange: (path: number[], next: HeaderGroupConfig) => void;
  onAddChild: (path: number[]) => void;
  onRemove: (path: number[]) => void;
  onMove: (path: number[], toIndex: number) => void;
  onApply?: () => void;
  showRemove?: boolean;
  siblingCount?: number;
  settingsCollapsed?: boolean;
  onToggleSettings?: () => void;
}) {
  const availableOptions = columnOptions.filter(
    option =>
      (group.columns ?? []).includes(option.value) ||
      !usedColumns.has(option.value),
  );
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const canSave = canSaveHeaderGroup(group);
  const isTimeCompareGroup = group.source === 'time_compare';
  const isTopLevel = path.length === 1;
  const hasSubgroups = (group.children ?? []).length > 0;
  const canCollapse = showRemove || hasSubgroups;
  const settingsCollapsed = onToggleSettings
    ? Boolean(settingsCollapsedProp)
    : localCollapsed;
  const showSettings = !canCollapse || !settingsCollapsed;
  const toggleSettings =
    onToggleSettings ?? (() => setLocalCollapsed(collapsed => !collapsed));

  return (
    <FormStack data-test="header-group-editor">
      {showRemove && (
        <NestedHeader>
          <span>{getGroupTitle(path)}</span>
          <NestedHeaderActions>
            {canCollapse && (
              <SettingsToggle
                collapsed={settingsCollapsed}
                onToggle={toggleSettings}
              />
            )}
            <Button
              buttonStyle="link"
              buttonSize="small"
              aria-label={t('Move group left')}
              disabled={path[path.length - 1] === 0}
              onClick={() => onMove(path, path[path.length - 1] - 1)}
              icon={<Icons.LeftOutlined iconSize="s" />}
            />
            <Button
              buttonStyle="link"
              buttonSize="small"
              aria-label={t('Move group right')}
              disabled={path[path.length - 1] >= siblingCount - 1}
              onClick={() => onMove(path, path[path.length - 1] + 1)}
              icon={<Icons.RightOutlined iconSize="s" />}
            />
            <Button
              buttonStyle="link"
              buttonSize="small"
              aria-label={t('Remove group')}
              onClick={() => onRemove(path)}
              icon={<Icons.DeleteOutlined iconSize="s" />}
            />
          </NestedHeaderActions>
        </NestedHeader>
      )}
      {showSettings && (
        <>
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
                onChange(path, {
                  ...group,
                  columns: normalizeSelectedColumns(columns),
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
            <FieldRow>
              <FieldLabel>
                {isTopLevel ? t('Table side') : t('Position')}
              </FieldLabel>
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
          </InlineFields>
        </>
      )}
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
                onMove={onMove}
                showRemove
                siblingCount={(group.children ?? []).length}
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
  onSave,
  mode = 'edit',
}: HeaderGroupEditorProps) {
  const [visible, setVisible] = useState(false);
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const [draft, setDraft] = useState<HeaderGroupConfig>(
    group ?? createHeaderGroup(),
  );

  const isAddMode = mode === 'add';
  const currentGroup = draft;
  const canCollapseRoot = (currentGroup.children ?? []).length > 0;

  const toDraftPath = (nextPath: number[]) =>
    isAddMode ? nextPath : [0, ...nextPath.slice(path.length)];

  const handleOpenChange = (open: boolean) => {
    setVisible(open);
    if (open) {
      setDraft(
        isAddMode ? createHeaderGroup() : (group ?? createHeaderGroup()),
      );
      setSettingsCollapsed(false);
    }
  };

  const persistDraftIfValid = (nextDraft: HeaderGroupConfig) => {
    if (!isAddMode && canSaveHeaderGroup(nextDraft)) {
      onChange?.(path, nextDraft);
    }
  };

  const handleChange = (nextPath: number[], next: HeaderGroupConfig) => {
    const nextDraft =
      updateHeaderGroupAt([draft], toDraftPath(nextPath), () => next)[0] ??
      draft;
    setDraft(nextDraft);
    persistDraftIfValid(nextDraft);
  };

  const handleAddChild = (nextPath: number[]) => {
    const nextDraft =
      updateHeaderGroupAt([draft], toDraftPath(nextPath), current => ({
        ...current,
        children: [...(current.children ?? []), createHeaderGroup()],
      }))[0] ?? draft;
    setDraft(nextDraft);
  };

  const handleRemove = (nextPath: number[]) => {
    const nextDraft =
      removeHeaderGroupAt([draft], toDraftPath(nextPath))[0] ?? draft;
    setDraft(nextDraft);
    persistDraftIfValid(nextDraft);
  };

  const handleMove = (nextPath: number[], toIndex: number) => {
    const nextDraft =
      moveHeaderGroupAt([draft], toDraftPath(nextPath), toIndex)[0] ?? draft;
    setDraft(nextDraft);
    persistDraftIfValid(nextDraft);
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
      title={
        <PopoverTitleRow>
          <span>{isAddMode ? t('Add group') : getGroupTitle(path)}</span>
          {canCollapseRoot && (
            <SettingsToggle
              collapsed={settingsCollapsed}
              onToggle={() => setSettingsCollapsed(collapsed => !collapsed)}
            />
          )}
        </PopoverTitleRow>
      }
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
          onMove={handleMove}
          onApply={isAddMode ? handleApply : undefined}
          settingsCollapsed={settingsCollapsed}
          onToggleSettings={() => setSettingsCollapsed(collapsed => !collapsed)}
        />
      }
    >
      {children}
    </Popover>
  );
}
