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
import { ReactElement } from 'react';
import {
  Datasource,
  GenericDataType,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import { ExploreActions } from 'src/explore/actions/exploreActions';
import { ChartStatus } from 'src/explore/types';

export enum ResultTypes {
  Results = 'results',
  Samples = 'samples',
}

export interface DataTablesPaneProps {
  queryFormData: QueryFormData;
  datasource: Datasource;
  queryForce: boolean;
  ownState?: JsonObject;
  chartStatus: ChartStatus;
  onCollapseChange: (isOpen: boolean) => void;
  errorMessage?: JSX.Element;
  actions: ExploreActions;
  canDownload: boolean;
}

export interface ResultsPaneProps {
  isRequest: boolean;
  queryFormData: QueryFormData;
  queryForce: boolean;
  ownState?: JsonObject;
  errorMessage?: ReactElement;
  actions?: ExploreActions;
  dataSize?: number;
  // reload OriginalFormattedTimeColumns from localStorage when isVisible is true
  isVisible: boolean;
  canDownload: boolean;
}

export interface SamplesPaneProps {
  isRequest: boolean;
  datasource: Datasource;
  queryForce: boolean;
  actions?: ExploreActions;
  dataSize?: number;
  // reload OriginalFormattedTimeColumns from localStorage when isVisible is true
  isVisible: boolean;
  canDownload: boolean;
}

export interface TableControlsProps {
  data: Record<string, any>[];
  // {datasource.id}__{datasource.type}, eg: 1__table
  datasourceId: string;
  onInputChange: (input: string) => void;
  columnNames: string[];
  columnTypes: GenericDataType[];
  isLoading: boolean;
  rowcount: number;
  canDownload: boolean;
}

export interface QueryResultInterface {
  colnames: string[];
  coltypes: GenericDataType[];
  rowcount: number;
  data: Record<string, any>[][];
}

export interface SingleQueryResultPaneProp extends QueryResultInterface {
  // {datasource.id}__{datasource.type}, eg: 1__table
  datasourceId: string;
  dataSize?: number;
  // reload OriginalFormattedTimeColumns from localStorage when isVisible is true
  isVisible: boolean;
  canDownload: boolean;
}
