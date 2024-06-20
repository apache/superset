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
import {
  ChartProps,
  getNumberFormatter,
  SqlaFormData,
  supersetTheme,
} from '@superset-ui/core';
import { LabelFormatterCallback, PieSeriesOption } from 'echarts';
import { CallbackDataParams } from 'echarts/types/src/util/types';
import transformProps, { parseParams } from '../../src/Pie/transformProps';
import { EchartsPieChartProps } from '../../src/Pie/types';

describe('Pie transformProps', () => {
  const formData: SqlaFormData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    groupby: ['foo', 'bar'],
    viz_type: 'my_viz',
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { foo: 'Sylvester', bar: 1, sum__num: 10 },
          { foo: 'Arnold', bar: 2, sum__num: 2.5 },
        ],
      },
    ],
    theme: supersetTheme,
  });

  it('should transform chart props for viz', () => {
    expect(transformProps(chartProps as EchartsPieChartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: [
            expect.objectContaining({
              avoidLabelOverlap: true,
              data: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Arnold, 2',
                  value: 2.5,
                }),
                expect.objectContaining({
                  name: 'Sylvester, 1',
                  value: 10,
                }),
              ]),
            }),
          ],
        }),
      }),
    );
  });
});

describe('formatPieLabel', () => {
  it('should generate a valid pie chart label', () => {
    const numberFormatter = getNumberFormatter();
    const params = { name: 'My Label', value: 1234, percent: 12.34 };
    expect(
      parseParams({
        params,
        numberFormatter,
      }),
    ).toEqual(['My Label', '1.23k', '12.34%']);
    expect(
      parseParams({
        params: { ...params, name: '<NULL>' },
        numberFormatter,
      }),
    ).toEqual(['<NULL>', '1.23k', '12.34%']);
    expect(
      parseParams({
        params: { ...params, name: '<NULL>' },
        numberFormatter,
        sanitizeName: true,
      }),
    ).toEqual(['&lt;NULL&gt;', '1.23k', '12.34%']);
  });
});

describe('Pie label string template', () => {
  const params: CallbackDataParams = {
    componentType: '',
    componentSubType: '',
    componentIndex: 0,
    seriesType: 'pie',
    seriesIndex: 0,
    seriesId: 'seriesId',
    seriesName: 'test',
    name: 'Tablet',
    dataIndex: 0,
    data: {},
    value: 123456,
    percent: 55.5,
    $vars: [],
  };

  const getChartProps = (form: Partial<SqlaFormData>): EchartsPieChartProps => {
    const formData: SqlaFormData = {
      colorScheme: 'bnbColors',
      datasource: '3__table',
      granularity_sqla: 'ds',
      metric: 'sum__num',
      groupby: ['foo', 'bar'],
      viz_type: 'my_viz',
      ...form,
    };

    return new ChartProps({
      formData,
      width: 800,
      height: 600,
      queriesData: [
        {
          data: [
            { foo: 'Sylvester', bar: 1, sum__num: 10 },
            { foo: 'Arnold', bar: 2, sum__num: 2.5 },
          ],
        },
      ],
      theme: supersetTheme,
    }) as EchartsPieChartProps;
  };

  const format = (form: Partial<SqlaFormData>) => {
    const props = transformProps(getChartProps(form));
    expect(props).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: [
            expect.objectContaining({
              avoidLabelOverlap: true,
              data: expect.arrayContaining([
                expect.objectContaining({
                  name: 'Arnold, 2',
                  value: 2.5,
                }),
                expect.objectContaining({
                  name: 'Sylvester, 1',
                  value: 10,
                }),
              ]),
              label: expect.objectContaining({
                formatter: expect.any(Function),
              }),
            }),
          ],
        }),
      }),
    );

    const formatter = (props.echartOptions.series as PieSeriesOption[])[0]!
      .label?.formatter;

    return (formatter as LabelFormatterCallback)(params);
  };

  it('should generate a valid pie chart label with template', () => {
    expect(
      format({
        label_type: 'template',
        label_template: '{name}:{value}\n{percent}',
      }),
    ).toEqual('Tablet:123k\n55.50%');
  });

  it('should be formatted using the number formatter', () => {
    expect(
      format({
        label_type: 'template',
        label_template: '{name}:{value}\n{percent}',
        number_format: ',d',
      }),
    ).toEqual('Tablet:123,456\n55.50%');
  });

  it('should be compatible with ECharts raw variable syntax', () => {
    expect(
      format({
        label_type: 'template',
        label_template: '{b}:{c}\n{d}',
        number_format: ',d',
      }),
    ).toEqual('Tablet:123456\n55.5');
  });
});
