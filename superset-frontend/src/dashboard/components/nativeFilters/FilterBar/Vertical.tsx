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
import { throttle } from 'lodash';
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
import cx from 'classnames';
import { styled, t, useTheme } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { EmptyState, Loading } from '@superset-ui/core/components';
import { getFilterBarTestId } from './utils';
import { VerticalBarProps } from './types';
import Header from './Header';
import FilterControls from './FilterControls/FilterControls';
import CrossFiltersVertical from './CrossFilters/Vertical';

const BarWrapper = styled.div<{ width: number }>`
  width: ${({ theme }) => theme.sizeUnit * 8}px;

  & .ant-tabs-top > .ant-tabs-nav {
    margin: 0;
  }
  &.open {
    width: ${({ width }) => width}px; // arbitrary...
  }
`;

const Bar = styled.div<{ width: number }>`
  ${({ theme, width }) => `
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
    border-right: 1px solid ${theme.colorSplit};
    border-bottom: 1px solid ${theme.colorSplit};
    min-height: 100%;
    display: none;
    &.open {
      display: flex;
    }
  `}
`;

const CollapsedBar = styled.div<{ offset: number }>`
  ${({ theme, offset }) => `
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

const FilterControlsWrapper = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 4}px;
    // 108px padding to make room for buttons with position: absolute
    padding-bottom: ${theme.sizeUnit * 27}px;
  `}
`;

export const FilterBarScrollContext = createContext(false);
const VerticalFilterBar: FC<VerticalBarProps> = ({
  actions,
  canEdit,
  dataMaskSelected,
  filtersOpen,
  filterValues,
  height,
  isInitialized,
  offset,
  onSelectionChange,
  toggleFiltersBar,
  width,
  clearAllTriggers,
  onClearAllComplete,
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

  const tabPaneStyle = useMemo(
    () => ({ overflow: 'auto', height, overscrollBehavior: 'contain' }),
    [height],
  );

  const filterControls = useMemo(
    () =>
      filterValues.length === 0 ? (
        <FilterBarEmptyStateContainer>
          <EmptyState
            size="small"
            title={t('No global filters are currently added')}
            image="filter.svg"
            description={
              canEdit &&
              t(
                'Click on "Add or Edit Filters" option in Settings to create new dashboard filters',
              )
            }
          />
        </FilterBarEmptyStateContainer>
      ) : (
        <FilterControlsWrapper>
          <FilterControls
            dataMaskSelected={dataMaskSelected}
            onFilterSelectionChange={onSelectionChange}
            clearAllTriggers={clearAllTriggers}
            onClearAllComplete={onClearAllComplete}
          />
        </FilterControlsWrapper>
      ),
    [canEdit, dataMaskSelected, filterValues.length, onSelectionChange],
  );

  return (
    <FilterBarScrollContext.Provider value={isScrolling}>
      <BarWrapper
        {...getFilterBarTestId()}
        className={cx({ open: filtersOpen })}
        width={width}
      >
        <CollapsedBar
          {...getFilterBarTestId('collapsable')}
          className={cx({ open: !filtersOpen })}
          onClick={openFiltersBar}
          role="button"
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
        <Bar className={cx({ open: filtersOpen })} width={width}>
          <Header toggleFiltersBar={toggleFiltersBar} />
          {!isInitialized ? (
            <div css={{ height }}>
              <Loading />
            </div>
          ) : (
            <div css={tabPaneStyle} onScroll={onScroll}>
              <>
                <CrossFiltersVertical />
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
