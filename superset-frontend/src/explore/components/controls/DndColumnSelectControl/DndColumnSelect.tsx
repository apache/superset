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
import React, { useCallback, useMemo } from 'react';
import { tn } from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { isEmpty } from 'lodash';
import { LabelProps } from 'src/explore/components/controls/DndColumnSelectControl/types';
import DndSelectLabel from 'src/explore/components/controls/DndColumnSelectControl/DndSelectLabel';
import OptionWrapper from 'src/explore/components/controls/DndColumnSelectControl/OptionWrapper';
import { OptionSelector } from 'src/explore/components/controls/DndColumnSelectControl/utils';
import { DatasourcePanelDndItem } from 'src/explore/components/DatasourcePanel/types';
import { DndItemType } from 'src/explore/components/DndItemType';
import { useComponentDidUpdate } from 'src/common/hooks/useComponentDidUpdate';

export const DndColumnSelect = (props: LabelProps) => {
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

  const valuesRenderer = useCallback(
    () =>
      optionSelector.values.map((column, idx) => (
        <OptionWrapper
          key={idx}
          index={idx}
          clickClose={onClickClose}
          onShiftOptions={onShiftOptions}
          type={`${DndItemType.ColumnOption}_${name}_${label}`}
          canDelete={canDelete}
          column={column}
        />
      )),
    [
      canDelete,
      label,
      name,
      onClickClose,
      onShiftOptions,
      optionSelector.values,
    ],
  );

  return (
    <DndSelectLabel<string | string[], ColumnMeta[]>
      onDrop={onDrop}
      canDrop={canDrop}
      valuesRenderer={valuesRenderer}
      accept={DndItemType.Column}
      displayGhostButton={multi || optionSelector.values.length === 0}
      ghostButtonText={
        ghostButtonText ||
        tn('Drop column here', 'Drop columns here', multi ? 2 : 1)
      }
      {...props}
    />
  );
};
