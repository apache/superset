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
import { DatasourceType, TimeGranularity } from '@superset-ui/core';
import transformProps, {
  BignumberChartProps,
  BigNumberDatum,
} from '../src/BigNumber/transformProps';

const formData = {
  metric: 'value',
  colorPicker: {
    r: 0,
    g: 122,
    b: 135,
    a: 1,
  },
  compareLag: 1,
  timeGrainSqla: 'P3M' as TimeGranularity,
  compareSuffix: 'over last quarter',
  vizType: 'big_number',
  yAxisFormat: '.3s',
};

const rawFormData = {
  metric: 'value',
  color_picker: {
    r: 0,
    g: 122,
    b: 135,
    a: 1,
  },
  compare_lag: 1,
  time_grain_sqla: 'P3M' as TimeGranularity,
  compare_suffix: 'over last quarter',
  viz_type: 'big_number',
  y_axis_format: '.3s',
};

function generateProps(
  data: BigNumberDatum[],
  extraFormData = {},
  extraQueryData = {},
): BignumberChartProps {
  return {
    width: 200,
    height: 500,
    annotationData: {},
    datasource: {
      id: 0,
      name: '',
      type: DatasourceType.Table,
      columns: [],
      metrics: [],
      columnFormats: {},
      verboseMap: {},
    },
    rawDatasource: {},
    rawFormData,
    hooks: {},
    initialValues: {},
    formData: {
      ...formData,
      ...extraFormData,
    },
    queriesData: [
      {
        data,
        ...extraQueryData,
      },
    ],
  };
}

describe('BigNumber', () => {
  const props = generateProps(
    [
      {
        __timestamp: 0,
        value: 1.2345,
      },
      {
        __timestamp: 100,
        value: null,
      },
    ],
    { showTrendLine: true },
  );

  describe('transformProps()', () => {
    it('should fallback and format time', () => {
      const transformed = transformProps(props);
      // the first item is the last item sorted by __timestamp
      const lastDatum = transformed.trendLineData?.pop();

      // should use last available value
      expect(lastDatum?.x).toStrictEqual(100);
      expect(lastDatum?.y).toBeNull();

      // should note this is a fallback
      expect(transformed.bigNumber).toStrictEqual(1.2345);
      expect(transformed.bigNumberFallback).not.toBeNull();

      // should successfully formatTime by ganularity
      expect(transformed.formatTime(new Date('2020-01-01'))).toStrictEqual(
        '2020-01-01 00:00:00',
      );
    });

    it('should respect datasource d3 format', () => {
      const propsWithDatasource = {
        ...props,
        datasource: {
          ...props.datasource,
          metrics: [
            {
              label: 'value',
              metric_name: 'value',
              d3format: '.2f',
            },
          ],
        },
      };
      const transformed = transformProps(propsWithDatasource);
      expect(transformed.headerFormatter(transformed.bigNumber)).toStrictEqual(
        '1.23',
      );
    });
  });
});
