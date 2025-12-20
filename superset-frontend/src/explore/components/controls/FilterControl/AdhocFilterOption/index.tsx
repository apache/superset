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
import type React from 'react';
import { OptionControlLabel } from 'src/explore/components/controls/OptionControls';
import { DndItemType } from 'src/explore/components/DndItemType';
import AdhocFilterPopoverTrigger from 'src/explore/components/controls/FilterControl/AdhocFilterPopoverTrigger';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { OptionSortType } from 'src/explore/types';
import { Operators } from 'src/explore/constants';
import { useGetTimeRangeLabel } from '../utils';

export interface AdhocFilterOptionProps {
  adhocFilter: AdhocFilter;
  onFilterEdit: (editedFilter: AdhocFilter) => void;
  onRemoveFilter: (e: React.MouseEvent) => void;
  options: OptionSortType[];
  sections?: string[];
  operators?: Operators[];
  datasource?: Record<string, unknown>;
  partitionColumn?: string | null;
  onMoveLabel: (dragIndex: number, hoverIndex: number) => void;
  onDropLabel: () => void;
  index: number;
}

export default function AdhocFilterOption({
  adhocFilter,
  options,
  datasource,
  onFilterEdit,
  onRemoveFilter,
  partitionColumn,
  onMoveLabel,
  onDropLabel,
  index,
  sections,
  operators,
}: AdhocFilterOptionProps) {
  const { actualTimeRange, title } = useGetTimeRangeLabel(adhocFilter);

  return (
    <AdhocFilterPopoverTrigger
      sections={sections}
      operators={operators}
      adhocFilter={adhocFilter}
      options={options}
      datasource={datasource as Record<string, unknown> || {}}
      onFilterEdit={onFilterEdit}
      partitionColumn={partitionColumn ?? undefined}
    >
      <OptionControlLabel
        label={actualTimeRange ?? adhocFilter.getDefaultLabel()}
        tooltipTitle={title ?? adhocFilter.getTooltipTitle()}
        onRemove={() =>
          onRemoveFilter({} as React.MouseEvent<Element, MouseEvent>)
        }
        onMoveLabel={onMoveLabel}
        onDropLabel={onDropLabel}
        index={index}
        type={DndItemType.FilterOption}
        withCaret
        isExtra={adhocFilter.isExtra}
      />
    </AdhocFilterPopoverTrigger>
  );
}
