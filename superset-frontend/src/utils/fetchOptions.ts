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

import { SupersetClient, t } from '@superset-ui/core';
import rison from 'rison';
import { Dispatch, SetStateAction } from 'react';

interface FetchPaginatedOptions {
  endpoint: string;
  pageSize?: number;
  setData: (data: any[]) => void;
  setLoadingState: Dispatch<SetStateAction<any>>;
  filters?: SupersetFilter[];
  loadingKey: string;
  addDangerToast: (message: string) => void;
  errorMessage?: string;
  mapResult?: (item: any) => any;
}

interface QueryObj {
  page_size: number;
  page: number;
  filters?: SupersetFilter[];
}

interface SupersetFilter {
  col: string;
  opr: string;
  value: string | number | (string | number)[];
}

export const fetchPaginatedData = async ({
  endpoint,
  pageSize = 100,
  setData,
  filters,
  setLoadingState,
  loadingKey,
  addDangerToast,
  errorMessage = 'Error while fetching data',
  mapResult = (item: any) => item,
}: FetchPaginatedOptions) => {
  try {
    const fetchPage = async (pageIndex: number) => {
      const queryObj: QueryObj = {
        page_size: pageSize,
        page: pageIndex,
      };
      if (filters) {
        queryObj.filters = filters;
      }
      const encodedQuery = rison.encode(queryObj);

      const response = await SupersetClient.get({
        endpoint: `${endpoint}?q=${encodedQuery}`,
      });

      return {
        count: response.json.count,
        results: response.json.result.map(mapResult),
      };
    };

    const initialResponse = await fetchPage(0);
    const totalItems = initialResponse.count;
    const firstPageResults = initialResponse.results;

    if (pageSize >= totalItems) {
      setData(firstPageResults);
      return;
    }

    const totalPages = Math.ceil(totalItems / pageSize);

    const requests = Array.from({ length: totalPages - 1 }, (_, i) =>
      fetchPage(i + 1),
    );
    const remainingResults = await Promise.all(requests);

    setData([
      ...firstPageResults,
      ...remainingResults.flatMap(res => res.results),
    ]);
  } catch (err) {
    addDangerToast(t(errorMessage));
  } finally {
    setLoadingState((prev: boolean | Record<string, boolean>) => {
      if (typeof prev === 'boolean') {
        return false;
      }
      return {
        ...prev,
        [loadingKey]: false,
      };
    });
  }
};
