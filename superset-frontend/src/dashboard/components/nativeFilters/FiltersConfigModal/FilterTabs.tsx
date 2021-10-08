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
import { PlusOutlined } from '@ant-design/icons';
import { styled, t } from '@superset-ui/core';
import React, { FC } from 'react';
import { LineEditableTabs } from 'src/components/Tabs';
import Icons from 'src/components/Icons';
import { FilterRemoval } from './types';
import { REMOVAL_DELAY_SECS } from './utils';

export const FILTER_WIDTH = 180;

export const StyledSpan = styled.span`
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary.dark1};
  &:hover {
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
`;

export const StyledFilterTitle = styled.span`
  width: 100%;
  white-space: normal;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

export const StyledAddFilterBox = styled.div`
  color: ${({ theme }) => theme.colors.primary.dark1};
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

export const StyledTrashIcon = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.light3};
`;

export const FilterTabTitle = styled.span`
  transition: color ${({ theme }) => theme.transitionTiming}s;
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  @keyframes tabTitleRemovalAnimation {
    0%,
    90% {
      opacity: 1;
    }
    95%,
    100% {
      opacity: 0;
    }
  }

  &.removed {
    color: ${({ theme }) => theme.colors.warning.dark1};
    transform-origin: top;
    animation-name: tabTitleRemovalAnimation;
    animation-duration: ${REMOVAL_DELAY_SECS}s;
  }

  &.errored > span {
    color: ${({ theme }) => theme.colors.error.base};
  }
`;

const StyledWarning = styled(Icons.Warning)`
  color: ${({ theme }) => theme.colors.error.base};
  &.anticon {
    margin-right: 0;
  }
`;

const FilterTabsContainer = styled(LineEditableTabs)`
  ${({ theme }) => `
    height: 100%;

    & > .ant-tabs-content-holder {
      border-left: 1px solid ${theme.colors.grayscale.light2};
      padding-right: ${theme.gridUnit * 4}px;
      overflow-x: hidden;
      overflow-y: auto;
    }

    & > .ant-tabs-content-holder ~ .ant-tabs-content-holder {
      border: none;
    }

    &.ant-tabs-card > .ant-tabs-nav .ant-tabs-ink-bar {
      visibility: hidden;
    }

    &.ant-tabs-left
      > .ant-tabs-content-holder
      > .ant-tabs-content
      > .ant-tabs-tabpane {
      padding-left: ${theme.gridUnit * 4}px;
      margin-top: ${theme.gridUnit * 4}px;
    }

    .ant-tabs-nav-list {
      overflow-x: hidden;
      overflow-y: auto;
      padding-top: ${theme.gridUnit * 2}px;
      padding-right: ${theme.gridUnit}px;
      padding-bottom: ${theme.gridUnit * 3}px;
      padding-left: ${theme.gridUnit * 3}px;
      width: 270px;
    }

    // extra selector specificity:
    &.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
      min-width: ${FILTER_WIDTH}px;
      margin: 0 ${theme.gridUnit * 2}px 0 0;
      padding: ${theme.gridUnit}px
        ${theme.gridUnit * 2}px;
      &:hover,
      &-active {
        color: ${theme.colors.grayscale.dark1};
        border-radius: ${theme.borderRadius}px;
        background-color: ${theme.colors.secondary.light4};

        .ant-tabs-tab-remove > span {
          color: ${theme.colors.grayscale.base};
          transition: all 0.3s;
        }
      }
    }

    .ant-tabs-tab-btn {
      text-align: left;
      justify-content: space-between;
      text-transform: unset;
    }

    .ant-tabs-nav-more {
      display: none;
    }

    .ant-tabs-extra-content {
      width: 100%;
    }
  `}
`;

const StyledHeader = styled.div`
  ${({ theme }) => `
    color: ${theme.colors.grayscale.dark1};
    font-size: ${theme.typography.sizes.l}px;
    padding-top: ${theme.gridUnit * 4}px;
    padding-right: ${theme.gridUnit * 4}px;
    padding-left: ${theme.gridUnit * 4}px;
  `}
`;

type FilterTabsProps = {
  onChange: (activeKey: string) => void;
  getFilterTitle: (id: string) => string;
  currentFilterId: string;
  onEdit: (filterId: string, action: 'add' | 'remove') => void;
  filterIds: string[];
  erroredFilters: string[];
  removedFilters: Record<string, FilterRemoval>;
  restoreFilter: Function;
  children: Function;
};

const FilterTabs: FC<FilterTabsProps> = ({
  onEdit,
  getFilterTitle,
  onChange,
  currentFilterId,
  filterIds = [],
  erroredFilters = [],
  removedFilters = [],
  restoreFilter,
  children,
}) => (
  <FilterTabsContainer
    id="native-filters-tabs"
    type="editable-card"
    tabPosition="left"
    onChange={onChange}
    activeKey={currentFilterId}
    onEdit={onEdit}
    hideAdd
    tabBarExtraContent={{
      left: <StyledHeader>{t('Filters')}</StyledHeader>,
      right: (
        <StyledAddFilterBox
          onClick={() => {
            onEdit('', 'add');
            setTimeout(() => {
              const element = document.getElementById('native-filters-tabs');
              if (element) {
                const navList = element.getElementsByClassName(
                  'ant-tabs-nav-list',
                )[0];
                navList.scrollTop = navList.scrollHeight;
              }
            }, 0);
          }}
        >
          <PlusOutlined />{' '}
          <span data-test="add-filter-button" aria-label="Add filter">
            {t('Add filter')}
          </span>
        </StyledAddFilterBox>
      ),
    }}
  >
    {filterIds.map(id => {
      const showErroredFilter = erroredFilters.includes(id);
      const filterName = getFilterTitle(id);
      return (
        <LineEditableTabs.TabPane
          tab={
            <FilterTabTitle
              className={
                removedFilters[id]
                  ? 'removed'
                  : showErroredFilter
                  ? 'errored'
                  : ''
              }
            >
              <StyledFilterTitle>
                {removedFilters[id] ? t('(Removed)') : filterName}
              </StyledFilterTitle>
              {!removedFilters[id] && showErroredFilter && <StyledWarning />}
              {removedFilters[id] && (
                <StyledSpan
                  role="button"
                  data-test="undo-button"
                  tabIndex={0}
                  onClick={() => restoreFilter(id)}
                >
                  {t('Undo?')}
                </StyledSpan>
              )}
            </FilterTabTitle>
          }
          key={id}
          closeIcon={removedFilters[id] ? <></> : <StyledTrashIcon />}
        >
          {
            // @ts-ignore
            children(id)
          }
        </LineEditableTabs.TabPane>
      );
    })}
  </FilterTabsContainer>
);

export default FilterTabs;
