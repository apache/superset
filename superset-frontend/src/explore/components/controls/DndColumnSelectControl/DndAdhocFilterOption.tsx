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
import React from 'react';
import { t } from '@superset-ui/core';
import { DndItemType } from 'src/explore/components/DndItemType';
import AdhocFilterPopoverTrigger from 'src/explore/components/controls/FilterControl/AdhocFilterPopoverTrigger';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { OptionSortType } from 'src/explore/types';
import { useGetTimeRangeLabel } from 'src/explore/components/controls/FilterControl/utils';
import OptionWrapper from './OptionWrapper';

export interface DndAdhocFilterOptionProps {
  adhocFilter: AdhocFilter;
  onFilterEdit: (changedFilter: AdhocFilter) => void;
  onClickClose: (index: number) => void;
  onShiftOptions: (dragIndex: number, hoverIndex: number) => void;
  options: OptionSortType[];
  datasource: Record<string, any>;
  partitionColumn?: string;
  index: number;
}

export default function DndAdhocFilterOption({
  adhocFilter,
  options,
  datasource,
  onFilterEdit,
  onShiftOptions,
  onClickClose,
  partitionColumn,
  index,
}: DndAdhocFilterOptionProps) {
  const { actualTimeRange, title } = useGetTimeRangeLabel(adhocFilter);

  return (
    <AdhocFilterPopoverTrigger
      key={index}
      adhocFilter={adhocFilter}
      options={options}
      datasource={datasource}
      onFilterEdit={onFilterEdit}
      partitionColumn={partitionColumn}
    >
      <OptionWrapper
        key={index}
        index={index}
        label={actualTimeRange ?? adhocFilter.getDefaultLabel()}
        tooltipTitle={title ?? adhocFilter.getTooltipTitle()}
        clickClose={onClickClose}
        onShiftOptions={onShiftOptions}
        type={DndItemType.FilterOption}
        withCaret
        isExtra={adhocFilter.isExtra}
        datasourceWarningMessage={
          adhocFilter.datasourceWarning
            ? t('This filter might be incompatible with current dataset')
            : undefined
        }
      />
    </AdhocFilterPopoverTrigger>
  );
}
