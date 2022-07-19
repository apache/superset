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
import { Dataset } from '@superset-ui/chart-controls';

export enum DatasourcesActionType {
  INIT_DATASOURCES = 'INIT_DATASOURCES',
  SET_DATASOURCE = 'SET_DATASOURCE',
  SET_DATASOURCES = 'SET_DATASOURCES',
}

export type DatasourcesAction =
  | {
      type: DatasourcesActionType.INIT_DATASOURCES;
      datasources: { [key: string]: Dataset };
    }
  | {
      type: DatasourcesActionType.SET_DATASOURCES;
      datasources: Dataset[] | null;
    }
  | {
      type: DatasourcesActionType.SET_DATASOURCE;
      datasource: Dataset;
    };

export function initDatasources(datasources: { [key: string]: Dataset }) {
  return { type: DatasourcesActionType.INIT_DATASOURCES, datasources };
}

export function setDatasource(datasource: Dataset) {
  return { type: DatasourcesActionType.SET_DATASOURCE, datasource };
}

export function setDatasources(datasources: Dataset[] | null) {
  return {
    type: DatasourcesActionType.SET_DATASOURCES,
    datasources,
  };
}
