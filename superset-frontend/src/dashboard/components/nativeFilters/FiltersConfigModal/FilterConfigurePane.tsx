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
import { NativeFilterType, styled } from '@superset-ui/core';
import React from 'react';
import FilterTitlePane from './FilterTitlePane';
import { FilterRemoval } from './types';

interface Props {
  children: (filterId: string) => React.ReactNode;
  getFilterTitle: (filterId: string) => string;
  onChange: (activeKey: string) => void;
  onAdd: (type: NativeFilterType) => void;
  onRemove: (id: string) => void;
  onRearrange: (dragIndex: number, targetIndex: number) => void;
  erroredFilters: string[];
  restoreFilter: (id: string) => void;
  currentFilterId: string;
  filters: string[];
  removedFilters: Record<string, FilterRemoval>;
}

const Container = styled.div`
  display: flex;
  height: 100%;
`;

const ContentHolder = styled.div`
  flex-grow: 3;
  margin-left: ${({ theme }) => theme.gridUnit * -1 - 1};
`;

const TitlesContainer = styled.div`
  width: 270px;
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
`;

const FilterConfigurePane: React.FC<Props> = ({
  getFilterTitle,
  onChange,
  onRemove,
  onRearrange,
  restoreFilter,
  onAdd,
  erroredFilters,
  children,
  currentFilterId,
  filters,
  removedFilters,
}) => {
  const active = filters.filter(id => id === currentFilterId)[0];
  return (
    <Container>
      <TitlesContainer>
        <FilterTitlePane
          currentFilterId={currentFilterId}
          filters={filters}
          removedFilters={removedFilters}
          erroredFilters={erroredFilters}
          getFilterTitle={getFilterTitle}
          onChange={onChange}
          onAdd={(type: NativeFilterType) => onAdd(type)}
          onRearrange={onRearrange}
          onRemove={(id: string) => onRemove(id)}
          restoreFilter={restoreFilter}
        />
      </TitlesContainer>
      <ContentHolder>
        {filters.map(id => (
          <div
            key={id}
            style={{
              height: '100%',
              overflowY: 'auto',
              display: id === active ? '' : 'none',
            }}
          >
            {children(id)}
          </div>
        ))}
      </ContentHolder>
    </Container>
  );
};

export default FilterConfigurePane;
