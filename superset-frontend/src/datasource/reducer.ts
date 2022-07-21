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
import { keyBy } from 'lodash';
import { getDatasourceUid } from 'src/utils/getDatasourceUid';
import {
  DatasourcesAction,
  DatasourcesActionType,
} from 'src/datasource/actions';
import { Dataset } from '@superset-ui/chart-controls';

export default function datasourcesReducer(
  datasources: { [key: string]: Dataset } | undefined,
  action: DatasourcesAction,
) {
  if (action.type === DatasourcesActionType.INIT_DATASOURCES) {
    return { ...action.datasources };
  }
  if (action.type === DatasourcesActionType.SET_DATASOURCES) {
    return {
      ...datasources,
      ...keyBy(action.datasources, 'uid'),
    };
  }
  if (action.type === DatasourcesActionType.SET_DATASOURCE) {
    return {
      ...datasources,
      [getDatasourceUid(action.datasource)]: action.datasource,
    };
  }
  return datasources || {};
}
