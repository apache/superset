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
import { css, useTheme } from '@apache-superset/core/ui';
import { Tooltip, Tag, Popover } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { WhatIfFilter, Datasource } from 'src/dashboard/types';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocFilterEditPopover from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopover';
import {
  FilterButton,
  FilterPopoverContent,
  FiltersSection,
  FilterTagsContainer,
  Label,
} from './styles';

interface FilterSectionProps {
  filters: WhatIfFilter[];
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
  onEditFilter: (index: number) => void;
  onRemoveFilter: (e: React.MouseEvent, index: number) => void;
  formatFilterLabel: (filter: WhatIfFilter) => string;
}

/**
 * Component for rendering the filter button and filter tags.
 * Uses memo to prevent unnecessary re-renders when parent state changes
 * that don't affect this component.
 */
const FilterSection = memo(function FilterSection({
  filters,
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
  onEditFilter,
  onRemoveFilter,
  formatFilterLabel,
}: FilterSectionProps) {
  const theme = useTheme();

  return (
    <>
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
          <FilterButton
            onClick={onOpenFilterPopover}
            disabled={!selectedColumn || !selectedDatasource}
            aria-label={t('Add filter')}
            buttonStyle="tertiary"
          >
            <Icons.FilterOutlined iconSize="m" />
          </FilterButton>
        </Tooltip>
      </Popover>

      {filters.length > 0 && (
        <FiltersSection>
          <Label
            css={css`
              font-size: ${theme.fontSizeSM}px;
              color: ${theme.colorTextSecondary};
            `}
          >
            {t('Filters')}
          </Label>
          <FilterTagsContainer>
            {filters.map((filter, index) => (
              <Tag
                key={`${filter.col}-${filter.op}-${index}`}
                closable
                onClose={e => onRemoveFilter(e, index)}
                onClick={() => onEditFilter(index)}
                css={css`
                  cursor: pointer;
                  margin: 0;
                  &:hover {
                    opacity: 0.8;
                  }
                `}
              >
                {formatFilterLabel(filter)}
              </Tag>
            ))}
          </FilterTagsContainer>
        </FiltersSection>
      )}
    </>
  );
});

export default FilterSection;
