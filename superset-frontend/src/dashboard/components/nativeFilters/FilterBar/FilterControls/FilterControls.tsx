import React, { FC, useMemo, useState } from 'react';
import { DataMaskUnit } from 'src/dataMask/types';
import { DataMask, styled } from '@superset-ui/core';
import CascadePopover from '../CascadeFilters/CascadePopover';
import { buildCascadeFiltersTree } from './utils';
import { useFilters } from '../state';
import { Filter } from '../../types';

const Wrapper = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  &:hover {
    cursor: pointer;
  }
`;

type FilterControlsProps = {
  directPathToChild?: string[];
  dataMaskSelected: DataMaskUnit;
  onFilterSelectionChange: (filter: Filter, dataMask: DataMask) => void;
};

const FilterControls: FC<FilterControlsProps> = ({
  directPathToChild,
  dataMaskSelected,
  onFilterSelectionChange,
}) => {
  const [visiblePopoverId, setVisiblePopoverId] = useState<string | null>(null);
  const filters = useFilters();
  const filterValues = Object.values<Filter>(filters);

  const cascadeFilters = useMemo(() => {
    const filtersWithValue = filterValues.map(filter => ({
      ...filter,
      currentValue: dataMaskSelected[filter.id]?.currentState?.value,
    }));
    return buildCascadeFiltersTree(filtersWithValue);
  }, [filterValues, dataMaskSelected]);

  return (
    <Wrapper>
      {cascadeFilters.map(filter => (
        <CascadePopover
          data-test="cascade-filters-control"
          key={filter.id}
          visible={visiblePopoverId === filter.id}
          onVisibleChange={visible =>
            setVisiblePopoverId(visible ? filter.id : null)
          }
          filter={filter}
          onFilterSelectionChange={onFilterSelectionChange}
          directPathToChild={directPathToChild}
        />
      ))}
    </Wrapper>
  );
};

export default FilterControls;
