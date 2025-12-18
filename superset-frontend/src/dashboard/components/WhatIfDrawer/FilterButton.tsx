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

import { memo } from 'react';
import { t } from '@superset-ui/core';
import { Tooltip, Popover } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { Datasource } from 'src/dashboard/types';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocFilterEditPopover from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopover';
import { FilterButtonStyled, FilterPopoverContent } from './styles';

interface FilterButtonProps {
  filterPopoverVisible: boolean;
  currentAdhocFilter: AdhocFilter | null;
  selectedColumn: string | undefined;
  selectedDatasource: Datasource | null;
  filterColumnOptions: Datasource['columns'];
  onOpenFilterPopover: () => void;
  onFilterPopoverVisibleChange: (visible: boolean) => void;
  onFilterChange: (adhocFilter: AdhocFilter) => void;
  onFilterPopoverClose: () => void;
  onFilterPopoverResize: () => void;
}

/**
 * Component for rendering the filter button with popover.
 * Uses memo to prevent unnecessary re-renders when parent state changes
 * that don't affect this component.
 */
const FilterButton = memo(function FilterButton({
  filterPopoverVisible,
  currentAdhocFilter,
  selectedColumn,
  selectedDatasource,
  filterColumnOptions,
  onOpenFilterPopover,
  onFilterPopoverVisibleChange,
  onFilterChange,
  onFilterPopoverClose,
  onFilterPopoverResize,
}: FilterButtonProps) {
  return (
    <Popover
      open={filterPopoverVisible}
      onOpenChange={onFilterPopoverVisibleChange}
      trigger="click"
      placement="left"
      destroyOnHidden
      content={
        currentAdhocFilter && selectedDatasource ? (
          <FilterPopoverContent>
            <AdhocFilterEditPopover
              adhocFilter={currentAdhocFilter}
              options={filterColumnOptions}
              datasource={selectedDatasource}
              onChange={onFilterChange}
              onClose={onFilterPopoverClose}
              onResize={onFilterPopoverResize}
              requireSave
            />
          </FilterPopoverContent>
        ) : null
      }
    >
      <Tooltip
        title={
          selectedColumn
            ? t('Add filter to scope the modification')
            : t('Select a column first')
        }
      >
        <FilterButtonStyled
          onClick={onOpenFilterPopover}
          disabled={!selectedColumn || !selectedDatasource}
          aria-label={t('Add filter')}
          buttonStyle="tertiary"
        >
          <Icons.FilterOutlined iconSize="m" />
        </FilterButtonStyled>
      </Tooltip>
    </Popover>
  );
});

export default FilterButton;
