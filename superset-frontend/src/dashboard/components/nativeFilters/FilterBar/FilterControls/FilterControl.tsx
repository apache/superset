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
import { memo, useContext, useMemo, useState } from 'react';
import {
  createHtmlPortalNode,
  InPortal,
  OutPortal,
} from 'react-reverse-portal';
import { FilterBarOrientation } from 'src/dashboard/types';
import { ChartCustomization } from '@superset-ui/core';
import { checkIsMissingRequiredValue } from '../utils';
import FilterValue from './FilterValue';
import { FilterCard } from '../../FilterCard';
import { FilterBarScrollContext } from '../Vertical';
import { FilterControlProps } from './types';
import { FilterCardPlacement } from '../../FilterCard/types';
import { useIsFilterInScope } from '../../state';
import {
  FilterStyledIcon,
  RequiredFieldIndicator,
  DescriptionToolTip,
  useFilterControlDisplay,
} from './FilterControlShared';
import GroupByFilterCard from './GroupByFilterCard';

export interface FilterControlExtendedProps extends FilterControlProps {
  isCustomization?: boolean;
}

const FilterControl = ({
  dataMaskSelected,
  filter,
  icon,
  onFilterSelectionChange,
  inView,
  showOverflow,
  parentRef,
  orientation = FilterBarOrientation.Vertical,
  overflow = false,
  clearAllTrigger,
  onClearAllComplete,
  isCustomization = false,
}: FilterControlExtendedProps) => {
  const portalNode = useMemo(() => createHtmlPortalNode(), []);
  const [isFilterActive, setIsFilterActive] = useState(false);

  const { name = '<undefined>' } = filter;

  const isFilterInScope = useIsFilterInScope();
  const isMissingRequiredValue =
    isFilterInScope(filter) &&
    checkIsMissingRequiredValue(filter, filter.dataMask?.filterState);
  const validateStatus = isMissingRequiredValue ? 'error' : undefined;
  const isRequired = !!filter.controlValues?.enableEmptyFilter;
  const inverseSelection = !!filter.controlValues?.inverseSelection;

  const {
    FilterControlContainer,
    FormItem,
    FilterControlTitleBox,
    FilterControlTitle,
  } = useFilterControlDisplay(orientation, overflow, inverseSelection);

  const label = useMemo(
    () => (
      <FilterControlTitleBox>
        <FilterControlTitle
          id={`filter-name-${filter.id}`}
          data-test="filter-control-name"
        >
          {name}
        </FilterControlTitle>
        {isRequired && <RequiredFieldIndicator />}
        {filter.description?.trim() && (
          <DescriptionToolTip description={filter.description} />
        )}
        <FilterStyledIcon data-test="filter-icon">{icon}</FilterStyledIcon>
      </FilterControlTitleBox>
    ),
    [
      FilterControlTitleBox,
      FilterControlTitle,
      name,
      isRequired,
      filter.description,
      icon,
    ],
  );

  const isScrolling = useContext(FilterBarScrollContext);
  const filterCardPlacement = useMemo(() => {
    if (orientation === FilterBarOrientation.Horizontal) {
      if (overflow) {
        return FilterCardPlacement.Left;
      }
      return FilterCardPlacement.Bottom;
    }
    return FilterCardPlacement.Right;
  }, [orientation, overflow]);

  const isDynamicGroupBy =
    isCustomization &&
    filter.filterType === 'chart_customization_dynamic_groupby';

  if (isDynamicGroupBy) {
    return (
      <GroupByFilterCard
        customizationItem={filter as any as ChartCustomization}
        orientation={
          orientation === FilterBarOrientation.Horizontal
            ? 'horizontal'
            : 'vertical'
        }
        dataMaskSelected={dataMaskSelected}
        onFilterSelectionChange={onFilterSelectionChange}
      />
    );
  }

  return (
    <>
      <InPortal node={portalNode}>
        <FilterValue
          dataMaskSelected={dataMaskSelected}
          filter={filter}
          showOverflow={showOverflow}
          onFilterSelectionChange={onFilterSelectionChange}
          inView={inView}
          parentRef={parentRef}
          setFilterActive={setIsFilterActive}
          orientation={orientation}
          overflow={overflow}
          validateStatus={validateStatus}
          clearAllTrigger={clearAllTrigger}
          onClearAllComplete={onClearAllComplete}
          isCustomization={isCustomization}
        />
      </InPortal>
      <FilterControlContainer
        layout={
          orientation === FilterBarOrientation.Horizontal && !overflow
            ? 'horizontal'
            : 'vertical'
        }
      >
        <FilterCard
          filter={filter}
          isVisible={!isFilterActive && !isScrolling}
          placement={filterCardPlacement}
        >
          <div>
            <FormItem
              label={label}
              htmlFor={filter.id}
              required={filter?.controlValues?.enableEmptyFilter}
              validateStatus={validateStatus}
            >
              <OutPortal node={portalNode} />
            </FormItem>
          </div>
        </FilterCard>
      </FilterControlContainer>
    </>
  );
};

export default memo(FilterControl);
