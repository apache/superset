import { styled } from '@superset-ui/core';
import { curry } from 'lodash';
import React from 'react';
import FilterTitlePane from './FilterTitlePane';
import { FilterRemoval } from './types';

interface Props {
  children: (filterId: string) => React.ReactNode;
  getFilterTitle: (filterId: string) => string;
  onChange: (activeKey: string) => void;
  onEdit: (filterId: string, action: 'add' | 'remove') => void;
  onRearrange: (dragIndex: number, targetIndex: number) => void;
  restoreFilter: (id: string) => void;
  currentFilterId: string;
  filterGroups: string[][];
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
  width: 220px;
  border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
`;

const FiltureConfigurePane: React.FC<Props> = ({
  getFilterTitle,
  onChange,
  onEdit,
  onRearrange,
  restoreFilter,
  children,
  currentFilterId,
  filterGroups,
  removedFilters,
}) => {
  const active = filterGroups.flat().filter(id => id === currentFilterId)[0];
  return (
    <Container>
      <TitlesContainer>
        <FilterTitlePane
          currentFilterId={currentFilterId}
          filterGroups={filterGroups}
          getFilterTitle={getFilterTitle}
          onChange={onChange}
          onEdit={onEdit}
          onRearrage={onRearrange}
          onRemove={(id: string) => curry(onEdit)(id)('remove')}
          removedFilters={removedFilters}
          restoreFilter={restoreFilter}
        />
      </TitlesContainer>
      <ContentHolder>
        {filterGroups.flat().map(id => (
          <div
            key={id}
            style={{
              height: '100%',
              overflowY: 'scroll',
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

export default FiltureConfigurePane;
