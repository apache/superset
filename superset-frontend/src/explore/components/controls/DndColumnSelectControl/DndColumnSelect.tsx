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
import React, { useCallback, useMemo, useState } from 'react';
import { FeatureFlag, isFeatureEnabled, tn } from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { isEmpty } from 'lodash';
import DndSelectLabel from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import OptionWrapper from 'src/explore/components/controls/DndColumnSelectControl/OptionWrapper';
import { OptionSelector } from 'src/explore/components/controls/DndColumnSelectControl/utils';
import { DatasourcePanelDndItem } from 'src/explore/components/DatasourcePanel/types';
import { DndItemType } from 'src/explore/components/DndItemType';
import { useComponentDidUpdate } from 'src/common/hooks/useComponentDidUpdate';
import ColumnSelectPopoverTrigger from './ColumnSelectPopoverTrigger';
import { DndControlProps } from './types';

export type DndColumnSelectProps = DndControlProps<string> & {
  options: Record<string, ColumnMeta>;
};

export function DndColumnSelect(props: DndColumnSelectProps) {
  const {
    value,
    options,
    multi = true,
    onChange,
    canDelete = true,
    ghostButtonText,
    name,
    label,
  } = props;
  const [newColumnPopoverVisible, setNewColumnPopoverVisible] = useState(false);

  const optionSelector = useMemo(
    () => new OptionSelector(options, multi, value),
    [multi, options, value],
  );

  // synchronize values in case of dataset changes
  const handleOptionsChange = useCallback(() => {
    const optionSelectorValues = optionSelector.getValues();
    if (typeof value !== typeof optionSelectorValues) {
      onChange(optionSelectorValues);
    }
    if (
      typeof value === 'string' &&
      typeof optionSelectorValues === 'string' &&
      value !== optionSelectorValues
    ) {
      onChange(optionSelectorValues);
    }
    if (
      Array.isArray(optionSelectorValues) &&
      Array.isArray(value) &&
      (optionSelectorValues.length !== value.length ||
        optionSelectorValues.every((val, index) => val === value[index]))
    ) {
      onChange(optionSelectorValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value), JSON.stringify(optionSelector.getValues())]);

  // useComponentDidUpdate to avoid running this for the first render, to avoid
  // calling onChange when the initial value is not valid for the dataset
  useComponentDidUpdate(handleOptionsChange);

  const onDrop = useCallback(
    (item: DatasourcePanelDndItem) => {
      const column = item.value as ColumnMeta;
      if (!optionSelector.multi && !isEmpty(optionSelector.values)) {
        optionSelector.replace(0, column.column_name);
      } else {
        optionSelector.add(column.column_name);
      }
      onChange(optionSelector.getValues());
    },
    [onChange, optionSelector],
  );

  const canDrop = useCallback(
    (item: DatasourcePanelDndItem) => {
      const columnName = (item.value as ColumnMeta).column_name;
      return (
        columnName in optionSelector.options && !optionSelector.has(columnName)
      );
    },
    [optionSelector],
  );

  const onClickClose = useCallback(
    (index: number) => {
      optionSelector.del(index);
      onChange(optionSelector.getValues());
    },
    [onChange, optionSelector],
  );

  const onShiftOptions = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      optionSelector.swap(dragIndex, hoverIndex);
      onChange(optionSelector.getValues());
    },
    [onChange, optionSelector],
  );

  const popoverOptions = useMemo(
    () =>
      Object.values(options).filter(
        col =>
          !optionSelector.values
            .map(val => val.column_name)
            .includes(col.column_name),
      ),
    [optionSelector.values, options],
  );

  const valuesRenderer = useCallback(
    () =>
      optionSelector.values.map((column, idx) =>
        isFeatureEnabled(FeatureFlag.ENABLE_DND_WITH_CLICK_UX) ? (
          <ColumnSelectPopoverTrigger
            columns={popoverOptions}
            onColumnEdit={newColumn => {
              optionSelector.replace(idx, newColumn.column_name);
              onChange(optionSelector.getValues());
            }}
            editedColumn={column}
          >
            <OptionWrapper
              key={idx}
              index={idx}
              clickClose={onClickClose}
              onShiftOptions={onShiftOptions}
              type={`${DndItemType.ColumnOption}_${name}_${label}`}
              canDelete={canDelete}
              column={column}
              withCaret
            />
          </ColumnSelectPopoverTrigger>
        ) : (
          <OptionWrapper
            key={idx}
            index={idx}
            clickClose={onClickClose}
            onShiftOptions={onShiftOptions}
            type={`${DndItemType.ColumnOption}_${name}_${label}`}
            canDelete={canDelete}
            column={column}
          />
        ),
      ),
    [
      canDelete,
      label,
      name,
      onChange,
      onClickClose,
      onShiftOptions,
      optionSelector,
      popoverOptions,
    ],
  );

  const addNewColumnWithPopover = useCallback(
    (newColumn: ColumnMeta) => {
      optionSelector.add(newColumn.column_name);
      onChange(optionSelector.getValues());
    },
    [onChange, optionSelector],
  );

  const togglePopover = useCallback((visible: boolean) => {
    setNewColumnPopoverVisible(visible);
  }, []);

  const closePopover = useCallback(() => {
    togglePopover(false);
  }, [togglePopover]);

  const openPopover = useCallback(() => {
    togglePopover(true);
  }, [togglePopover]);

  const defaultGhostButtonText = isFeatureEnabled(
    FeatureFlag.ENABLE_DND_WITH_CLICK_UX,
  )
    ? tn(
        'Drop a column here or click',
        'Drop columns here or click',
        multi ? 2 : 1,
      )
    : tn('Drop column here', 'Drop columns here', multi ? 2 : 1);

  return (
    <div>
      <DndSelectLabel
        onDrop={onDrop}
        canDrop={canDrop}
        valuesRenderer={valuesRenderer}
        accept={DndItemType.Column}
        displayGhostButton={multi || optionSelector.values.length === 0}
        ghostButtonText={ghostButtonText || defaultGhostButtonText}
        onClickGhostButton={
          isFeatureEnabled(FeatureFlag.ENABLE_DND_WITH_CLICK_UX)
            ? openPopover
            : undefined
        }
        {...props}
      />
      <ColumnSelectPopoverTrigger
        columns={popoverOptions}
        onColumnEdit={addNewColumnWithPopover}
        isControlledComponent
        togglePopover={togglePopover}
        closePopover={closePopover}
        visible={newColumnPopoverVisible}
      >
        <div />
      </ColumnSelectPopoverTrigger>
    </div>
  );
}
