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
    isDisabled: boolean;
  };

export enum TabIds {
  AllFilters = 'allFilters',
  FilterSets = 'filterSets',
}
