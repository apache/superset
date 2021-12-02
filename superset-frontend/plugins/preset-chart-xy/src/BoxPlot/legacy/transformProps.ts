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
  LegacyQueryData,
  QueryFormData,
  QueryFormMetric,
} from '@superset-ui/core';
import {
  RawBoxPlotDataRow,
  BoxPlotDataRow,
} from '../../components/BoxPlot/types';

export type LegacyBoxPlotFormData = {
  groupby?: QueryFormData['groupby'];
  metrics?: QueryFormData['metrics'];
  colorScheme?: string;
};

export type LegacyBoxPlotChartProps = ChartProps & {
  formData: LegacyBoxPlotFormData;
  queriesData: (LegacyQueryData & {
    data?: RawBoxPlotDataRow[];
  })[];
};

export default function transformProps(chartProps: LegacyBoxPlotChartProps) {
  const { width, height, datasource, formData, queriesData } = chartProps;
  const { verboseMap = {} } = datasource;
  const { colorScheme, groupby = [], metrics = [] } = formData;

  const data = (queriesData[0].data || []).map(({ label, values }) => ({
    label,
    min: values.whisker_low,
    max: values.whisker_high,
    firstQuartile: values.Q1,
    median: values.Q2,
    thirdQuartile: values.Q3,
    outliers: values.outliers,
  }));

  const xAxisLabel = groupby.join('/');

  let metric: QueryFormMetric = '';
  if (Array.isArray(metrics)) {
    metric = metrics.length > 0 ? metrics[0] : '';
  } else {
    metric = metrics;
  }
  const yAxisLabel =
    typeof metric === 'string' ? verboseMap[metric] || metric : metric.label;

  const boxPlotValues = data.reduce((r: number[], e: BoxPlotDataRow) => {
    r.push(e.min, e.max, ...e.outliers);

    return r;
  }, []);

  const minBoxPlotValue = Math.min(...boxPlotValues);
  const maxBoxPlotValue = Math.max(...boxPlotValues);
  const valueDomain = [
    minBoxPlotValue - 0.1 * Math.abs(minBoxPlotValue),
    maxBoxPlotValue + 0.1 * Math.abs(maxBoxPlotValue),
  ];

  return {
    data,
    width,
    height,
    encoding: {
      x: {
        field: 'label',
        type: 'nominal',
        scale: {
          type: 'band',
          paddingInner: 0.15,
          paddingOuter: 0.3,
        },
        axis: {
          title: xAxisLabel,
        },
      },
      y: {
        field: 'value',
        type: 'quantitative',
        scale: {
          type: 'linear',
          domain: valueDomain,
        },
        axis: {
          title: yAxisLabel,
          numTicks: 5,
          format: 'SMART_NUMBER',
        },
      },
      color: {
        field: 'label',
        type: 'nominal',
        scale: {
          scheme: colorScheme,
        },
        legend: false,
      },
    },
  };
}
