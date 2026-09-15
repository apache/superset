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

/* eslint-disable no-param-reassign */
import { throttle } from 'lodash-es';
import {
  memo,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  createContext,
  FC,
} from 'react';
import { useSelector } from 'react-redux';
import cx from 'classnames';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { RootState } from 'src/dashboard/types';
import { DataMaskStateWithId } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { EmptyState, Loading } from '@superset-ui/core/components';
import { useChartLayoutItems } from 'src/dashboard/util/useChartLayoutItems';
import { useChartIds } from 'src/dashboard/util/charts/useChartIds';
import { isEmbedded } from 'src/dashboard/util/isEmbedded';
import { getFilterBarTestId, useChartsVerboseMaps } from './utils';
import { VerticalBarProps } from './types';
import Header from './Header';
import FilterControls from './FilterControls/FilterControls';
import CrossFiltersVertical from './CrossFilters/Vertical';
import crossFiltersSelector from './CrossFilters/selectors';
import UrlFiltersVertical from './UrlFilters/Vertical';

enum SectionType {
  Filters = 'filters',
  ChartCustomization = 'chartCustomization',
  CrossFilters = 'crossFilters',
}

const BarWrapper = styled.div<{ width: number }>`
  width: ${({ theme }) => theme.sizeUnit * 8}px;

  & .ant-tabs-top > .ant-tabs-nav {
    margin: 0;
  }
  &.open {
    width: ${({ width }) => width}px; /* arbitrary... */
  }
`;

const Bar = styled.div<{ width: number; maxHeight?: string }>`
  ${({ theme, width, maxHeight }) => `
    & .ant-typography-edit-content {
      left: 0;
      margin-top: 0;
      width: 100%;
    }
    position: absolute;
    top: 0;
    left: 0;
    flex-direction: column;
    flex-grow: 1;
    width: ${width}px;
    background: ${theme.colorBgContainer};
    /* The bar is as wide as the column, so it paints over the column's right
       border. Keep its own so the separator is continuous whether or not the
       bar reaches that far down. */
    border-right: 1px solid ${theme.colorSplit};
    ${
      maxHeight
        ? /* As tall as its content but never taller than the frame, so a
             content-fit host can size the iframe to the bar and a long filter
             list scrolls inside it. getScrollSize() lifts the cap to measure. */
          `max-height: ${maxHeight};
           min-height: 0;
           &.open > *:not(.filter-bar-scroll) {
             flex: 0 0 auto;
           }`
        : `border-bottom: 1px solid ${theme.colorSplit};
           min-height: 100%;`
    }
    display: none;
    &.open {
      display: flex;
    }
  `}
`;

const CollapsedBar = styled.button<{ offset: number }>`
  ${({ theme, offset }) => `
    appearance: none;
    border: none;
    background: none;
    font: inherit;
    position: absolute;
    top: ${offset}px;
    left: 0;
    height: 100%;
    width: ${theme.sizeUnit * 8}px;
    padding-top: ${theme.sizeUnit * 2}px;
    display: none;
    text-align: center;
    &.open {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: ${theme.sizeUnit * 2}px;
    }
    svg {
      cursor: pointer;
    }
  `}
`;

const FilterBarEmptyStateContainer = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 8}px;
`;

const FilterControlsWrapper = styled.div<{ bounded?: boolean }>`
  ${({ theme, bounded }) => `
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 4}px;
    padding-top: 0; /* Works with other changes in PR https://github.com/apache/superset/pull/38646 to reduces space between filter header and 1st filter */
    ${
      bounded
        ? /* The buttons sit below the scroll area rather than over it, so
             there is no room to reserve. */
          `padding-bottom: ${theme.sizeUnit * 4}px;`
        : /* Room for the sticky action buttons at the end of the list. */
          `padding-bottom: ${theme.sizeUnit * 27}px;`
    }
  `}
`;

export const FilterBarScrollContext = createContext(false);
const VerticalFilterBar: FC<VerticalBarProps> = ({
  actions,
  canEdit,
  dataMaskSelected,
  filtersOpen,
  filterValues,
  chartCustomizationValues,
  height,
  isInitialized,
  offset,
  onSelectionChange,
  onPendingCustomizationDataMaskChange,
  toggleFiltersBar,
  width,
  mobileMode,
}) => {
  const theme = useTheme();
  const [isScrolling, setIsScrolling] = useState(false);
  const timeout = useRef<any>();

  const openFiltersBar = useCallback(
    () => toggleFiltersBar(true),
    [toggleFiltersBar],
  );

  const onScroll = useMemo(
    () =>
      throttle(() => {
        clearTimeout(timeout.current);
        setIsScrolling(true);
        timeout.current = setTimeout(() => {
          setIsScrolling(false);
        }, 300);
      }, 200),
    [],
  );

  useEffect(() => {
    document.onscroll = onScroll;
    return () => {
      document.onscroll = null;
    };
  }, [onScroll]);

  // `100vh` inside an iframe is the iframe's own height, so sizing the panel
  // from it feeds a content-fit host its own output back. Flex it instead.
  const embedded = isEmbedded();
  const tabPaneStyle = useMemo(
    () =>
      embedded
        ? {
            overflow: 'auto',
            flex: '1 1 auto',
            minHeight: 0,
            overscrollBehavior: 'contain',
          }
        : { overflow: 'auto', height, overscrollBehavior: 'contain' },
    [embedded, height],
  );

  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );
  const chartIds = useChartIds();
  const chartLayoutItems = useChartLayoutItems();
  const verboseMaps = useChartsVerboseMaps();
  const selectedCrossFilters = crossFiltersSelector({
    dataMask,
    chartIds,
    chartLayoutItems,
    verboseMaps,
  });

  // Determine available section types
  const availableSectionTypes = useMemo(() => {
    const types: SectionType[] = [];

    if (filterValues.length > 0) {
      types.push(SectionType.Filters);
    }

    if (chartCustomizationValues.length > 0) {
      types.push(SectionType.ChartCustomization);
    }

    if (selectedCrossFilters.length > 0) {
      types.push(SectionType.CrossFilters);
    }

    return types;
  }, [
    filterValues.length,
    chartCustomizationValues.length,
    selectedCrossFilters.length,
  ]);

  const hasOnlyOneSectionType = availableSectionTypes.length === 1;

  const filterControls = useMemo(() => {
    const hasFiltersOrCustomizations =
      filterValues.length > 0 || chartCustomizationValues.length > 0;

    return hasFiltersOrCustomizations ? (
      <FilterControlsWrapper bounded={embedded}>
        <FilterControls
          dataMaskSelected={dataMaskSelected}
          onFilterSelectionChange={onSelectionChange}
          onPendingCustomizationDataMaskChange={
            onPendingCustomizationDataMaskChange
          }
          chartCustomizationValues={chartCustomizationValues}
          hideHeader={hasOnlyOneSectionType}
        />
      </FilterControlsWrapper>
    ) : (
      <FilterBarEmptyStateContainer>
        <EmptyState
          size="small"
          title={t('No global filters are currently added')}
          image="filter.svg"
          description={
            canEdit &&
            t(
              'Click on "Add or edit filters and controls" option in Settings to create new dashboard filters',
            )
          }
        />
      </FilterBarEmptyStateContainer>
    );
  }, [
    canEdit,
    dataMaskSelected,
    embedded,
    filterValues.length,
    onSelectionChange,
    onPendingCustomizationDataMaskChange,
    chartCustomizationValues,
    hasOnlyOneSectionType,
  ]);

  return (
    <FilterBarScrollContext.Provider value={isScrolling}>
      <BarWrapper
        {...getFilterBarTestId()}
        className={cx({ open: filtersOpen })}
        width={width}
        css={
          mobileMode &&
          css`
            width: 100%;
            &.open {
              width: 100%;
            }
          `
        }
      >
        {!mobileMode && (
          <CollapsedBar
            type="button"
            {...getFilterBarTestId('collapsable')}
            className={cx({ open: !filtersOpen })}
            onClick={openFiltersBar}
            offset={offset}
          >
            <Icons.VerticalAlignTopOutlined
              iconSize="l"
              css={{
                transform: 'rotate(90deg)',
                marginBottom: `${theme.sizeUnit * 3}px`,
              }}
              className="collapse-icon"
              iconColor={theme.colorPrimary}
              {...getFilterBarTestId('expand-button')}
            />
            <Icons.FilterOutlined
              {...getFilterBarTestId('filter-icon')}
              iconColor={theme.colorTextTertiary}
              iconSize="l"
            />
          </CollapsedBar>
        )}
        <Bar
          className={cx(
            { open: filtersOpen },
            embedded && 'filter-bar-bounded',
          )}
          width={width}
          maxHeight={embedded ? '100vh' : undefined}
          css={
            mobileMode &&
            css`
              position: relative;
              width: 100%;
              border-right: none;
              border-bottom: none;
            `
          }
        >
          {!mobileMode && <Header toggleFiltersBar={toggleFiltersBar} />}
          {!isInitialized ? (
            <div
              css={{
                // Viewport-derived in an embed, and the measurement cannot lift
                // it, so the loading bar would report as frame-high.
                height: embedded ? undefined : height,
                padding: theme.sizeUnit * 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Loading position="inline-centered" size="s" muted />
            </div>
          ) : (
            <div
              className="filter-bar-scroll"
              css={tabPaneStyle}
              onScroll={onScroll}
            >
              <>
                <UrlFiltersVertical />
                <CrossFiltersVertical hideHeader={hasOnlyOneSectionType} />
                {filterControls}
              </>
            </div>
          )}
          {actions}
        </Bar>
      </BarWrapper>
    </FilterBarScrollContext.Provider>
  );
};
export default memo(VerticalFilterBar);
