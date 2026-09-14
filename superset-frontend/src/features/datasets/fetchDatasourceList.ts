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
import rison from 'rison';
import {
  FeatureFlag,
  isFeatureEnabled,
  JsonResponse,
  SupersetClient,
} from '@superset-ui/core';
import { Dataset } from './DatasetSelectLabel';

/** Columns requested from the dataset-only endpoint. */
const DATASET_LIST_COLUMNS = [
  'id',
  'table_name',
  'datasource_type',
  'database.database_name',
  'schema',
];

export type DatasourceListPage = {
  result: Dataset[];
  count: number;
};

export type FetchDatasourceListOptions = {
  /** Transport to use; pass a cached variant to share responses. */
  get?: typeof SupersetClient.get;
} & (
  | {
      /**
       * Match `search` against the name exactly rather than as a substring.
       * Only supported together with `datasetsOnly`: the combined datasource
       * endpoint's filter parser honours only substring (`ct`) name filters
       * and silently drops an `eq` filter, so an exact-match preload against
       * it would resolve to an arbitrary unfiltered page.
       */
      exactMatch: true;
      datasetsOnly: true;
    }
  | {
      exactMatch?: false;
      /**
       * Query the dataset-only endpoint even when semantic layers are
       * enabled. Used by callers that resolve a dataset by name and must not
       * be answered with a same-named semantic view.
       */
      datasetsOnly?: boolean;
    }
);

/**
 * Fetches one page of datasources by name, ordered by name.
 *
 * When the SEMANTIC_LAYERS feature flag is enabled the combined datasource
 * endpoint is queried and the page mixes datasets with semantic views
 * (distinguished by `kind`); otherwise only datasets are listed. Every picker
 * that offers datasources should load through here so the two endpoints stay
 * behind one contract.
 */
export const fetchDatasourceList = (
  search: string,
  page: number,
  pageSize: number,
  {
    exactMatch = false,
    datasetsOnly = false,
    get = SupersetClient.get,
  }: FetchDatasourceListOptions = {},
): Promise<DatasourceListPage> => {
  if (exactMatch && !datasetsOnly) {
    // Enforced at the type level too; this guards plain-JS callers.
    throw new Error(
      'fetchDatasourceList: exactMatch requires datasetsOnly — the combined ' +
        'datasource endpoint only supports substring name filters.',
    );
  }
  const useCombinedList =
    !datasetsOnly && isFeatureEnabled(FeatureFlag.SemanticLayers);
  const query = rison.encode({
    ...(useCombinedList ? {} : { columns: DATASET_LIST_COLUMNS }),
    filters: [
      { col: 'table_name', opr: exactMatch ? 'eq' : 'ct', value: search },
    ],
    page,
    page_size: pageSize,
    order_column: 'table_name',
    order_direction: 'asc',
  });
  const endpoint = useCombinedList
    ? `/api/v1/datasource/?q=${query}`
    : `/api/v1/dataset/?q=${query}`;
  return get({ endpoint }).then((response: JsonResponse) => ({
    result: response.json.result as Dataset[],
    count: response.json.count ?? 0,
  }));
};
