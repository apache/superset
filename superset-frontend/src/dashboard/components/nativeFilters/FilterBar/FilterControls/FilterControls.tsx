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
import React, { FC, useMemo, useRef, useState } from 'react';
import {
  DataMask,
  DataMaskStateWithId,
  Filter,
  isDefined,
  styled,
} from '@superset-ui/core';
import {
  createHtmlPortalNode,
  InPortal,
  OutPortal,
} from 'react-reverse-portal';
import { useSelector } from 'react-redux';
import {
  useDashboardHasTabs,
  useSelectFiltersInScope,
} from 'src/dashboard/components/nativeFilters/state';
import { FilterBarLocation, RootState } from 'src/dashboard/types';
import DropdownContainer, { Ref } from 'src/components/DropdownContainer';
import { useChangeEffect } from 'src/hooks/useChangeEffect';
import { FiltersOutOfScopeCollapsible } from '../FiltersOutOfScopeCollapsible';
import { useFilterControlFactory } from '../useFilterControlFactory';
import { FiltersDropdownContent } from '../FiltersDropdownContent';

const Wrapper = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  // 108px padding to make room for buttons with position: absolute
  padding-bottom: ${({ theme }) => theme.gridUnit * 27}px;
`;

type FilterControlsProps = {
  directPathToChild?: string[];
  dataMaskSelected: DataMaskStateWithId;
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void;
};

const FilterControls: FC<FilterControlsProps> = ({
  directPathToChild,
  dataMaskSelected,
  onFilterSelectionChange,
}) => {
  const dropdownRef = useRef<Ref>(null);
  const filterBarLocation = useSelector<RootState, FilterBarLocation>(
    state => state.dashboardInfo.filterBarLocation,
  );
  const [overflowedItemIds, setOverflowedItemIds] = useState<string[]>([]);

  const { filterControlFactory, filtersWithValues } = useFilterControlFactory(
    dataMaskSelected,
    directPathToChild,
    onFilterSelectionChange,
  );
  const portalNodes = useMemo(() => {
    const nodes = new Array(filtersWithValues.length);
    for (let i = 0; i < filtersWithValues.length; i += 1) {
      nodes[i] = createHtmlPortalNode();
    }
    return nodes;
  }, [filtersWithValues.length]);

  const filterIds = new Set(filtersWithValues.map(item => item.id));

  const [filtersInScope, filtersOutOfScope] =
    useSelectFiltersInScope(filtersWithValues);

  useChangeEffect(directPathToChild, prev => {
    if (
      filterBarLocation === FilterBarLocation.HORIZONTAL &&
      isDefined(prev) &&
      overflowedItemIds?.some(id => directPathToChild?.includes(id))
    ) {
      dropdownRef.current?.open();
    }
  });

  const dashboardHasTabs = useDashboardHasTabs();
  const showCollapsePanel = dashboardHasTabs && filtersWithValues.length > 0;

  const renderer = ({ id }: { id: string; [key: string]: any }) => {
    const index = filtersWithValues.findIndex(f => f.id === id);
    return <OutPortal node={portalNodes[index]} inView />;
  };

  const renderVerticalContent = () => (
    <>
      {filtersInScope.map(renderer)}
      {showCollapsePanel && (
        <FiltersOutOfScopeCollapsible
          filtersOutOfScope={filtersOutOfScope}
          hasTopMargin={filtersInScope.length > 0}
          renderer={renderer}
        />
      )}
    </>
  );

  const renderHorizontalContent = () => {
    const items = filtersInScope.map(filter => ({
      id: filter.id,
      element: renderer(filter),
    }));
    return (
      <DropdownContainer
        items={items}
        popoverContent={overflowedItems => (
          <FiltersDropdownContent
            filtersInScope={overflowedItems}
            filtersOutOfScope={filtersOutOfScope}
            renderer={renderer}
            showCollapsePanel={showCollapsePanel}
          />
        )}
        ref={dropdownRef}
        onOverflowingStateChange={overflowingState => {
          setOverflowedItemIds(overflowingState.overflowed);
        }}
      />
    );
  };

  return (
    <Wrapper>
      {portalNodes
        .filter((node, index) => filterIds.has(filtersWithValues[index].id))
        .map((node, index) => (
          <InPortal node={node}>{filterControlFactory(index)}</InPortal>
        ))}
      {filterBarLocation === FilterBarLocation.VERTICAL &&
        renderVerticalContent()}
      {filterBarLocation === FilterBarLocation.HORIZONTAL &&
        renderHorizontalContent()}
    </Wrapper>
  );
};

export default React.memo(FilterControls);
