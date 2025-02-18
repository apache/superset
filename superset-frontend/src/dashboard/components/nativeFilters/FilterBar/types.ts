// DODO was here

import { ReactNode } from 'react';
import {
  DataMask,
  DataMaskStateWithId,
  Divider,
  Filter,
} from '@superset-ui/core';
import { FilterBarOrientation } from 'src/dashboard/types';

interface CommonFiltersBarProps {
  actions: ReactNode;
  canEdit: boolean;
  dataMaskSelected: DataMaskStateWithId;
  filterValues: (Filter | Divider)[];
  isInitialized: boolean;
  onSelectionChange: (
    filter: Pick<Filter, 'id'> & Partial<Filter>,
    dataMask: Partial<DataMask>,
  ) => void;
}

interface VerticalBarConfig {
  filtersOpen: boolean;
  height: number | string;
  offset: number;
  toggleFiltersBar: any;
  width: number;
}

export interface FiltersBarProps {
  hidden?: boolean;
  orientation: FilterBarOrientation;
  verticalConfig?: VerticalBarConfig;
}

export type HorizontalBarProps = CommonFiltersBarProps & {
  dashboardId: number;
};

export type VerticalBarProps = Omit<FiltersBarProps, 'orientation'> &
  CommonFiltersBarProps &
  VerticalBarConfig & {
    isDisabled: boolean; // DODO added 44211751
  };

export enum TabIds {
  AllFilters = 'allFilters',
  FilterSets = 'filterSets',
}
