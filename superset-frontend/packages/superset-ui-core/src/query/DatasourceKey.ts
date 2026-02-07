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

import { DatasourceType } from './types/Datasource';

const DATASOURCE_TYPE_MAP: Record<string, DatasourceType> = {
  table: DatasourceType.Table,
  query: DatasourceType.Query,
  dataset: DatasourceType.Dataset,
  sl_table: DatasourceType.SlTable,
  saved_query: DatasourceType.SavedQuery,
  semantic_view: DatasourceType.SemanticView,
};

export default class DatasourceKey {
  readonly id: number | string;

  readonly type: DatasourceType;

  constructor(key: string) {
    const [idStr, typeStr] = key.split('__');
    const isNumeric = /^\d+$/.test(idStr);
    this.id = isNumeric ? parseInt(idStr, 10) : idStr;
    this.type = DATASOURCE_TYPE_MAP[typeStr] ?? DatasourceType.Table;
  }

  public toString() {
    return `${this.id}__${this.type}`;
  }

  public toObject() {
    return {
      id: this.id,
      type: this.type,
    };
  }
}
