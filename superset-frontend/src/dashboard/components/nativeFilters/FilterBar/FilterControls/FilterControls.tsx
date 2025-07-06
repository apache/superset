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
import {
  memo,
  Fragment,
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
  isNativeFilterWithDataMask,
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
import { FilterBarOrientation, RootState } from 'src/dashboard/types';
import {
  DropdownContainer,
  type DropdownRef as DropdownContainerRef,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { useChartIds } from 'src/dashboard/util/charts/useChartIds';
import { useChartLayoutItems } from 'src/dashboard/util/useChartLayoutItems';
import { ChartCustomizationItem } from 'src/dashboard/components/nativeFilters/ChartCustomization/types';
import { FiltersOutOfScopeCollapsible } from '../FiltersOutOfScopeCollapsible';
import { useFilterControlFactory } from '../useFilterControlFactory';
import { FiltersDropdownContent } from '../FiltersDropdownContent';
import crossFiltersSelector from '../CrossFilters/selectors';
import CrossFilter from '../CrossFilters/CrossFilter';
import { useFilterOutlined } from '../useFilterOutlined';
import { useChartsVerboseMaps } from '../utils';
import GroupByFilterCard from '../../ChartCustomization/GroupByFilterCard';
import { selectChartCustomizationItems } from '../../ChartCustomization/selectors';

type FilterControlsProps = {
  dataMaskSelected: DataMaskStateWithId;
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void;
  clearAllTriggers?: Record<string, boolean>;
  onClearAllComplete?: (filterId: string) => void;
};

const SectionHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px
      ${theme.sizeUnit * 2}px;
    border-bottom: 1px solid ${theme.colorSplit};
    background: ${theme.colorBgContainer};
    cursor: pointer;
    user-select: none;

    &:hover {
      background: ${theme.colorBgTextHover};
    }

    h4 {
      margin: 0;
      font-size: ${theme.fontSizeSM}px;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
    }

    .section-icon {
      color: ${theme.colorTextSecondary};
      transition: transform 0.2s ease;
    }
  `}
`;

const SectionContainer = styled.div`
  ${({ theme }) => css`
    border: 1px solid ${theme.colorSplit};
    border-radius: ${theme.borderRadius}px;
    margin-bottom: ${theme.sizeUnit * 3}px;
    background: ${theme.colorBgContainer};
    overflow: hidden;
  `}
`;

const SectionContent = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 3}px;
  `}
`;

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: FC<CollapsibleSectionProps> = ({
  title,
  isOpen,
  onToggle,
  children,
}) => (
  <SectionContainer>
    <SectionHeader onClick={onToggle}>
      <h4>{title}</h4>
      <Icons.UpOutlined
        className="section-icon"
        iconSize="m"
        css={css`
          transform: ${isOpen ? 'rotate(0deg)' : 'rotate(180deg)'};
        `}
      />
    </SectionHeader>
    {isOpen && <SectionContent>{children}</SectionContent>}
  </SectionContainer>
);

const FilterControls: FC<FilterControlsProps> = ({
  dataMaskSelected,
  onFilterSelectionChange,
  clearAllTriggers,
  onClearAllComplete,
}) => {
  const filterBarOrientation = useSelector<RootState, FilterBarOrientation>(
    ({ dashboardInfo }) => dashboardInfo.filterBarOrientation,
  );

  const { outlinedFilterId, lastUpdated } = useFilterOutlined();

  const [overflowedIds, setOverflowedIds] = useState<string[]>([]);
  const popoverRef = useRef<DropdownContainerRef>(null);

  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );
  const chartIds = useChartIds();
  const chartLayoutItems = useChartLayoutItems();
  const verboseMaps = useChartsVerboseMaps();

  // Get chart customization items from Redux state
  const chartCustomizationItems = useSelector<
    RootState,
    ChartCustomizationItem[]
  >(state => selectChartCustomizationItems(state));

  const selectedCrossFilters = useMemo(
    () =>
      crossFiltersSelector({
        dataMask,
        chartIds,
        chartLayoutItems,
        verboseMaps,
      }),
    [chartIds, chartLayoutItems, dataMask, verboseMaps],
  );
  const { filterControlFactory, filtersWithValues } = useFilterControlFactory(
    dataMaskSelected,
    onFilterSelectionChange,
    clearAllTriggers,
    onClearAllComplete,
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

  const hasRequiredFirst = useMemo(
    () => filtersWithValues.some(filter => filter.requiredFirst),
    [filtersWithValues],
  );

  const dashboardHasTabs = useDashboardHasTabs();
  const showCollapsePanel = dashboardHasTabs && filtersWithValues.length > 0;

  // State for collapsible sections
  const [sectionsOpen, setSectionsOpen] = useState({
    filters: true,
    crossFilters: true,
    chartCustomization: true,
  });

  const toggleSection = useCallback((section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const renderer = useCallback(
    ({ id }: Filter | Divider, index: number | undefined) => {
      const filterIndex = filtersWithValues.findIndex(f => f.id === id);
      const key = index ?? id;
      return (
        // Empty text node is to ensure there's always an element preceding
        // the OutPortal, otherwise react-reverse-portal crashes
        <Fragment key={key}>
          {'' /* eslint-disable-line react/jsx-curly-brace-presence */}
          <OutPortal node={portalNodes[filterIndex]} inView />
        </Fragment>
      );
    },
    [filtersWithValues, portalNodes],
  );

  const renderVerticalContent = useCallback(
    () => (
      <>
        {filtersInScope.length > 0 && (
          <CollapsibleSection
            title={t('Filters')}
            isOpen={sectionsOpen.filters}
            onToggle={() => toggleSection('filters')}
          >
            {filtersInScope.map(renderer)}
          </CollapsibleSection>
        )}

        {selectedCrossFilters.length > 0 && (
          <CollapsibleSection
            title={t('Cross-filters')}
            isOpen={sectionsOpen.crossFilters}
            onToggle={() => toggleSection('crossFilters')}
          >
            {selectedCrossFilters.map((crossFilter, index) => (
              <CrossFilter
                key={`${crossFilter.name}${crossFilter.emitterId}`}
                filter={crossFilter}
                orientation={FilterBarOrientation.Vertical}
                last={index === selectedCrossFilters.length - 1}
              />
            ))}
          </CollapsibleSection>
        )}

        {chartCustomizationItems.length > 0 && (
          <CollapsibleSection
            title={t('Chart Customization')}
            isOpen={sectionsOpen.chartCustomization}
            onToggle={() => toggleSection('chartCustomization')}
          >
            <div
              css={(theme: SupersetTheme) => css`
                display: flex;
                flex-direction: column;
                gap: ${theme.sizeUnit * 2}px;
              `}
            >
              {chartCustomizationItems
                .filter(item => !item.removed)
                .map(item => (
                  <div
                    key={item.id}
                    className="chart-customization-wrapper"
                    data-test="chart-customization-card"
                  >
                    <GroupByFilterCard customizationItem={item} />
                  </div>
                ))}
            </div>
          </CollapsibleSection>
        )}

        {showCollapsePanel && (
          <FiltersOutOfScopeCollapsible
            filtersOutOfScope={filtersOutOfScope}
            forceRender={hasRequiredFirst}
            renderer={renderer}
          />
        )}
      </>
    ),
    [
      filtersInScope,
      renderer,
      showCollapsePanel,
      filtersOutOfScope,
      hasRequiredFirst,
      chartCustomizationItems,
      selectedCrossFilters,
      sectionsOpen,
      toggleSection,
    ],
  );

  const overflowedFiltersInScope = useMemo(
    () => filtersInScope.filter(({ id }) => overflowedIds?.includes(id)),
    [filtersInScope, overflowedIds],
  );

  const overflowedCrossFilters = useMemo(
    () =>
      selectedCrossFilters.filter(({ emitterId, name }) =>
        overflowedIds?.includes(`${name}${emitterId}`),
      ),
    [overflowedIds, selectedCrossFilters],
  );

  const activeOverflowedFiltersInScope = useMemo(() => {
    const activeOverflowedFilters = overflowedFiltersInScope.filter(filter =>
      isNativeFilterWithDataMask(filter),
    );
    return [...activeOverflowedFilters, ...overflowedCrossFilters];
  }, [overflowedCrossFilters, overflowedFiltersInScope]);

  const rendererCrossFilter = useCallback(
    (crossFilter, orientation, last) => (
      <CrossFilter
        filter={crossFilter}
        orientation={orientation}
        last={
          filtersInScope.length > 0 &&
          `${last.name}${last.emitterId}` ===
            `${crossFilter.name}${crossFilter.emitterId}`
        }
      />
    ),
    [filtersInScope.length],
  );

  const items = useMemo(() => {
    const crossFilters = selectedCrossFilters.map(c => ({
      // a combination of filter name and chart id to account
      // for multiple cross filters from the same chart in the future
      id: `${c.name}${c.emitterId}`,
      element: rendererCrossFilter(
        c,
        FilterBarOrientation.Horizontal,
        selectedCrossFilters.at(-1),
      ),
    }));
    const nativeFiltersInScope = filtersInScope.map((filter, index) => ({
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
    }));
    return [...crossFilters, ...nativeFiltersInScope];
  }, [filtersInScope, renderer, rendererCrossFilter, selectedCrossFilters]);

  const renderHorizontalContent = useCallback(
    () => (
      <div
        css={(theme: SupersetTheme) => css`
          padding: 0 ${theme.sizeUnit * 4}px;
          min-width: 0;
          flex: 1;
        `}
      >
        <DropdownContainer
          items={items}
          dropdownTriggerIcon={
            <Icons.FilterOutlined
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
            overflowedCrossFilters.length ||
            (filtersOutOfScope.length && showCollapsePanel)
              ? () => (
                  <FiltersDropdownContent
                    overflowedCrossFilters={overflowedCrossFilters}
                    filtersInScope={overflowedFiltersInScope}
                    filtersOutOfScope={filtersOutOfScope}
                    renderer={renderer}
                    rendererCrossFilter={rendererCrossFilter}
                    showCollapsePanel={showCollapsePanel}
                    forceRenderOutOfScope={hasRequiredFirst}
                  />
                )
              : undefined
          }
          forceRender={hasRequiredFirst}
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
    ),
    [
      items,
      activeOverflowedFiltersInScope,
      overflowedFiltersInScope,
      overflowedCrossFilters,
      filtersOutOfScope,
      showCollapsePanel,
      renderer,
      rendererCrossFilter,
      hasRequiredFirst,
      overflowedIds,
    ],
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
    if (outlinedFilterId && overflowedIds.includes(outlinedFilterId)) {
      popoverRef?.current?.open();
    }
  }, [outlinedFilterId, lastUpdated, popoverRef, overflowedIds]);

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
      {filterBarOrientation === FilterBarOrientation.Vertical &&
        renderVerticalContent()}
      {filterBarOrientation === FilterBarOrientation.Horizontal &&
        renderHorizontalContent()}
    </>
  );
};

export default memo(FilterControls);
