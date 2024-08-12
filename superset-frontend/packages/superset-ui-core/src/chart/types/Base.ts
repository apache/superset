/*
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

import { BinaryQueryObjectFilterClause, ExtraFormData } from '../../query';
import { JsonObject } from '../..';

export type HandlerFunction = (...args: unknown[]) => void;

export enum Behavior {
  InteractiveChart = 'INTERACTIVE_CHART',
  NativeFilter = 'NATIVE_FILTER',

  /**
   * Include `DRILL_TO_DETAIL` behavior if plugin handles `contextmenu` event
   * when dimensions are right-clicked on.
   */
  DrillToDetail = 'DRILL_TO_DETAIL',
  DrillBy = 'DRILL_BY',
}

export interface ContextMenuFilters {
  crossFilter?: {
    dataMask: DataMask;
    isCurrentValueSelected?: boolean;
  };
  drillToDetail?: BinaryQueryObjectFilterClause[];
  drillBy?: {
    filters: BinaryQueryObjectFilterClause[];
    groupbyFieldName: string;
    adhocFilterFieldName?: string;
  };
}

export enum AppSection {
  Explore = 'EXPLORE',
  Dashboard = 'DASHBOARD',
  FilterBar = 'FILTER_BAR',
  FilterConfigModal = 'FILTER_CONFIG_MODAL',
  Embedded = 'EMBEDDED',
}

export type FilterState = { value?: any; [key: string]: any };

export type DataMask = {
  extraFormData?: ExtraFormData;
  filterState?: FilterState;
  ownState?: JsonObject;
};

export type SetDataMaskHook = {
  ({ filterState, extraFormData, ownState }: DataMask): void;
};

export interface PlainObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export enum ChartLabel {
  Deprecated = 'DEPRECATED',
  Featured = 'FEATURED',
}

export const chartLabelExplanations: Record<ChartLabel, string> = {
  [ChartLabel.Deprecated]:
    'This chart uses features or modules which are no longer actively maintained. It will eventually be replaced or removed.',
  [ChartLabel.Featured]:
    'This chart was tested and verified, so the overall experience should be stable.',
};

export const chartLabelWeight: Record<ChartLabel, { weight: number }> = {
  [ChartLabel.Deprecated]: {
    weight: -0.1,
  },
  [ChartLabel.Featured]: {
    weight: 0.1,
  },
};

export enum AxisType {
  Category = 'category',
  Value = 'value',
  Time = 'time',
  Log = 'log',
}

export interface LegendState {
  [key: string]: boolean;
}

export default {};
