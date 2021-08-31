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
import { NativeSelect as Select } from 'src/components/Select';
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
