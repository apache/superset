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
import { ChartDataResponseResult, DataRecord } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import transformProps from '../../src/Timeseries/transformProps';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
} from '../../src/Timeseries/types';
import { DEFAULT_FORM_DATA } from '../../src/Timeseries/constants';
import { createEchartsTimeseriesTestChartProps } from '../helpers';
import { BASE_TIMESTAMP } from './helpers';

jest.mock('@apache-superset/core/translation', () => {
  const translation = jest.requireActual<
    typeof import('@apache-superset/core/translation')
  >('@apache-superset/core/translation');
  return { ...translation, t: jest.fn(translation.t) };
});

const queriesData = [
  {
    data: [
      { count: 10, sum_value: 30, __timestamp: BASE_TIMESTAMP },
    ] as DataRecord[],
    colnames: [],
    coltypes: [],
    label_map: { count: ['count'], sum_value: ['sum_value'] },
  },
] as unknown as ChartDataResponseResult[];

const getTooltipFormatter = (showTooltipTotal: boolean) => {
  const chartProps = createEchartsTimeseriesTestChartProps<
    EchartsTimeseriesFormData,
    EchartsTimeseriesChartProps
  >({
    defaultFormData: DEFAULT_FORM_DATA,
    defaultVizType: 'echarts_timeseries_bar',
    formData: {
      metrics: ['count', 'sum_value'],
      richTooltip: true,
      showTooltipTotal,
    },
    queriesData,
  });
  const { tooltip } = transformProps(chartProps).echartOptions as {
    tooltip: { formatter: (params: unknown) => string };
  };
  return tooltip.formatter;
};

const params = [
  { seriesId: 'count', seriesName: 'count', value: [BASE_TIMESTAMP, 10] },
  {
    seriesId: 'sum_value',
    seriesName: 'sum_value',
    value: [BASE_TIMESTAMP, 30],
  },
];

test('tooltip total row label is translated', () => {
  const formatter = getTooltipFormatter(true);
  jest
    .mocked(t)
    .mockImplementationOnce((text: string) =>
      text === 'Total' ? 'Gesamt' : text,
    );

  const html = formatter(params);

  expect(t).toHaveBeenCalledWith('Total');
  expect(html).toContain('Gesamt');
  expect(html).not.toContain('Total');
});

test('tooltip has no total row when showTooltipTotal is off', () => {
  const formatter = getTooltipFormatter(false);
  jest.mocked(t).mockClear();

  formatter(params);

  expect(t).not.toHaveBeenCalledWith('Total');
});
