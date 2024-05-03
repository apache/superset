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
import { Column } from './Column';
import { Metric } from './Metric';

export enum DatasourceType {
  Table = 'table',
  Query = 'query',
  Dataset = 'dataset',
  SlTable = 'sl_table',
  SavedQuery = 'saved_query',
}

export interface Currency {
  symbol: string;
  symbolPosition: string;
}

/**
 * Datasource metadata.
 */
export interface Datasource {
  id: number;
  name: string;
  type: DatasourceType;
  columns: Column[];
  metrics: Metric[];
  description?: string;
  // key is column names (labels)
  columnFormats?: {
    [key: string]: string;
  };
  currencyFormats?: {
    [key: string]: Currency;
  };
  verboseMap?: {
    [key: string]: string;
  };
}

export const DEFAULT_METRICS: Metric[] = [
  {
    metric_name: 'COUNT(*)',
    expression: 'COUNT(*)',
  },
];

export default {};
