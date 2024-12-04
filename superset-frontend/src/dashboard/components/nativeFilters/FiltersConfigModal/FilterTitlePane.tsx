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
import { useRef, FC } from 'react';

import { NativeFilterType, styled, t } from '@superset-ui/core';
import { Button } from 'src/components';
import Icons from 'src/components/Icons';
import ButtonGroup from 'src/components/ButtonGroup';

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

const TabsContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.gridUnit * 3}px;
  padding-bottom: 2px;
  /* align-items: stretch; */
`;

const FilterTitlePane: FC<Props> = ({
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
  return (
    <TabsContainer>
      <ButtonGroup expand>
        <Button
          buttonSize="default"
          buttonStyle="tertiary"
          icon={<Icons.Filter iconSize="m" />}
          onClick={() => handleOnAdd(NativeFilterType.NativeFilter)}
        >
          {t('Add Filter')}
        </Button>
        <Button
          buttonSize="default"
          buttonStyle="tertiary"
          icon={<Icons.PicCenterOutlined iconSize="m" />}
          onClick={() => handleOnAdd(NativeFilterType.Divider)}
        >
          {t('Add Divider')}
        </Button>
      </ButtonGroup>
      <div
        css={{
          height: '100%',
          overflowY: 'auto',
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
