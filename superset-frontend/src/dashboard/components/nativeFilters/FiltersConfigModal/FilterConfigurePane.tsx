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
  border-left: 1px solid ${({ theme }) => theme.colors.grayscale.light3};
  margin-left: ${({ theme }) => theme.gridUnit * -1 - 1};
  padding: 0px ${({ theme }) => theme.gridUnit}px;
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
      <div css={{ flexGrow: 1 }}>
        <FilterTitlePane
          currentFilterId={currentFilterId}
          getFilterTitle={getFilterTitle}
          onRearrage={onRearrange}
          onRemove={(id: string) => curry(onEdit)(id)('remove')}
          removedFilters={removedFilters}
          restoreFilter={restoreFilter}
          onChange={onChange}
          onEdit={onEdit}
          filterGroups={filterGroups}
        />
      </div>
      <ContentHolder>
        <div
          style={{
            height: '100%',
            overflowY: 'scroll',
          }}
        >
          {children(active)}
        </div>
      </ContentHolder>
    </Container>
  );
};

export default FiltureConfigurePane;
