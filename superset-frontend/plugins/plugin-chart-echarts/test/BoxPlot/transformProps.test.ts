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
import { ChartProps, SqlaFormData } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { EchartsBoxPlotChartProps } from '../../src/BoxPlot/types';
import transformProps from '../../src/BoxPlot/transformProps';
import { NULL_STRING } from '../../src/constants';
import { allEventHandlers } from '../../src/utils/eventHandlers';

describe('BoxPlot transformProps', () => {
  const formData: SqlaFormData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1Y',
    columns: [],
    metrics: ['AVG(averageprice)'],
    groupby: ['type', 'region'],
    whiskerOptions: 'Tukey',
    yAxisFormat: 'SMART_NUMBER',
    viz_type: 'my_chart',
    zoomable: true,
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          {
            type: 'organic',
            region: 'Charlotte',
            'AVG(averageprice)__mean': 1.9405512820512825,
            'AVG(averageprice)__median': 1.9025,
            'AVG(averageprice)__max': 2.505,
            'AVG(averageprice)__min': 1.4775,
            'AVG(averageprice)__q1': 1.73875,
            'AVG(averageprice)__q3': 2.105,
            'AVG(averageprice)__count': 39,
            'AVG(averageprice)__outliers': [2.735],
          },
          {
            type: 'organic',
            region: 'Hartford Springfield',
            'AVG(averageprice)__mean': 2.231141025641026,
            'AVG(averageprice)__median': 2.265,
            'AVG(averageprice)__max': 2.595,
            'AVG(averageprice)__min': 1.862,
            'AVG(averageprice)__q1': 2.1285,
            'AVG(averageprice)__q3': 2.32625,
            'AVG(averageprice)__count': 39,
            'AVG(averageprice)__outliers': [],
          },
        ],
      },
    ],
    theme: supersetTheme,
  });

  const buildChartProps = (
    formDataOverrides: Partial<SqlaFormData> = {},
    data = chartProps.queriesData[0].data,
  ) =>
    new ChartProps({
      formData: { ...formData, ...formDataOverrides },
      width: 800,
      height: 600,
      queriesData: [{ ...chartProps.queriesData[0], data }],
      theme: supersetTheme,
    }) as EchartsBoxPlotChartProps;

  test('should transform chart props for viz', () => {
    expect(transformProps(chartProps as EchartsBoxPlotChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          dataZoom: expect.arrayContaining([
            {
              moveOnMouseWheel: true,
              type: 'inside',
              zoomOnMouseWheel: false,
            },
          ]),
          series: expect.arrayContaining([
            expect.objectContaining({
              name: 'boxplot',
              data: expect.arrayContaining([
                expect.objectContaining({
                  name: 'organic, Charlotte',
                  value: [
                    1.4775,
                    1.73875,
                    1.9025,
                    2.105,
                    2.505,
                    1.9405512820512825,
                    39,
                    [2.735],
                  ],
                }),
                expect.objectContaining({
                  name: 'organic, Hartford Springfield',
                  value: [
                    1.862,
                    2.1285,
                    2.265,
                    2.32625,
                    2.595,
                    2.231141025641026,
                    39,
                    [],
                  ],
                }),
              ]),
            }),
            expect.objectContaining({
              name: 'outlier',
              data: [['organic, Charlotte', 2.735]],
            }),
          ]),
        }),
      }),
    );
  });

  test('keeps NULL groups distinct from empty strings, zero, and false', () => {
    const values = [null, '', 0, false];
    const labels = [NULL_STRING, '', '0', 'false'];
    const { echartOptions, labelMap } = transformProps(
      buildChartProps(
        { groupby: ['type'] },
        values.map(type => ({ ...chartProps.queriesData[0].data[0], type })),
      ),
    );

    expect(echartOptions.xAxis).toEqual(
      expect.objectContaining({ data: labels }),
    );
    expect(labelMap).toEqual({
      [NULL_STRING]: [null],
      '': [''],
      '0': [0],
      false: [false],
    });
    expect(echartOptions.series).toEqual([
      expect.objectContaining({
        data: labels.map(name => expect.objectContaining({ name })),
      }),
      ...labels.map(name => expect.objectContaining({ data: [[name, 2.735]] })),
    ]);
  });

  test('retains partially and entirely NULL groups across multiple columns', () => {
    const groups = [
      { type: null, region: 'Charlotte' },
      { type: 'organic', region: null },
      { type: null, region: null },
    ];
    const { echartOptions, labelMap } = transformProps(
      buildChartProps(
        {},
        groups.map(group => ({
          ...chartProps.queriesData[0].data[0],
          ...group,
        })),
      ),
    );

    expect(echartOptions.xAxis).toEqual(
      expect.objectContaining({
        data: [
          `${NULL_STRING}, Charlotte`,
          `organic, ${NULL_STRING}`,
          `${NULL_STRING}, ${NULL_STRING}`,
        ],
      }),
    );
    expect(labelMap).toEqual({
      [`${NULL_STRING}, Charlotte`]: [null, 'Charlotte'],
      [`organic, ${NULL_STRING}`]: ['organic', null],
      [`${NULL_STRING}, ${NULL_STRING}`]: [null, null],
    });
  });

  test('renders NULL labels as text in box and outlier tooltips', () => {
    const { echartOptions } = transformProps(
      buildChartProps({ groupby: ['type'], numberFormat: '.3f' }, [
        { ...chartProps.queriesData[0].data[0], type: null },
      ]),
    );
    const [boxplot, outlier] = echartOptions.series as [
      {
        data: { name: string; value: unknown[] }[];
        tooltip: {
          formatter: (param: { name: string; value: unknown[] }) => string;
        };
      },
      {
        data: [string, number][];
        tooltip: { formatter: (param: { data: [string, number] }) => string };
      },
    ];
    const point = boxplot.data[0];
    const boxTooltip = document.createElement('div');
    // ECharts prepends the category index to the box statistics.
    boxTooltip.innerHTML = boxplot.tooltip.formatter({
      name: point.name,
      value: [0, ...point.value],
    });
    const outlierTooltip = document.createElement('div');
    outlierTooltip.innerHTML = outlier.tooltip.formatter({
      data: outlier.data[0],
    });

    expect(boxTooltip.querySelector('strong')?.textContent).toBe(NULL_STRING);
    expect(boxTooltip.textContent).toContain('# Observations: 39');
    expect(boxTooltip.textContent).toContain('# Outliers: 1');
    expect(outlierTooltip.querySelector('strong')?.textContent).toBe(
      NULL_STRING,
    );
    expect(outlierTooltip.textContent).toContain('2.735');
  });

  test.each([
    { type: null, label: NULL_STRING, filter: { col: 'type', op: 'IS NULL' } },
    { type: '', label: '', filter: { col: 'type', op: 'IN', val: [''] } },
    { type: 0, label: '0', filter: { col: 'type', op: 'IN', val: [0] } },
    {
      type: false,
      label: 'false',
      filter: { col: 'type', op: 'IN', val: [false] },
    },
  ])(
    'preserves $type in cross-filters and context-menu filters',
    ({ type, label, filter }) => {
      const setDataMask = jest.fn();
      const onContextMenu = jest.fn();
      const transformedProps = transformProps(
        buildChartProps({}, [{ ...chartProps.queriesData[0].data[0], type }]),
      );
      const handlers = allEventHandlers({
        ...transformedProps,
        setDataMask,
        onContextMenu,
        emitCrossFilters: true,
      });
      const name = `${label}, Charlotte`;
      const dataMask = {
        extraFormData: {
          filters: [filter, { col: 'region', op: 'IN', val: ['Charlotte'] }],
        },
        filterState: {
          value: [[type, 'Charlotte']],
          selectedValues: [name],
        },
      };
      handlers.click({ name });
      expect(setDataMask).toHaveBeenCalledWith(dataMask);

      handlers.contextmenu({
        name,
        event: { stop: jest.fn(), event: { clientX: 10, clientY: 20 } },
      });
      const drillFilters = [
        { col: 'type', op: '==', val: type, formattedVal: label },
        {
          col: 'region',
          op: '==',
          val: 'Charlotte',
          formattedVal: 'Charlotte',
        },
      ];
      expect(onContextMenu).toHaveBeenCalledWith(10, 20, {
        drillToDetail: drillFilters,
        crossFilter: { dataMask, isCurrentValueSelected: false },
        drillBy: { filters: drillFilters, groupbyFieldName: 'groupby' },
      });
    },
  );

  test('should add a vertical Y-axis slider to dataZoom when yAxisSlider is enabled', () => {
    const { echartOptions } = transformProps(
      buildChartProps({ yAxisSlider: true }),
    );
    expect((echartOptions as any).dataZoom).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'slider',
          show: true,
          yAxisIndex: [0],
          filterMode: 'none',
        }),
      ]),
    );
  });

  test('should not add a Y-axis slider when yAxisSlider is disabled', () => {
    const { echartOptions } = transformProps(
      buildChartProps({ yAxisSlider: false }),
    );
    expect((echartOptions as any).dataZoom).not.toContainEqual(
      expect.objectContaining({ type: 'slider' }),
    );
  });

  test('should combine zoomable and yAxisSlider dataZoom entries', () => {
    const { echartOptions } = transformProps(
      buildChartProps({ zoomable: true, yAxisSlider: true }),
    );
    expect((echartOptions as any).dataZoom).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'inside' }),
        expect.objectContaining({ type: 'slider', yAxisIndex: [0] }),
      ]),
    );
  });
});
