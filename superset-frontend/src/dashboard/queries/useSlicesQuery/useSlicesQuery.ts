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
import { useQuery } from '@tanstack/react-query';
import { DatasourceType, SupersetClient } from '@superset-ui/core';
import { queryClient } from 'src/queries/queryClient';
import type { Slice } from 'src/dashboard/types';
import { sliceKeys, type SlicesListParams } from '../keys';

const FETCH_SLICES_PAGE_SIZE = 200;
const SLICES_STALE_TIME = 2 * 60 * 1000;

export function getDatasourceParameter(
  datasourceId: number,
  datasourceType: DatasourceType,
) {
  return `${datasourceId}__${datasourceType}`;
}

type RawSlice = {
  id: number;
  params: string;
  url: string;
  slice_name: string;
  datasource_id: number;
  datasource_type: DatasourceType;
  datasource_name_text: string;
  datasource_url: string;
  changed_on_utc: string;
  changed_on_delta_humanized: string;
  description: string;
  description_markeddown: string;
  viz_type: string;
  thumbnail_url: string;
  editors: { id: number }[];
  created_by: { id: number };
};

/** Maps the raw `/api/v1/chart/` rows into the dashboard `Slice` shape. */
export function parseSlicesResult(result: RawSlice[]): Record<number, Slice> {
  return result.reduce<Record<number, Slice>>((slices, slice) => {
    const params = JSON.parse(slice.params);
    const formData = {
      ...params,
      // force using datasource stored in relational table prop
      datasource:
        getDatasourceParameter(slice.datasource_id, slice.datasource_type) ||
        params.datasource,
    };
    slices[slice.id] = {
      slice_id: slice.id,
      slice_url: slice.url,
      slice_name: slice.slice_name,
      form_data: formData,
      datasource_name: slice.datasource_name_text,
      datasource_url: slice.datasource_url,
      datasource_id: slice.datasource_id,
      datasource_type: slice.datasource_type,
      changed_on: new Date(slice.changed_on_utc).getTime(),
      description: slice.description,
      description_markdown: slice.description_markeddown,
      viz_type: slice.viz_type,
      modified: slice.changed_on_delta_humanized,
      changed_on_humanized: slice.changed_on_delta_humanized,
      thumbnail_url: slice.thumbnail_url,
      editors: slice.editors,
      created_by: slice.created_by,
    };
    return slices;
  }, {});
}

async function fetchSlices({
  userId,
  filterValue,
  sortColumn = 'changed_on',
}: SlicesListParams): Promise<Record<number, Slice>> {
  const filters: { col: string; opr: string; value: string | number }[] =
    filterValue
      ? [{ col: 'slice_name', opr: 'chart_all_text', value: filterValue }]
      : [];
  if (userId) {
    filters.push({ col: 'id', opr: 'is_editable', value: 1 });
  }

  const response = await SupersetClient.get({
    endpoint: `/api/v1/chart/?q=${rison.encode({
      columns: [
        'changed_on_delta_humanized',
        'changed_on_utc',
        'datasource_id',
        'datasource_type',
        'datasource_url',
        'datasource_name_text',
        'description_markeddown',
        'description',
        'id',
        'params',
        'slice_name',
        'thumbnail_url',
        'url',
        'viz_type',
        'editors.id',
        'created_by.id',
      ],
      filters,
      page_size: FETCH_SLICES_PAGE_SIZE,
      order_column:
        sortColumn === 'changed_on' ? 'changed_on_delta_humanized' : sortColumn,
      order_direction: sortColumn === 'changed_on' ? 'desc' : 'asc',
    })}`,
  });
  return parseSlicesResult(response.json.result as RawSlice[]);
}

/**
 * Fetches the user's saved charts for the dashboard "add chart" panel.
 * Replaces the Redux `fetchSlices` thunk / `sliceEntities` reducer.
 */
export function useSlicesQuery(params: SlicesListParams) {
  return useQuery({
    queryKey: sliceKeys.list(params),
    queryFn: () => fetchSlices(params),
    staleTime: SLICES_STALE_TIME,
  });
}

/**
 * Looks up a slice by id across every cached `useSlicesQuery` result, for when a
 * chart is dragged from the "add chart" panel (its metadata lives in this cache).
 */
export function getCachedSlice(sliceId: number): Slice | undefined {
  const entries = queryClient.getQueriesData<Record<number, Slice>>({
    queryKey: sliceKeys.all,
  });
  for (let i = 0; i < entries.length; i += 1) {
    const [, data] = entries[i];
    if (data?.[sliceId]) {
      return data[sliceId];
    }
  }
  return undefined;
}
