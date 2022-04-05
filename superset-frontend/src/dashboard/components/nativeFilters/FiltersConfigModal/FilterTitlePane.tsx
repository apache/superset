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
import React, { useRef } from 'react';
import { NativeFilterType, styled, t, useTheme } from '@superset-ui/core';
import { AntdDropdown } from 'src/components';
import { MainNav as Menu } from 'src/components/Menu';
import FilterTitleContainer from './FilterTitleContainer';
import { FilterRemoval } from './types';

interface Props {
  restoreFilter: (id: string) => void;
  getFilterTitle: (id: string) => string;
  onRearrange: (dragIndex: number, targetIndex: number) => void;
  onRemove: (id: string) => void;
  onChange: (id: string) => void;
  onAdd: (type: NativeFilterType) => void;
  removedFilters: Record<string, FilterRemoval>;
  currentFilterId: string;
  filters: string[];
  erroredFilters: string[];
}

const StyledAddBox = styled.div`
  ${({ theme }) => `
  cursor: pointer;
  margin: ${theme.gridUnit * 4}px;
  color: ${theme.colors.primary.base};
  &:hover {
    color: ${theme.colors.primary.dark1};
  }
`}
`;
const TabsContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const options = [
  { label: 'Filter', type: NativeFilterType.NATIVE_FILTER },
  { label: 'Divider', type: NativeFilterType.DIVIDER },
];

const FilterTitlePane: React.FC<Props> = ({
  getFilterTitle,
  onChange,
  onAdd,
  onRemove,
  onRearrange,
  restoreFilter,
  currentFilterId,
  filters,
  removedFilters,
  erroredFilters,
}) => {
  const filtersContainerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const handleOnAdd = (type: NativeFilterType) => {
    onAdd(type);
    setTimeout(() => {
      const element = document.getElementById('native-filters-tabs');
      if (element) {
        const navList = element.getElementsByClassName('ant-tabs-nav-list')[0];
        navList.scrollTop = navList.scrollHeight;
      }

      filtersContainerRef?.current?.scroll?.({
        top: filtersContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 0);
  };
  const menu = (
    <Menu mode="horizontal">
      {options.map(item => (
        <Menu.Item onClick={() => handleOnAdd(item.type)}>
          {item.label}
        </Menu.Item>
      ))}
    </Menu>
  );
  return (
    <TabsContainer>
      <AntdDropdown
        overlay={menu}
        arrow
        placement="topLeft"
        trigger={['hover']}
      >
        <StyledAddBox>
          <div data-test="new-dropdown-icon" className="fa fa-plus" />{' '}
          <span>{t('Add filters and dividers')}</span>
        </StyledAddBox>
      </AntdDropdown>
      <div
        css={{
          height: '100%',
          overflowY: 'auto',
          marginLeft: theme.gridUnit * 3,
        }}
      >
        <FilterTitleContainer
          ref={filtersContainerRef}
          filters={filters}
          currentFilterId={currentFilterId}
          removedFilters={removedFilters}
          getFilterTitle={getFilterTitle}
          erroredFilters={erroredFilters}
          onChange={onChange}
          onRemove={onRemove}
          onRearrange={onRearrange}
          restoreFilter={restoreFilter}
        />
      </div>
    </TabsContainer>
  );
};

export default FilterTitlePane;
