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
import React, {
  FC,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DataMask,
  DataMaskStateWithId,
  Filter,
  Divider,
  css,
  SupersetTheme,
  t,
  isFeatureEnabled,
  FeatureFlag,
  isNativeFilterWithDataMask,
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
import DropdownContainer, {
  Ref as DropdownContainerRef,
} from 'src/components/DropdownContainer';
import Icons from 'src/components/Icons';
import { FiltersOutOfScopeCollapsible } from '../FiltersOutOfScopeCollapsible';
import { useFilterControlFactory } from '../useFilterControlFactory';
import { FiltersDropdownContent } from '../FiltersDropdownContent';

type FilterControlsProps = {
  focusedFilterId?: string;
  dataMaskSelected: DataMaskStateWithId;
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void;
};

const FilterControls: FC<FilterControlsProps> = ({
  focusedFilterId,
  dataMaskSelected,
  onFilterSelectionChange,
}) => {
  const filterBarOrientation = useSelector<RootState, FilterBarOrientation>(
    ({ dashboardInfo }) =>
      isFeatureEnabled(FeatureFlag.HORIZONTAL_FILTER_BAR)
        ? dashboardInfo.filterBarOrientation
        : FilterBarOrientation.VERTICAL,
  );

  const [overflowedIds, setOverflowedIds] = useState<string[]>([]);
  const popoverRef = useRef<DropdownContainerRef>(null);

  const { filterControlFactory, filtersWithValues } = useFilterControlFactory(
    dataMaskSelected,
    focusedFilterId,
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
    ({ id }: Filter | Divider, index: number | undefined) => {
      const filterIndex = filtersWithValues.findIndex(f => f.id === id);
      const key = index ?? id;
      return (
        // Empty text node is to ensure there's always an element preceding
        // the OutPortal, otherwise react-reverse-portal crashes
        <React.Fragment key={key}>
          {'' /* eslint-disable-line react/jsx-curly-brace-presence */}
          <OutPortal node={portalNodes[filterIndex]} inView />
        </React.Fragment>
      );
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

  const items = useMemo(
    () =>
      filtersInScope.map((filter, index) => ({
        id: filter.id,
        element: (
          <div
            className="filter-item-wrapper"
            css={css`
              flex-shrink: 0;
            `}
          >
            {renderer(filter, index)}
          </div>
        ),
      })),
    [filtersInScope, renderer],
  );

  const overflowedFiltersInScope = useMemo(
    () => filtersInScope.filter(({ id }) => overflowedIds?.includes(id)),
    [filtersInScope, overflowedIds],
  );

  const activeOverflowedFiltersInScope = useMemo(
    () =>
      overflowedFiltersInScope.filter(filter =>
        isNativeFilterWithDataMask(filter),
      ),
    [overflowedFiltersInScope],
  );

  const renderHorizontalContent = () => (
    <div
      css={(theme: SupersetTheme) =>
        css`
          padding: 0 ${theme.gridUnit * 4}px;
          min-width: 0;
          flex: 1;
        `
      }
    >
      <DropdownContainer
        items={items}
        dropdownTriggerIcon={
          <Icons.FilterSmall
            css={css`
              && {
                margin-right: -4px;
                display: flex;
              }
            `}
          />
        }
        dropdownTriggerText={t('More filters')}
        dropdownTriggerCount={activeOverflowedFiltersInScope.length}
        dropdownTriggerTooltip={
          activeOverflowedFiltersInScope.length === 0
            ? t('No applied filters')
            : t(
                'Applied filters: %s',
                activeOverflowedFiltersInScope
                  .map(filter => filter.name)
                  .join(', '),
              )
        }
        dropdownContent={
          overflowedFiltersInScope.length ||
          (filtersOutOfScope.length && showCollapsePanel)
            ? () => (
                <FiltersDropdownContent
                  filtersInScope={overflowedFiltersInScope}
                  filtersOutOfScope={filtersOutOfScope}
                  renderer={renderer}
                  showCollapsePanel={showCollapsePanel}
                />
              )
            : undefined
        }
        ref={popoverRef}
        onOverflowingStateChange={({ overflowed: nextOverflowedIds }) => {
          if (
            nextOverflowedIds.length !== overflowedIds.length ||
            overflowedIds.reduce(
              (a, b, i) => a || b !== nextOverflowedIds[i],
              false,
            )
          ) {
            setOverflowedIds(nextOverflowedIds);
          }
        }}
      />
    </div>
  );

  const overflowedByIndex = useMemo(() => {
    const filtersOutOfScopeIds = new Set(filtersOutOfScope.map(({ id }) => id));
    const overflowedFiltersInScopeIds = new Set(
      overflowedFiltersInScope.map(({ id }) => id),
    );

    return filtersWithValues.map(
      filter =>
        filtersOutOfScopeIds.has(filter.id) ||
        overflowedFiltersInScopeIds.has(filter.id),
    );
  }, [filtersOutOfScope, filtersWithValues, overflowedFiltersInScope]);

  useEffect(() => {
    if (focusedFilterId && overflowedIds.includes(focusedFilterId)) {
      popoverRef?.current?.open();
    }
  }, [focusedFilterId, popoverRef, overflowedIds]);

  return (
    <>
      {portalNodes
        .filter((node, index) => filterIds.has(filtersWithValues[index].id))
        .map((node, index) => (
          <InPortal node={node} key={filtersWithValues[index].id}>
            {filterControlFactory(
              index,
              filterBarOrientation,
              overflowedByIndex[index],
            )}
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
