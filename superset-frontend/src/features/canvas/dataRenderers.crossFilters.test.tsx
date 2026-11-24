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
import fetchMock from 'fetch-mock';
import type { ComponentType } from 'react';
import type { CanvasRendererProps } from 'src/core/canvas/types';
import { render, screen } from 'spec/helpers/testing-library';
import { MetricTileRenderer, TableRenderer } from './dataRenderers';

const endpoint = 'glob:*/api/v1/canvas/7/placement/sales/data';

const widget = {
  canvasId: 7,
  nodeId: 'sales',
  props: { dataBinding: { datasetId: 13, metrics: ['revenue'] } },
  filters: [
    {
      filterNodeId: 'region-filter',
      value: { datasetId: 13, column: 'region', values: ['EMEA'] },
    },
  ],
  crossFilters: [
    {
      filterNodeId: 'country-chart',
      value: { datasetId: 13, column: 'country', values: ['France'] },
    },
  ],
  customizations: [],
  colors: { labelColors: {} },
  refreshKey: 0,
} as unknown as CanvasRendererProps;

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test.each<[string, ComponentType<CanvasRendererProps>]>([
  ['metric tile', MetricTileRenderer],
  ['table', TableRenderer],
])(
  'a %s queries with the cross-filters that reach it, as well as the filters',
  async (_name, Renderer) => {
    fetchMock.post(endpoint, {
      result: { datasets: [{ inline_data: [{ revenue: 3 }] }] },
    });

    render(<Renderer {...widget} />, { useRedux: true });

    expect(await screen.findByText('3')).toBeInTheDocument();
    const call = fetchMock.callHistory.lastCall(endpoint);
    expect(JSON.parse(call?.options.body as string)).toEqual({
      runtime_filters: [
        { datasetId: 13, column: 'region', values: ['EMEA'] },
        { datasetId: 13, column: 'country', values: ['France'] },
      ],
    });
  },
);
