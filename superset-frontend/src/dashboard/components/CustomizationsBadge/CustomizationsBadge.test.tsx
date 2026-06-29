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
import { render, screen } from 'spec/helpers/testing-library';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import { ChartCustomizationPlugins } from 'src/constants';
import { useNativeFiltersStore, type FilterEntry } from 'src/dashboard/stores';
import { useDataMaskStore } from 'src/dataMask/useDataMaskStore';
import type { DataMaskStateWithId } from '@superset-ui/core';
import { CustomizationsBadge } from '.';

const customization = {
  id: 'CHART_CUSTOMIZATION-semantic',
  type: 'CHART_CUSTOMIZATION',
  filterType: ChartCustomizationPlugins.DynamicGroupBy,
  name: 'Group by',
  targets: [{ datasetId: 7, datasourceType: 'semantic_view' }],
  scope: { rootPath: [], excluded: [] },
};

// The badge reads the control entries and dataMask from the Zustand stores.
const seedStores = (filters: object, dataMask: object) => {
  useNativeFiltersStore.setState({
    filters: filters as Record<string, FilterEntry>,
  });
  useDataMaskStore.setState({ dataMask: dataMask as DataMaskStateWithId });
};

test.each(['7__semantic_view', '7__table'])(
  'hidden semantic control has no badge on %s',
  datasource => {
    seedStores(
      { [customization.id]: customization },
      { [customization.id]: { filterState: { value: ['status'] } } },
    );
    render(<CustomizationsBadge chartId={18} />, {
      useRedux: true,
      initialState: {
        ...stateWithoutNativeFilters,
        charts: {
          ...stateWithoutNativeFilters.charts,
          18: { latestQueryFormData: { datasource, viz_type: 'table' } },
        },
        nativeFilters: {
          filters: { [customization.id]: customization },
        },
        dataMask: {
          [customization.id]: { filterState: { value: ['status'] } },
        },
      },
    });
    expect(
      screen.queryByRole('button', { name: /Display controls/ }),
    ).not.toBeInTheDocument();
  },
);

test.each([
  ['7__table', true],
  ['7__semantic_view', false],
])('ordinary control matches datasource type on %s', (datasource, visible) => {
  seedStores(
    {
      [customization.id]: {
        ...customization,
        targets: [{ datasetId: 7, datasourceType: 'table' }],
      },
    },
    { [customization.id]: { filterState: { value: ['status'] } } },
  );
  render(<CustomizationsBadge chartId={18} />, {
    useRedux: true,
    initialState: {
      ...stateWithoutNativeFilters,
      charts: {
        ...stateWithoutNativeFilters.charts,
        18: { latestQueryFormData: { datasource, viz_type: 'table' } },
      },
      nativeFilters: {
        filters: {
          [customization.id]: {
            ...customization,
            targets: [{ datasetId: 7, datasourceType: 'table' }],
          },
        },
      },
      dataMask: {
        [customization.id]: { filterState: { value: ['status'] } },
      },
    },
  });
  expect(
    Boolean(screen.queryByRole('button', { name: /Display controls/ })),
  ).toBe(visible);
});
