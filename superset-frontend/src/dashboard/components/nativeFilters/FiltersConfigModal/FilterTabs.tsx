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
import { LineEditableTabs } from 'src/common/components/Tabs';
import Icon from 'src/components/Icon';
import { FilterRemoval } from './types';
import { REMOVAL_DELAY_SECS } from './utils';

export const FILTER_WIDTH = 200;

export const StyledSpan = styled.span`
  cursor: pointer;
  color: ${({ theme }) => theme.colors.primary.dark1};
  &:hover {
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
`;

export const StyledFilterTitle = styled.span`
  width: ${FILTER_WIDTH}px;
  white-space: normal;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

export const StyledAddFilterBox = styled.div`
  color: ${({ theme }) => theme.colors.primary.dark1};
  text-align: left;
  padding: ${({ theme }) => theme.gridUnit * 2}px 0;
  margin: ${({ theme }) => theme.gridUnit * 3}px 0 0
    ${({ theme }) => -theme.gridUnit * 2}px;
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light1};

  &:hover {
    color: ${({ theme }) => theme.colors.primary.base};
  }
`;

export const StyledTrashIcon = styled(Icon)`
  color: ${({ theme }) => theme.colors.grayscale.light3};
`;

export const FilterTabTitle = styled.span`
  transition: color ${({ theme }) => theme.transitionTiming}s;
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;

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
`;

const FilterTabsContainer = styled(LineEditableTabs)`
  // extra selector specificity:
  &.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
    min-width: ${FILTER_WIDTH}px;
    margin: 0 ${({ theme }) => theme.gridUnit * 2}px 0 0;
    padding: ${({ theme }) => theme.gridUnit}px
      ${({ theme }) => theme.gridUnit * 2}px;

    &:hover,
    &-active {
      color: ${({ theme }) => theme.colors.grayscale.dark1};
      border-radius: ${({ theme }) => theme.borderRadius}px;
      background-color: ${({ theme }) => theme.colors.secondary.light4};

      .ant-tabs-tab-remove > svg {
        color: ${({ theme }) => theme.colors.grayscale.base};
        transition: all 0.3s;
      }
    }
  }

  .ant-tabs-tab-btn {
    text-align: left;
    justify-content: space-between;
    text-transform: unset;
  }
`;

type FilterTabsProps = {
  onChange: (activeKey: string) => void;
  getFilterTitle: (id: string) => string;
  currentFilterId: string;
  onEdit: (filterId: string, action: 'add' | 'remove') => void;
  filterIds: string[];
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
  removedFilters = [],
  restoreFilter,
  children,
}) => (
  <FilterTabsContainer
    tabPosition="left"
    onChange={onChange}
    activeKey={currentFilterId}
    onEdit={onEdit}
    addIcon={
      <StyledAddFilterBox>
        <PlusOutlined />{' '}
        <span data-test="add-filter-button">{t('Add filter')}</span>
      </StyledAddFilterBox>
    }
  >
    {filterIds.map(id => (
      <LineEditableTabs.TabPane
        tab={
          <FilterTabTitle className={removedFilters[id] ? 'removed' : ''}>
            <StyledFilterTitle>
              {removedFilters[id] ? t('(Removed)') : getFilterTitle(id)}
            </StyledFilterTitle>
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
        closeIcon={
          removedFilters[id] ? <></> : <StyledTrashIcon name="trash" />
        }
      >
        {
          // @ts-ignore
          children(id)
        }
      </LineEditableTabs.TabPane>
    ))}
  </FilterTabsContainer>
);

export default FilterTabs;
