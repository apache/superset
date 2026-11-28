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
import { ReactNode, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled, useTheme } from '@apache-superset/core/theme';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { QueryFormColumn } from '@superset-ui/core';
import { Button, Flex, Icons, Tooltip } from '@superset-ui/core/components';
import { InputNumber } from '@superset-ui/core/components/Input';
import type { TreeLevel } from '@superset-ui/plugin-chart-ag-grid-table';
import type { ControlProps } from 'src/explore/components/Control';
import ControlHeader from 'src/explore/components/ControlHeader';
import TextControl from 'src/explore/components/controls/TextControl';
import CheckboxControl from 'src/explore/components/controls/CheckboxControl';
import SelectControl from 'src/explore/components/controls/SelectControl';
import { DndColumnSelect } from 'src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';

const DISABLED_TABS = new Set(['saved', 'sqlExpression']);
const DEFAULT_CHILDREN_SHOWN = 100;

const Field = styled.div`
  &[data-invalid='true'] div,
  &[data-invalid='true'] input {
    border-color: ${({ theme }) => theme.colorError} !important;
  }
`;

type ColumnValue = QueryFormColumn | QueryFormColumn[] | null | undefined;

export interface LevelItemProps {
  level: TreeLevel;
  index: number;
  parent?: TreeLevel;
  columnOptions: ColumnMeta[];
  temporalOptions: ColumnMeta[];
  actions: ControlProps['actions'];
  onChange: (level: TreeLevel) => void;
  onRemove: () => void;
}

const pluralName = (level?: TreeLevel) =>
  level?.name_plural || level?.name || '';

export function levelHeading(level: TreeLevel, index: number) {
  const name = pluralName(level);
  return name
    ? t('%(number)s %(name)s', { number: index + 1, name })
    : t('Level %(number)s', { number: index + 1 });
}

function withKey(
  level: TreeLevel,
  key: keyof TreeLevel,
  value: unknown,
): TreeLevel {
  const next: Record<string, unknown> = { ...level };
  if (value === undefined || value === null || value === '') {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next as unknown as TreeLevel;
}

const asColumn = (value: ColumnValue) =>
  typeof value === 'string' ? value : undefined;

const asColumns = (value: ColumnValue) =>
  Array.isArray(value)
    ? value.filter((column): column is string => typeof column === 'string')
    : [];

export default function LevelItem({
  level,
  index,
  parent,
  columnOptions,
  temporalOptions,
  actions,
  onChange,
  onRemove,
}: LevelItemProps) {
  const theme = useTheme();
  const [childrenShown, setChildrenShown] = useState<number | null>(
    level.children_shown ?? DEFAULT_CHILDREN_SHOWN,
  );
  useEffect(() => {
    setChildrenShown(level.children_shown ?? DEFAULT_CHILDREN_SHOWN);
  }, [level.children_shown]);
  const commitChildrenShown = (value: number) => {
    const clamped = Number.isFinite(value)
      ? Math.min(1000, Math.max(1, Math.round(value)))
      : DEFAULT_CHILDREN_SHOWN;
    setChildrenShown(clamped);
    onChange({ ...level, children_shown: clamped });
  };
  const isChild = index > 0;
  const fieldName = (field: string) => `${level.key}_${field}`;
  const columnLabel = (column: string) =>
    columnOptions.find(option => option.column_name === column)?.verbose_name ||
    column;
  const wrap = (field: string, node: ReactNode, invalid = false) => (
    <Field
      key={field}
      data-test={fieldName(field)}
      data-invalid={invalid || undefined}
    >
      {node}
    </Field>
  );

  const singleColumn = (
    key: 'id_column' | 'parent_column' | 'time_column',
    label: string,
    description: string,
    temporal = false,
  ) => {
    const required =
      key === 'id_column' ||
      (key === 'parent_column' && isChild) ||
      (key === 'time_column' && (!isChild || level.apply_date_filter));
    const missing = Boolean(required && !level[key]);
    const selfLink =
      key === 'parent_column' &&
      level.id_column &&
      level.parent_column === level.id_column;
    const error = missing
      ? t('%s is required', label)
      : selfLink
        ? t("Level %(number)s: %(field)s can't be the level's own ID column.", {
            number: index + 1,
            field: label,
          })
        : undefined;
    const invalid = Boolean(error);
    return wrap(
      key,
      <DndColumnSelect
        type="DndColumnSelect"
        actions={actions}
        name={fieldName(key)}
        label={label}
        description={description}
        validationErrors={error ? [error] : []}
        multi={false}
        options={temporal ? temporalOptions : columnOptions}
        disabledTabs={DISABLED_TABS}
        {...(temporal && {
          isTemporal: true,
          ghostButtonText: t('Drop a temporal column here or click'),
        })}
        value={level[key] || undefined}
        onChange={value =>
          onChange(
            key === 'id_column'
              ? { ...level, id_column: asColumn(value) ?? '' }
              : withKey(level, key, asColumn(value)),
          )
        }
      />,
      invalid,
    );
  };

  const multiColumn = (
    key: 'columns' | 'detail_fields',
    label: string,
    description: string,
  ) =>
    wrap(
      key,
      <DndColumnSelect
        type="DndColumnSelect"
        actions={actions}
        name={fieldName(key)}
        label={label}
        description={description}
        multi
        options={columnOptions}
        disabledTabs={DISABLED_TABS}
        value={level[key] ?? []}
        onChange={value => onChange({ ...level, [key]: asColumns(value) })}
      />,
    );

  const sortChoices: [string, string][] = [
    level.id_column,
    ...(level.columns ?? []),
  ]
    .filter((column, i, all) => column && all.indexOf(column) === i)
    .flatMap(column => [
      [
        JSON.stringify([column, true]),
        t('%s · ascending', columnLabel(column)),
      ],
      [
        JSON.stringify([column, false]),
        t('%s · descending', columnLabel(column)),
      ],
    ]);

  const parentName = parent?.name || '';
  const childrenName = pluralName(level);
  const childrenShownLabel =
    childrenName && parentName
      ? t('%(children)s shown per %(parent)s', {
          children: childrenName,
          parent: parentName,
        })
      : t('Rows shown per parent');

  const sortField = wrap(
    'sort',
    <SelectControl
      name={fieldName('sort')}
      label={t('Default sort')}
      description={t('Choose the initial row order for this level.')}
      clearable
      choices={sortChoices}
      placeholder={
        level.id_column
          ? t('%s · ascending', columnLabel(level.id_column))
          : undefined
      }
      value={level.sort && JSON.stringify(level.sort)}
      onChange={value =>
        onChange(
          withKey(
            level,
            'sort',
            typeof value === 'string' && value ? JSON.parse(value) : undefined,
          ),
        )
      }
    />,
  );

  const childFields = isChild
    ? [
        wrap(
          'children_shown',
          <Flex vertical>
            <ControlHeader
              name={fieldName('children_shown')}
              label={childrenShownLabel}
              description={t(
                'Choose how many children to load at a time for each parent.',
              )}
            />
            <InputNumber<number>
              aria-label={childrenShownLabel}
              style={{ width: '100%' }}
              min={1}
              max={1000}
              precision={0}
              value={childrenShown}
              onChange={setChildrenShown}
              onBlur={event => {
                const value = event.target.value.trim();
                commitChildrenShown(
                  value ? Number(value) : DEFAULT_CHILDREN_SHOWN,
                );
              }}
              onStep={commitChildrenShown}
            />
          </Flex>,
        ),
        sortField,
        wrap(
          'apply_date_filter',
          <CheckboxControl
            name={fieldName('apply_date_filter')}
            label={t('Apply date filter to children')}
            description={t(
              "Apply the level 1 date range to this level's time column.",
            )}
            value={Boolean(level.apply_date_filter)}
            onChange={value => onChange({ ...level, apply_date_filter: value })}
          />,
        ),
      ]
    : [sortField];

  return (
    <div data-test={`level-${index + 1}`}>
      <Flex align="center" justify="space-between">
        <ControlHeader
          name={fieldName('heading')}
          label={levelHeading(level, index)}
        />
        <Tooltip title={t('Remove level')}>
          <Button
            buttonStyle="tertiary"
            buttonSize="small"
            icon={<Icons.CloseOutlined iconSize="s" />}
            aria-label={t(
              'Remove level %s',
              level.name || t('Level %(number)s', { number: index + 1 }),
            )}
            onClick={onRemove}
          />
        </Tooltip>
      </Flex>
      <Flex vertical gap={theme.sizeUnit * 4}>
        {wrap(
          'name',
          <TextControl
            name={fieldName('name')}
            label={t('Name')}
            description={t('Name one item at this level.')}
            validationErrors={
              !level.name?.trim() ? [t('%s is required', t('Name'))] : []
            }
            value={level.name}
            onChange={value => onChange({ ...level, name: String(value) })}
          />,
          !level.name?.trim(),
        )}
        {wrap(
          'name_plural',
          <TextControl
            name={fieldName('name_plural')}
            label={t('Plural name')}
            description={t('Name a group of items at this level.')}
            value={level.name_plural}
            onChange={value => onChange(withKey(level, 'name_plural', value))}
          />,
        )}
        {singleColumn(
          'id_column',
          t('ID column'),
          t('Choose the column that identifies an item at this level.'),
        )}
        {isChild &&
          singleColumn(
            'parent_column',
            parentName
              ? t('Linked to %(parent)s by', { parent: parentName })
              : t('Linked to parent by'),
            t(
              "Choose the column at this level that matches the parent level's ID.",
            ),
          )}
        {singleColumn(
          'time_column',
          t('Time column'),
          isChild
            ? t(
                'Choose the date or time column that "Apply date filter to children" uses for this level.',
              )
            : t('Choose the date or time column used to filter this level.'),
          true,
        )}
        {multiColumn(
          'columns',
          t('Columns'),
          t("Choose the columns shown in this level's table."),
        )}
        {multiColumn(
          'detail_fields',
          t('Detail fields'),
          t('Choose the fields shown when an item is expanded.'),
        )}
        {childFields}
      </Flex>
    </div>
  );
}
