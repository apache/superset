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
/* eslint-disable camelcase */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdhocColumn,
  isAdhocColumn,
  isSavedExpression,
  t,
  styled,
} from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import Tabs from 'src/components/Tabs';
import Button from 'src/components/Button';
import { NativeSelect as Select } from 'src/components/Select';
import { Form, FormItem } from 'src/components/Form';
import { SQLEditor } from 'src/components/AsyncAceEditor';
import { StyledColumnOption } from 'src/explore/components/optionRenderers';

const StyledSelect = styled(Select)`
  .metric-option {
    & > svg {
      min-width: ${({ theme }) => `${theme.gridUnit * 4}px`};
    }
    & > .option-label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

interface ColumnSelectPopoverProps {
  columns: ColumnMeta[];
  editedColumn?: ColumnMeta | AdhocColumn;
  onChange: (column: ColumnMeta | AdhocColumn) => void;
  onClose: () => void;
  setLabel: (title: string) => void;
  getCurrentTab: (tab: string) => void;
  label: string;
}

const ColumnSelectPopover = ({
  columns,
  editedColumn,
  onChange,
  onClose,
  setLabel,
  getCurrentTab,
  label,
}: ColumnSelectPopoverProps) => {
  const [initialLabel] = useState(label);
  const [initialAdhocColumn, initialCalculatedColumn, initialSimpleColumn]: [
    AdhocColumn?,
    ColumnMeta?,
    ColumnMeta?,
  ] = !editedColumn
    ? [undefined, undefined, undefined]
    : isAdhocColumn(editedColumn)
    ? [editedColumn, undefined, undefined]
    : isSavedExpression(editedColumn)
    ? [undefined, editedColumn, undefined]
    : [undefined, undefined, editedColumn as ColumnMeta];
  const [adhocColumn, setAdhocColumn] = useState<AdhocColumn | undefined>(
    initialAdhocColumn,
  );
  const [selectedCalculatedColumn, setSelectedCalculatedColumn] = useState<
    ColumnMeta | undefined
  >(initialCalculatedColumn);
  const [selectedSimpleColumn, setSelectedSimpleColumn] = useState<
    ColumnMeta | undefined
  >(initialSimpleColumn);

  const [calculatedColumns, simpleColumns] = useMemo(
    () =>
      columns?.reduce(
        (acc: [ColumnMeta[], ColumnMeta[]], column: ColumnMeta) => {
          if (column.expression) {
            acc[0].push(column);
          } else {
            acc[1].push(column);
          }
          return acc;
        },
        [[], []],
      ),
    [columns],
  );

  const onSqlExpressionChange = useCallback(
    sqlExpression => {
      setAdhocColumn({ label, sqlExpression });
      setSelectedSimpleColumn(undefined);
      setSelectedCalculatedColumn(undefined);
    },
    [label],
  );

  const onCalculatedColumnChange = useCallback(
    selectedColumnName => {
      const selectedColumn = calculatedColumns.find(
        col => col.column_name === selectedColumnName,
      );
      setSelectedCalculatedColumn(selectedColumn);
      setSelectedSimpleColumn(undefined);
      setAdhocColumn(undefined);
      setLabel(
        selectedColumn?.verbose_name || selectedColumn?.column_name || '',
      );
    },
    [calculatedColumns, setLabel],
  );

  const onSimpleColumnChange = useCallback(
    selectedColumnName => {
      const selectedColumn = simpleColumns.find(
        col => col.column_name === selectedColumnName,
      );
      setSelectedCalculatedColumn(undefined);
      setSelectedSimpleColumn(selectedColumn);
      setAdhocColumn(undefined);
      setLabel(
        selectedColumn?.verbose_name || selectedColumn?.column_name || '',
      );
    },
    [setLabel, simpleColumns],
  );

  const defaultActiveTabKey = initialAdhocColumn
    ? 'sqlExpression'
    : initialSimpleColumn || calculatedColumns.length === 0
    ? 'simple'
    : 'saved';

  useEffect(() => {
    getCurrentTab(defaultActiveTabKey);
  }, [defaultActiveTabKey, getCurrentTab]);

  const onSave = useCallback(() => {
    if (adhocColumn && adhocColumn.label !== label) {
      adhocColumn.label = label;
    }
    const selectedColumn =
      adhocColumn || selectedCalculatedColumn || selectedSimpleColumn;
    if (!selectedColumn) {
      return;
    }
    onChange(selectedColumn);
    onClose();
  }, [
    adhocColumn,
    label,
    onChange,
    onClose,
    selectedCalculatedColumn,
    selectedSimpleColumn,
  ]);

  const onResetStateAndClose = useCallback(() => {
    setSelectedCalculatedColumn(initialCalculatedColumn);
    setSelectedSimpleColumn(initialSimpleColumn);
    setAdhocColumn(initialAdhocColumn);
    onClose();
  }, [
    initialAdhocColumn,
    initialCalculatedColumn,
    initialSimpleColumn,
    onClose,
  ]);

  const stateIsValid =
    adhocColumn || selectedCalculatedColumn || selectedSimpleColumn;
  const hasUnsavedChanges =
    initialLabel !== label ||
    selectedCalculatedColumn?.column_name !==
      initialCalculatedColumn?.column_name ||
    selectedSimpleColumn?.column_name !== initialSimpleColumn?.column_name ||
    adhocColumn?.sqlExpression !== initialAdhocColumn?.sqlExpression;

  const filterOption = useCallback(
    (input, option) =>
      option?.filterBy.toLowerCase().indexOf(input.toLowerCase()) >= 0,
    [],
  );

  const getPopupContainer = useCallback(
    (triggerNode: any) => triggerNode.parentNode,
    [],
  );

  return (
    <Form layout="vertical" id="metrics-edit-popover">
      <Tabs
        id="adhoc-metric-edit-tabs"
        defaultActiveKey={defaultActiveTabKey}
        onChange={getCurrentTab}
        className="adhoc-metric-edit-tabs"
        allowOverflow
      >
        <Tabs.TabPane key="saved" tab={t('Saved')}>
          <FormItem label={t('Saved expressions')}>
            <StyledSelect
              value={selectedCalculatedColumn?.column_name}
              getPopupContainer={getPopupContainer}
              onChange={onCalculatedColumnChange}
              allowClear
              showSearch
              autoFocus={!selectedCalculatedColumn}
              filterOption={filterOption}
              placeholder={t('%s column(s)', calculatedColumns.length)}
            >
              {calculatedColumns.map(calculatedColumn => (
                <Select.Option
                  value={calculatedColumn.column_name}
                  filterBy={
                    calculatedColumn.verbose_name ||
                    calculatedColumn.column_name
                  }
                  key={calculatedColumn.column_name}
                >
                  <StyledColumnOption column={calculatedColumn} showType />
                </Select.Option>
              ))}
            </StyledSelect>
          </FormItem>
        </Tabs.TabPane>
        <Tabs.TabPane key="simple" tab={t('Simple')}>
          <FormItem label={t('Column')}>
            <Select
              value={selectedSimpleColumn?.column_name}
              getPopupContainer={getPopupContainer}
              onChange={onSimpleColumnChange}
              allowClear
              showSearch
              autoFocus={!selectedSimpleColumn}
              filterOption={filterOption}
              placeholder={t('%s column(s)', simpleColumns.length)}
            >
              {simpleColumns.map(simpleColumn => (
                <Select.Option
                  value={simpleColumn.column_name}
                  filterBy={
                    simpleColumn.verbose_name || simpleColumn.column_name
                  }
                  key={simpleColumn.column_name}
                >
                  <StyledColumnOption column={simpleColumn} showType />
                </Select.Option>
              ))}
            </Select>
          </FormItem>
        </Tabs.TabPane>
        <Tabs.TabPane key="sqlExpression" tab={t('Custom SQL')}>
          <SQLEditor
            value={adhocColumn?.sqlExpression}
            showLoadingForImport
            onChange={onSqlExpressionChange}
            width="100%"
            height={160}
            showGutter={false}
            editorProps={{ $blockScrolling: true }}
            enableLiveAutocompletion
            className="filter-sql-editor"
            wrapEnabled
          />
        </Tabs.TabPane>
      </Tabs>
      <div>
        <Button buttonSize="small" onClick={onResetStateAndClose} cta>
          {t('Close')}
        </Button>
        <Button
          disabled={!stateIsValid}
          buttonStyle={
            hasUnsavedChanges && stateIsValid ? 'primary' : 'default'
          }
          buttonSize="small"
          onClick={onSave}
          cta
        >
          {t('Save')}
        </Button>
      </div>
    </Form>
  );
};

export default ColumnSelectPopover;
