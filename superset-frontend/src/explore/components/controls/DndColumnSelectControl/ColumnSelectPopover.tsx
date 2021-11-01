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
import React, { useCallback, useMemo, useState } from 'react';
import Tabs from 'src/components/Tabs';
import Button from 'src/components/Button';
import { Select } from 'src/components';
import { t, styled } from '@superset-ui/core';

import { Form, FormItem } from 'src/components/Form';
import { StyledColumnOption } from 'src/explore/components/optionRenderers';
import { ColumnMeta } from '@superset-ui/chart-controls';

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
  editedColumn?: ColumnMeta;
  onChange: (column: ColumnMeta) => void;
  onClose: () => void;
}

const ColumnSelectPopover = ({
  columns,
  editedColumn,
  onChange,
  onClose,
}: ColumnSelectPopoverProps) => {
  const [
    initialCalculatedColumn,
    initialSimpleColumn,
  ] = editedColumn?.expression
    ? [editedColumn, undefined]
    : [undefined, editedColumn];
  const [selectedCalculatedColumn, setSelectedCalculatedColumn] = useState(
    initialCalculatedColumn,
  );
  const [selectedSimpleColumn, setSelectedSimpleColumn] = useState(
    initialSimpleColumn,
  );

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

  const onCalculatedColumnChange = useCallback(
    selectedColumnName => {
      const selectedColumn = calculatedColumns.find(
        col => col.column_name === selectedColumnName,
      );
      setSelectedCalculatedColumn(selectedColumn);
      setSelectedSimpleColumn(undefined);
    },
    [calculatedColumns],
  );

  const onSimpleColumnChange = useCallback(
    selectedColumnName => {
      const selectedColumn = simpleColumns.find(
        col => col.column_name === selectedColumnName,
      );
      setSelectedCalculatedColumn(undefined);
      setSelectedSimpleColumn(selectedColumn);
    },
    [simpleColumns],
  );

  const defaultActiveTabKey =
    initialSimpleColumn || calculatedColumns.length === 0 ? 'simple' : 'saved';

  const onSave = useCallback(() => {
    const selectedColumn = selectedCalculatedColumn || selectedSimpleColumn;
    if (!selectedColumn) {
      return;
    }
    onChange(selectedColumn);
    onClose();
  }, [onChange, onClose, selectedCalculatedColumn, selectedSimpleColumn]);

  const onResetStateAndClose = useCallback(() => {
    setSelectedCalculatedColumn(initialCalculatedColumn);
    setSelectedSimpleColumn(initialSimpleColumn);
    onClose();
  }, [initialCalculatedColumn, initialSimpleColumn, onClose]);

  const stateIsValid = selectedCalculatedColumn || selectedSimpleColumn;
  const hasUnsavedChanges =
    selectedCalculatedColumn?.column_name !==
      initialCalculatedColumn?.column_name ||
    selectedSimpleColumn?.column_name !== initialSimpleColumn?.column_name;
  const savedExpressionsLabel = t('Saved expressions');
  const simpleColumnsLabel = t('Column');

  return (
    <Form layout="vertical" id="metrics-edit-popover">
      <Tabs
        id="adhoc-metric-edit-tabs"
        defaultActiveKey={defaultActiveTabKey}
        className="adhoc-metric-edit-tabs"
        allowOverflow
      >
        <Tabs.TabPane key="saved" tab={t('Saved')}>
          <FormItem label={savedExpressionsLabel}>
            <StyledSelect
              ariaLabel={savedExpressionsLabel}
              value={selectedCalculatedColumn?.column_name}
              onChange={onCalculatedColumnChange}
              allowClear
              autoFocus={!selectedCalculatedColumn}
              placeholder={t('%s column(s)', calculatedColumns.length)}
              options={calculatedColumns.map(calculatedColumn => ({
                value: calculatedColumn.column_name,
                label:
                  calculatedColumn.verbose_name || calculatedColumn.column_name,
                customLabel: (
                  <StyledColumnOption column={calculatedColumn} showType />
                ),
                key: calculatedColumn.column_name,
              }))}
            />
          </FormItem>
        </Tabs.TabPane>
        <Tabs.TabPane key="simple" tab={t('Simple')}>
          <FormItem label={simpleColumnsLabel}>
            <Select
              ariaLabel={simpleColumnsLabel}
              value={selectedSimpleColumn?.column_name}
              onChange={onSimpleColumnChange}
              allowClear
              autoFocus={!selectedSimpleColumn}
              placeholder={t('%s column(s)', simpleColumns.length)}
              options={simpleColumns.map(simpleColumn => ({
                value: simpleColumn.column_name,
                label: simpleColumn.verbose_name || simpleColumn.column_name,
                customLabel: (
                  <StyledColumnOption column={simpleColumn} showType />
                ),
                key: simpleColumn.column_name,
              }))}
            />
          </FormItem>
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
