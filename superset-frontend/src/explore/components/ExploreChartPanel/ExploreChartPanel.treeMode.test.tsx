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
import { configureStore } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import { JsonObject, DataMask, VizType, QueryMode } from '@superset-ui/core';
import { act, render } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { chart } from 'src/components/Chart/chartReducer';
import { updateDataMask } from 'src/dataMask/actions';
import { registerChartStateConverter } from 'src/dashboard/util/chartStateConverter';
import { convertAgGridStateToOwnState } from '../../../../plugins/plugin-chart-ag-grid-table/src/stateConversion';
import buildTreeQuery from '../../../../plugins/plugin-chart-ag-grid-table/src/TreeTable/buildQuery';
import buildTableQuery from '../../../../plugins/plugin-chart-ag-grid-table/src/buildQuery';
import ExploreChartPanel, { ExploreChartPanelProps } from './index';

const treeFormData = {
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
  datasource: '1__table',
  row_limit: 1000,
  levels: [
    {
      key: 'parent',
      name: 'Parent',
      id_column: 'parent',
      columns: ['value'],
      detail_fields: [],
    },
  ],
};

let captured: {
  ownState?: JsonObject;
  onChartStateChange?: (state: JsonObject) => void;
} = {};
jest.mock('src/components/Chart/ChartContainer', () => ({
  __esModule: true,
  default: (props: typeof captured) => {
    captured = props;
    return <div data-test="chart-container" />;
  },
}));
jest.mock('./useResizeDetectorByObserver', () => ({
  __esModule: true,
  default: () => ({ ref: jest.fn(), width: 800, height: 400 }),
}));

test.each([QueryMode.Aggregate, QueryMode.Raw])(
  'Explore clears permalink state before Tree paging and sorting and preserves %s queries',
  mode => {
    registerChartStateConverter(
      VizType.TableAgGrid,
      convertAgGridStateToOwnState,
    );
    const stale = {
      serverPagination: true,
      pageSize: 100,
      currentPage: 2,
      sortModel: [{ colId: 'parent', sort: 'desc' }],
    };
    const store = configureStore({
      reducer: reducerIndex,
      preloadedState: {
        explore: {
          controls: {},
          form_data: treeFormData,
          chartStates: { 1: { state: stale } },
        },
      } as never,
      middleware: getDefaultMiddleware =>
        getDefaultMiddleware({
          serializableCheck: false,
          immutableCheck: false,
        }),
    });
    function Harness() {
      const ownState = useSelector(
        (state: { dataMask: Record<string, DataMask> }) =>
          state.dataMask[1]?.ownState,
      );
      return (
        <ExploreChartPanel
          can_overwrite={false}
          can_download={false}
          containerId="tree-state-proof"
          isStarred={false}
          vizType={VizType.TableAgGrid}
          datasource={
            {
              type: 'table',
              columns: [],
              metrics: [],
              verbose_map: {},
            } as unknown as ExploreChartPanelProps['datasource']
          }
          form_data={treeFormData}
          ownState={ownState}
          chart={{ ...chart, id: 1, latestQueryFormData: treeFormData }}
          actions={{
            setForceQuery: jest.fn(),
            postChartFormData: jest.fn(),
            updateQueryFormData: jest.fn(),
            setControlValue: jest.fn(),
          }}
        />
      );
    }
    render(<Harness />, { store });
    expect(captured.ownState?.pageSize).toBe(100);
    expect(captured.ownState?.chartState).toEqual(stale);
    act(() => {
      captured.onChartStateChange?.({});
    });
    expect(store.getState().explore.chartStates?.[1].state).toEqual({});
    act(() => {
      store.dispatch(
        updateDataMask(1, {
          ownState: {
            pageSize: 20,
            currentPage: 0,
            sortBy: [{ id: 'value', key: 'value', desc: true }],
          },
        }),
      );
    });
    const query = buildTreeQuery(treeFormData, { ownState: captured.ownState })
      .queries[0];
    expect(query.row_limit).toBe(20);
    expect(query.orderby?.[0]).toEqual(['value', false]);
    const form = {
      datasource: '1__table',
      viz_type: VizType.TableAgGrid,
      query_mode: mode,
      groupby: ['parent'],
      metrics: ['count'],
      all_columns: ['value'],
    };
    expect(buildTableQuery(form).queries).toEqual(
      buildTableQuery({ ...form, levels: treeFormData.levels }).queries,
    );
  },
);
