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
import React, { FC, useCallback, useMemo, useState } from 'react';
import {
  DataMask,
  DataMaskStateWithId,
  Filter,
  Divider,
  css,
  SupersetTheme,
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
import { FilterBarOrientation, RootState } from 'src/dashboard/types';
import DropdownContainer from 'src/components/DropdownContainer';
import { FiltersOutOfScopeCollapsible } from '../FiltersOutOfScopeCollapsible';
import { useFilterControlFactory } from '../useFilterControlFactory';
import { FiltersDropdownContent } from '../FiltersDropdownContent';

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
  const filterBarOrientation = useSelector<RootState, FilterBarOrientation>(
    state => state.dashboardInfo.filterBarOrientation,
  );

  const [overflowIndex, setOverflowIndex] = useState(0);

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

  const dashboardHasTabs = useDashboardHasTabs();
  const showCollapsePanel = dashboardHasTabs && filtersWithValues.length > 0;

  const renderer = useCallback(
    ({ id }: Filter | Divider) => {
      const index = filtersWithValues.findIndex(f => f.id === id);
      return <OutPortal node={portalNodes[index]} inView />;
    },
    [filtersWithValues, portalNodes],
  );

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
      element: (
        <div
          css={css`
            flex-shrink: 0;
          `}
        >
          {renderer(filter)}
        </div>
      ),
    }));
    return (
      <div
        css={(theme: SupersetTheme) =>
          css`
            padding-left: ${theme.gridUnit * 4}px;
            min-width: 0;
          `
        }
      >
        <DropdownContainer
          items={items}
          dropdownContent={overflowedItems => {
            const overflowedItemIds = new Set(
              overflowedItems.map(({ id }) => id),
            );
            return (
              <FiltersDropdownContent
                filtersInScope={filtersInScope.filter(({ id }) =>
                  overflowedItemIds.has(id),
                )}
                filtersOutOfScope={filtersOutOfScope}
                renderer={renderer}
                showCollapsePanel={showCollapsePanel}
              />
            );
          }}
          onOverflowingStateChange={overflowingState =>
            setOverflowIndex(overflowingState.notOverflowed.length)
          }
        />
      </div>
    );
  };

  return (
    <>
      {portalNodes
        .filter((node, index) => filterIds.has(filtersWithValues[index].id))
        .map((node, index) => (
          <InPortal node={node}>
            {filterControlFactory(index, filterBarOrientation, overflowIndex)}
          </InPortal>
        ))}
      {filterBarOrientation === FilterBarOrientation.VERTICAL &&
        renderVerticalContent()}
      {filterBarOrientation === FilterBarOrientation.HORIZONTAL &&
        renderHorizontalContent()}
    </>
  );
};

export default React.memo(FilterControls);
