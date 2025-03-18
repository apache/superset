// DODO was here
import { ReactNode } from 'react';
import { styled } from '@superset-ui/core';
import { SELECT_WIDTH } from 'src/components/ListView/utils';

export interface BaseFilter {
  Header: ReactNode;
  initialValue: any;
}

export const FilterContainer = styled.div<{ width?: number }>`
  display: inline-flex;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  align-items: center;
  width: ${({ width }) => width || SELECT_WIDTH}px; // DODO changed 44211759
`;

export type FilterHandler = {
  clearFilter: () => void;
};
