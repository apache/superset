import { styled } from '@superset-ui/core';
import { curry } from 'lodash';
import React from 'react';
import FilterTitlePane from './FilterTitlePane';
import { FilterRemoval } from './types';

interface Props {
  onEdit: (filterId: string, action: 'add' | 'remove') => void;
  getFilterTitle: (filterId: string) => string;
  onChange: (activeKey: string) => void;
  currentFilterId: string;
  filterIds: string[];
  removedFilters: Record<string, FilterRemoval>;
  restoreFilter: (id: string) => void;
  children: (filterId: string) => React.ReactNode;
  onRearrange: (filterId: string, targetIndex: number) => void;
  filterHierarchy: Array<{ id: string; parentId: string | null }>;
}

const Container = styled.div`
  display: flex;
  height: 100%;
`;
const ContentHolder = styled.div`
  flex-grow: 3;
  border-left: 1px solid ${({ theme }) => theme.colors.grayscale.light3};
  margin-left: ${({ theme }) => theme.gridUnit * -1 - 1};
  padding: 0px ${({ theme }) => theme.gridUnit}px;
`;

const FiltureConfigurePane: React.FC<Props> = ({
  onEdit,
  removedFilters,
  getFilterTitle,
  onRearrange,
  onChange,
  filterIds,
  children,
  currentFilterId,
  filterHierarchy,
}) => (
  <Container>
    <div css={{ flexGrow: 1 }}>
      <FilterTitlePane
        currentFilterId={currentFilterId}
        filterIds={filterIds}
        getFilterTitle={getFilterTitle}
        onRearrage={onRearrange}
        onRemove={(id: string) => curry(onEdit)(id)('remove')}
        removedFilters={removedFilters}
        restoreFilter={getFilterTitle}
        onChange={onChange}
        onEdit={onEdit}
        filterHierarchy={filterHierarchy}
      />
    </div>
    <ContentHolder>
      {filterIds.filter(id => id === currentFilterId).map(id => children(id))}
    </ContentHolder>
  </Container>
);

export default FiltureConfigurePane;
