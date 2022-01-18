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
import {
  Datasource,
  FeatureFlag,
  isFeatureEnabled,
  t,
} from '@superset-ui/core';
import {
  ColumnMeta,
  DEFAULT_DATE_FILTER,
  TimeFilter,
  TimeFilters,
} from '@superset-ui/chart-controls';
import { noOp } from 'src/utils/common';
import { DatasourcePanelDndItem } from '../../DatasourcePanel/types';
import DateFilterLabel from './DateFilterLabel';
import DndSelectLabel from '../DndColumnSelectControl';
import { DndItemType } from '../../DndItemType';
import ControlHeader from '../../ControlHeader';
import OptionWrapper from '../DndColumnSelectControl/OptionWrapper';

const DND_ACCEPTED_TYPES = [DndItemType.Column];

export interface DateFilterControlI {
  type: string;
  datasource: Datasource;
  name: string;
  onChange: (timeFilters: TimeFilters) => void;
  timeColumnOptions: { value: string; label: string }[];
  timeGrainOptions: { value: string; label: string }[];
  value: TimeFilters;
  isTimeseries?: boolean;
}

export const DndDateFilterControl = (props: DateFilterControlI) => {
  const {
    datasource,
    name,
    onChange,
    timeColumnOptions,
    timeGrainOptions,
    value,
    isTimeseries,
  } = props;
  const [newDatePopoverVisible, setNewDatePopoverVisible] = useState(false);
  const [droppedItem, setDroppedItem] = useState<ColumnMeta | undefined>(
    undefined,
  );

  const onRemoveFilter = useCallback(
    (index: number) => {
      const valuesCopy = [...value];
      valuesCopy.splice(index, 1);
      onChange(valuesCopy);
    },
    [onChange, value],
  );

  const onShiftFilters = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const newValues = [...value];
      [newValues[hoverIndex], newValues[dragIndex]] = [
        newValues[dragIndex],
        newValues[hoverIndex],
      ];
      onChange(newValues);
    },
    [onChange, value],
  );

  const canDrop = useCallback(
    (item: DatasourcePanelDndItem) => {
      const columnName = (item.value as ColumnMeta).column_name;

      return timeColumnOptions.some(option => option.value === columnName);
    },
    [timeColumnOptions, value],
  );

  const handleDrop = useCallback((item: DatasourcePanelDndItem) => {
    setDroppedItem(item.value as ColumnMeta);
    setNewDatePopoverVisible(true);
  }, []);

  const handleChange = useCallback(
    (timeFilter: TimeFilter, index?: number) => {
      let newValues = [...value];

      if (timeFilter.isXAxis) {
        newValues = newValues.map(val => ({ ...val, isXAxis: false }));
      }

      if (index === undefined) {
        newValues = [...newValues, timeFilter];
      } else {
        newValues[index] = timeFilter;
      }
      onChange(newValues);
    },
    [onChange, value],
  );

  const valuesRenderer = useCallback(
    () =>
      value?.map((dateFilter: TimeFilter, index: number) => (
        <DateFilterLabel
          key={`${dateFilter.timeColumn}-${dateFilter.timeGrain}-${dateFilter.timeRange}-${dateFilter.isXAxis}-${index}`}
          datasource={datasource}
          dateFilter={dateFilter}
          onChange={(timeFilter: TimeFilter) => handleChange(timeFilter, index)}
          onRemoveFilter={onRemoveFilter}
          onShiftFilters={onShiftFilters}
          timeGrainOptions={timeGrainOptions}
          timeColumnOptions={timeColumnOptions}
          isTimeseries={isTimeseries}
        >
          {({ label, tooltipTitle, onRemoveFilter, onShiftFilters }) => (
            <OptionWrapper
              index={index}
              label={label}
              tooltipTitle={tooltipTitle}
              clickClose={onRemoveFilter}
              onShiftOptions={onShiftFilters}
              type={DndItemType.Column}
              withCaret
            />
          )}
        </DateFilterLabel>
      )),
    [
      datasource,
      handleChange,
      isTimeseries,
      onRemoveFilter,
      onShiftFilters,
      timeColumnOptions,
      timeGrainOptions,
      value,
    ],
  );

  const handleClickGhostButton = useCallback(() => {
    setDroppedItem(undefined);
    setNewDatePopoverVisible(true);
  }, []);

  const ghostButtonText = isFeatureEnabled(FeatureFlag.ENABLE_DND_WITH_CLICK_UX)
    ? t('Drop temporal columns here or click')
    : t('Drop temporal columns here');

  const initialDateFilter: TimeFilter = useMemo(
    () => ({
      ...DEFAULT_DATE_FILTER,
      timeColumn: droppedItem?.column_name,
      isXAxis: isTimeseries && value.length === 0,
    }),
    [droppedItem?.column_name, value.length],
  );
  return (
    <>
      <ControlHeader {...props} />
      <DndSelectLabel
        name={name}
        onDrop={handleDrop}
        canDrop={canDrop}
        valuesRenderer={valuesRenderer}
        accept={DND_ACCEPTED_TYPES}
        ghostButtonText={ghostButtonText}
        onClickGhostButton={
          isFeatureEnabled(FeatureFlag.ENABLE_DND_WITH_CLICK_UX)
            ? handleClickGhostButton
            : undefined
        }
      />
      <DateFilterLabel
        datasource={datasource}
        dateFilter={initialDateFilter}
        onShiftFilters={noOp}
        onChange={handleChange}
        onRemoveFilter={noOp}
        timeColumnOptions={timeColumnOptions}
        timeGrainOptions={timeGrainOptions}
        popoverVisible={newDatePopoverVisible}
        setPopoverVisible={setNewDatePopoverVisible}
        isTimeseries={isTimeseries}
      >
        <div />
      </DateFilterLabel>
    </>
  );
};
