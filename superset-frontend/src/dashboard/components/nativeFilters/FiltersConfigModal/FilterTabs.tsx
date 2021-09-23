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
import { curry } from 'lodash/fp';
import React, { FC } from 'react';
import Icons from 'src/components/Icons';
import { LineEditableTabs } from 'src/components/Tabs';
import { DraggableFilter } from './DraggableFilter';
import { FilterRemoval } from './types';

export const FILTER_WIDTH = 180;

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
      width: 270px;
      padding-top: ${theme.gridUnit * 2}px;
      padding-right: ${theme.gridUnit}px;
      padding-bottom: ${theme.gridUnit * 3}px;
      padding-left: ${theme.gridUnit * 3}px;
    }

    // extra selector specificity:
    &.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
      margin: 0;
      padding: 0;
      &-active {
        color: ${theme.colors.grayscale.dark1};
        margin-bottom: ${theme.gridUnit / 2}px;
        background-color: ${theme.colors.secondary.light4};

        .ant-tabs-tab-remove > span {
          color: ${theme.colors.grayscale.base};
          transition: all 0.3s;
        }
        .anticon {
          color: ${theme.colors.grayscale.base};
        }
        :hover{
          span {
            color: ${theme.colors.grayscale.base} !important;
          }
        }
      }
    }

    .ant-tabs-tab-btn {
      text-align: left;
      justify-content: space-between;
      text-transform: unset;
      padding-left: 0;
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
  removedFilters: Record<string, FilterRemoval>;
  restoreFilter: (id: string) => void;
  children: Function;
  onRearrage: (itemId: string, targetIndex: number) => void;
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
  onRearrage,
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
    {filterIds.map((id, index) => (
      <LineEditableTabs.TabPane
        tab={
          <FilterTabTitle
            id={id}
            index={index}
            isRemoved={!!removedFilters[id]}
            restoreFilter={restoreFilter}
            getFilterTitle={getFilterTitle}
            onRearrage={onRearrage}
            onRemove={(id: string) => curry(onEdit)(id)('remove')}
          />
        }
        key={id}
        closable={false}
      >
        {
          /* @ts-ignore */
          children(id)
        }
      </LineEditableTabs.TabPane>
    ))}
  </FilterTabsContainer>
);

export default FilterTabs;
