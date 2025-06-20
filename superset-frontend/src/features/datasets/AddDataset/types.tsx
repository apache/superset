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
import { DatabaseObject } from 'src/components/DatabaseSelector';

export enum DatasetActionType {
  SelectDatabase,
  SelectCatalog,
  SelectSchema,
  SelectTable,
  ChangeDataset,
}

export interface FactDimensionObject {
  id?: number;
  dimension_table_id: number;
  fact_fk: string;
  dimension_pk: string;
}

export interface DatasetObject {
  db: DatabaseObject & { owners: [number] };
  catalog?: string | null;
  schema?: string | null;
  dataset_name: string;
  table_name?: string | null;
  table_type?: 'physical' | 'view' | 'fact' | 'dimension';
  fact_dimensions?: FactDimensionObject[];
  explore_url?: string;
}

export interface DatasetReducerPayloadType {
  name: string;
  value?: string;
}

export type Schema = {
  schema?: string | null | undefined;
};

export type DSReducerActionType =
  | {
      type: DatasetActionType.SelectDatabase;
      payload: Partial<DatasetObject>;
    }
  | {
      type:
        | DatasetActionType.ChangeDataset
        | DatasetActionType.SelectCatalog
        | DatasetActionType.SelectSchema
        | DatasetActionType.SelectTable;
      payload: DatasetReducerPayloadType;
    };
