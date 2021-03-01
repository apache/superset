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
import { AdhocFilter } from '@superset-ui/core';
import {
  BaseControlConfig,
  ColumnMeta,
  Metric,
} from '@superset-ui/chart-controls';
import { DatasourcePanelDndItem } from '../../DatasourcePanel/types';

export const GroupByItemType = 'groupByItem';
export const FilterItemType = 'filterItemType';
export type Type = typeof GroupByItemType | typeof FilterItemType;

export interface OptionProps {
  children: ReactNode;
  index: number;
  clickClose: (index: number) => void;
  onShiftOptions: (dragIndex: number, hoverIndex: number) => void;
  type: Type;
  withCaret?: boolean;
}

export interface OptionItemInterface {
  type: Type;
  dragIndex: number;
}

export interface LabelProps extends BaseControlConfig {
  name: string;
  value: string[] | string | null;
  onChange: (value: string[] | string | null) => void;
  options: { string: ColumnMeta };
}

export interface DndColumnSelectProps extends LabelProps {
  onDrop: (item: DatasourcePanelDndItem) => void;
  canDrop: (item: DatasourcePanelDndItem) => boolean;
  valuesRenderer: () => ReactNode;
}

export interface DndFilterSelectProps {
  name: string;
  value: (Record<string, any> | AdhocFilter)[];
  columns: ColumnMeta[];
  datasource: Record<string, any>;
  formData: Record<string, any>;
  savedMetrics: Metric[];
  onChange: (filters: (Record<string, any> | AdhocFilter)[]) => void;
  options: { string: ColumnMeta };
  type: Type;
}

export type OptionSortType = {
  label: string;
  saved_metric_name: string;
  column_name: string;
};
