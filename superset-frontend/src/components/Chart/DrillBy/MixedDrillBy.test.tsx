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
import { useState } from 'react';
import {
  Behavior,
  ChartMetadata,
  ChartProps,
  ContextMenuFilters,
  getChartMetadataRegistry,
  QueryFormData,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import { init, EChartsType } from 'echarts';
import type GlobalModel from 'echarts/types/src/model/Global';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import mockState from 'spec/fixtures/mockState';
import transformProps from '../../../../plugins/plugin-chart-echarts/src/MixedTimeseries/transformProps';
import MixedChart from '../../../../plugins/plugin-chart-echarts/src/MixedTimeseries/EchartsMixedTimeseries';
import buildQuery from '../../../../plugins/plugin-chart-echarts/src/MixedTimeseries/buildQuery';
import type { EchartsMixedTimeseriesProps } from '../../../../plugins/plugin-chart-echarts/src/MixedTimeseries/types';
import type { EchartsProps } from '../../../../plugins/plugin-chart-echarts/src/types';
import * as chartActions from '../chartAction';
import { DrillBySubmenu } from './DrillBySubmenu';
import DrillByModal from './DrillByModal';

const mockEchart = jest.fn<void, [EchartsProps]>();
let mockChartInstance: EChartsType;
jest.mock(
  '../../../../plugins/plugin-chart-echarts/src/components/Echart',
  () => {
    const { forwardRef, useImperativeHandle } =
      jest.requireActual<typeof import('react')>('react');
    return {
      __esModule: true,
      default: forwardRef((props: EchartsProps, ref) => {
        mockEchart(props);
        useImperativeHandle(ref, () => ({
          getEchartInstance: () => mockChartInstance,
        }));
        return null;
      }),
    };
  },
);

test.each(
  ['table', 'semantic_view'].flatMap(source =>
    [0, 1].flatMap(query =>
      [false, true].map(markerless => ({ source, query, markerless })),
    ),
  ),
)(
  'Mixed ECharts event reaches the outgoing $source query $query markerless=$markerless',
  async ({ source, query, markerless }) => {
    const formData: QueryFormData = {
      viz_type: 'mixed_timeseries',
      datasource: `7__${source}`,
      slice_id: 1,
      slice_name: 'Mixed test',
      x_axis: 'segment',
      metrics: ['amount'],
      metrics_b: ['amount'],
      groupby: [],
      groupby_b: [],
      adhoc_filters: [],
      adhoc_filters_b: [],
      seriesType: query === 0 && markerless ? 'line' : 'bar',
      seriesTypeB: query === 1 && markerless ? 'line' : 'bar',
      time_grain_sqla: undefined,
      row_limit: 1000,
      row_limit_b: 1000,
    };
    const response = {
      data: [
        { segment: '<NULL>', amount: 101 },
        { segment: 'CORP', amount: 38 },
        { segment: 'RETAIL', amount: 35.5 },
      ],
      colnames: ['segment', 'amount'],
      coltypes: [GenericDataType.String, GenericDataType.Numeric],
      label_map: { segment: ['segment'], amount: ['amount'] },
    };
    const transformed = transformProps(
      new ChartProps({
        formData,
        queriesData: [response, response],
        width: 800,
        height: 600,
        theme: supersetTheme,
        datasource: { verboseMap: {}, columnFormats: {}, currencyFormats: {} },
      }) as EchartsMixedTimeseriesProps,
    );
    const dataset = {
      table_name: 'sales',
      description: '',
      changed_on_humanized: '',
      created_on_humanized: '',
      editors: [],
      columns: [{ column_name: 'segment' }, { column_name: 'status' }],
      drillable_columns: [{ column_name: 'status' }],
    };
    getChartMetadataRegistry().registerValue(
      'mixed_timeseries',
      new ChartMetadata({
        name: 'Mixed',
        thumbnail: '',
        behaviors: [Behavior.DrillBy],
      }),
    );
    mockEchart.mockClear();
    const request = jest
      .spyOn(chartActions, 'requestChartDataResolved')
      .mockResolvedValue([]);
    function Harness() {
      const [config, setConfig] = useState<ContextMenuFilters['drillBy']>();
      const [selected, setSelected] = useState<ContextMenuFilters['drillBy']>();
      return (
        <>
          <MixedChart
            {...transformed}
            onContextMenu={(_x, _y, filters) => setConfig(filters?.drillBy)}
          />
          <DrillBySubmenu
            formData={formData}
            dataset={dataset}
            drillByConfig={config}
            onDrillBy={(_column, _dataset, next) => setSelected(next)}
          />
          {selected && (
            <DrillByModal
              formData={formData}
              dataset={dataset}
              column={dataset.columns[1]}
              drillByConfig={selected}
              onHideModal={() => {}}
              canDownload={false}
            />
          )}
        </>
      );
    }
    render(<Harness />, {
      useRedux: true,
      useRouter: true,
      useDnd: true,
      initialState: {
        ...mockState,
        dashboardLayout: {
          past: [],
          future: [],
          present: {
            chart: {
              id: 'chart',
              meta: { chartId: 1, sliceName: 'Mixed test' },
            },
          },
        },
      },
    });
    await waitFor(() => expect(mockEchart).toHaveBeenCalled());
    const handler = mockEchart.mock.lastCall![0].eventHandlers!.contextmenu;
    const chart = init(null, undefined, {
      renderer: 'svg',
      ssr: true,
      width: 800,
      height: 600,
    });
    mockChartInstance = chart;
    try {
      chart.setOption(transformed.echartOptions);
      const model = (
        chart as unknown as { getModel: () => GlobalModel }
      ).getModel();
      const pointEvent = model.getSeriesByIndex(query).getDataParams(1);
      // LineView's line/area eventData has no data, dataIndex or name.
      const event = markerless
        ? {
            componentType: 'series',
            componentSubType: 'line',
            componentIndex: query,
            seriesIndex: query,
            seriesName: pointEvent.seriesName,
            seriesType: 'line',
            selfType: 'line',
          }
        : pointEvent;
      const [offsetX, offsetY] = chart.convertToPixel(
        { seriesIndex: query },
        [1, 38],
      );
      await act(async () =>
        handler({
          ...event,
          event: {
            stop: jest.fn(),
            offsetX,
            offsetY,
            event: { clientX: 10, clientY: 10 },
          },
        }),
      );
      await userEvent.click(screen.getByRole('button', { name: /Drill by/ }));
      await userEvent.click(await screen.findByText('status', { exact: true }));
      await waitFor(() => expect(request).toHaveBeenCalled());
      const outgoing = request.mock.lastCall![0].formData;
      expect(
        outgoing[query === 0 ? 'adhoc_filters' : 'adhoc_filters_b'],
      ).toEqual([
        expect.objectContaining({
          subject: 'segment',
          operator: '==',
          comparator: 'CORP',
        }),
      ]);
      expect(outgoing.datasource).toBe(formData.datasource);
      const { queries } = buildQuery({ ...formData, ...outgoing });
      expect(queries[query].filters).toEqual([
        expect.objectContaining({ col: 'segment', op: '==', val: 'CORP' }),
      ]);
      expect(queries[1 - query].filters).toEqual([]);
    } finally {
      chart.dispose();
      request.mockRestore();
      getChartMetadataRegistry().remove('mixed_timeseries');
    }
  },
);
