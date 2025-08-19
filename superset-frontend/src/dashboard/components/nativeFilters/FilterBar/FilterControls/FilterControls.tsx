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
  useTheme,
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
  hideHeader?: boolean;
};

const FilterControls: FC<FilterControlsProps> = ({
  dataMaskSelected,
  onFilterSelectionChange,
  clearAllTriggers,
  onClearAllComplete,
  hideHeader = false,
}) => {
  const theme = useTheme();
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

  const [sectionsOpen, setSectionsOpen] = useState({
    filters: true,
    chartCustomization: true,
  });

  const toggleSection = useCallback((section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const sectionContainerStyle = useCallback(
    (theme: SupersetTheme) => css`
      margin-bottom: ${theme.sizeUnit * 3}px;
    `,
    [],
  );

  const sectionHeaderStyle = useCallback(
    (theme: SupersetTheme) => css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.sizeUnit * 2}px 0;
      cursor: pointer;
      user-select: none;

      &:hover {
        background: ${theme.colorBgTextHover};
        margin: 0 -${theme.sizeUnit * 2}px;
        padding: ${theme.sizeUnit * 2}px;
        border-radius: ${theme.sizeUnit}px;
      }
    `,
    [],
  );

  const sectionTitleStyle = useCallback(
    (theme: SupersetTheme) => css`
      margin: 0;
      font-size: ${theme.fontSize}px;
      font-weight: ${theme.fontWeightNormal};
      color: ${theme.colorText};
      line-height: 1.3;
    `,
    [],
  );

  const sectionContentStyle = useCallback(
    (theme: SupersetTheme) => css`
      padding: ${theme.sizeUnit * 2}px 0;
    `,
    [],
  );

  const dividerStyle = useCallback(
    (theme: SupersetTheme) => css`
      height: 1px;
      background: ${theme.colorSplit};
      margin: ${theme.sizeUnit * 2}px 0;
    `,
    [],
  );

  const iconStyle = useCallback(
    (isOpen: boolean, theme: SupersetTheme) => css`
      transform: ${isOpen ? 'rotate(0deg)' : 'rotate(180deg)'};
      transition: transform 0.2s ease;
      color: ${theme.colorTextSecondary};
    `,
    [],
  );

  const chartCustomizationContentStyle = useCallback(
    (theme: SupersetTheme) => css`
      display: flex;
      flex-direction: column;
      gap: ${theme.sizeUnit * 2}px;
    `,
    [],
  );
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
          <div css={sectionContainerStyle}>
            {!hideHeader && (
              <div
                css={sectionHeaderStyle}
                onClick={() => toggleSection('filters')}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSection('filters');
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <h4 css={sectionTitleStyle}>{t('Filters')}</h4>
                <Icons.UpOutlined
                  iconSize="m"
                  css={iconStyle(sectionsOpen.filters, theme)}
                />
              </div>
            )}
            {(hideHeader || sectionsOpen.filters) && (
              <div css={sectionContentStyle}>
                {filtersInScope.map(renderer)}
              </div>
            )}
            {(hideHeader || sectionsOpen.filters) && <div css={dividerStyle} />}
          </div>
        )}

        {showCollapsePanel && (hideHeader || sectionsOpen.filters) && (
          <FiltersOutOfScopeCollapsible
            filtersOutOfScope={filtersOutOfScope}
            renderer={renderer}
            forceRender={hasRequiredFirst}
          />
        )}

        {chartCustomizationItems.length > 0 && (
          <div css={sectionContainerStyle}>
            {!hideHeader && (
              <div
                css={sectionHeaderStyle}
                onClick={() => toggleSection('chartCustomization')}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSection('chartCustomization');
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <h4 css={sectionTitleStyle}>{t('Chart Customization')}</h4>
                <Icons.UpOutlined
                  iconSize="m"
                  css={iconStyle(sectionsOpen.chartCustomization, theme)}
                />
              </div>
            )}
            {(hideHeader || sectionsOpen.chartCustomization) && (
              <div css={sectionContentStyle}>
                <div css={chartCustomizationContentStyle}>
                  {chartCustomizationItems
                    .filter(item => !item.removed)
                    .map(item => (
                      <GroupByFilterCard
                        key={item.id}
                        customizationItem={item}
                      />
                    ))}
                </div>
              </div>
            )}
            {(hideHeader || sectionsOpen.chartCustomization) && (
              <div css={dividerStyle} />
            )}
          </div>
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
      sectionsOpen,
      toggleSection,
      sectionContainerStyle,
      sectionHeaderStyle,
      sectionTitleStyle,
      sectionContentStyle,
      dividerStyle,
      iconStyle,
      chartCustomizationContentStyle,
      hideHeader,
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
    const dividerItems = [];
    if (
      (crossFilters.length > 0 || nativeFiltersInScope.length > 0) &&
      chartCustomizationItems.length > 0
    ) {
      dividerItems.push({
        id: 'chart-customization-divider',
        element: (
          <div
            css={css`
              width: 1px;
              height: 22px;
              background: ${theme.colorBorder};
              margin-left: ${theme.sizeUnit * 4}px;
              margin-right: ${theme.sizeUnit}px;
              flex-shrink: 0;
            `}
          />
        ),
      });
    }

    const chartCustomizations = chartCustomizationItems
      .filter(item => !item.removed)
      .map(item => ({
        id: `chart-customization-${item.id}`,
        element: (
          <div
            className="chart-customization-item-wrapper"
            css={css`
              flex-shrink: 0;
            `}
          >
            <GroupByFilterCard
              customizationItem={item}
              orientation="horizontal"
            />
          </div>
        ),
      }));

    return [
      ...chartCustomizations,
      ...dividerItems,
      ...crossFilters,
      ...nativeFiltersInScope,
    ];
  }, [
    filtersInScope,
    renderer,
    rendererCrossFilter,
    selectedCrossFilters,
    chartCustomizationItems,
    theme,
  ]);

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
