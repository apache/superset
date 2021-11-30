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
  getNumberFormatter,
  getTimeFormatter,
  ChartProps,
  LegacyQueryData,
  QueryFormData,
  QueryFormMetric,
  GenericDataType,
  getMetricLabel,
} from '@superset-ui/core';

// we trust both the x (time) and y (big number) to be numeric
export interface BigNumberDatum {
  [key: string]: number | null;
}

export type BigNumberFormData = QueryFormData & {
  metric?: QueryFormMetric;
  yAxisFormat?: string;
  forceTimestampFormatting?: boolean;
};

export type BigNumberChartProps = ChartProps & {
  formData: BigNumberFormData;
  queriesData: (LegacyQueryData & {
    data?: BigNumberDatum[];
  })[];
};

export default function transformProps(chartProps: BigNumberChartProps) {
  const { width, height, queriesData, formData } = chartProps;
  const {
    headerFontSize,
    metric = 'value',
    subheader = '',
    subheaderFontSize,
    forceTimestampFormatting,
    headerTimestampFormat,
    yAxisFormat,
  } = formData;
  const { data = [], coltypes = [] } = queriesData[0];
  const metricName = getMetricLabel(metric);
  const formattedSubheader = subheader;
  const bigNumber = data.length === 0 ? null : data[0][metricName];

  let metricEntry;
  if (chartProps.datasource && chartProps.datasource.metrics) {
    metricEntry = chartProps.datasource.metrics.find(
      metricItem => metricItem.metric_name === metric,
    );
  }

  const headerFormatter =
    coltypes[0] === GenericDataType.TEMPORAL || forceTimestampFormatting
      ? getTimeFormatter(
          headerTimestampFormat ?? metricEntry?.d3format ?? '%d-%m-%Y %H:%M:%S',
        )
      : getNumberFormatter(yAxisFormat ?? metricEntry?.d3format ?? undefined);

  return {
    width,
    height,
    bigNumber,
    headerFormatter,
    headerFontSize,
    subheaderFontSize,
    subheader: formattedSubheader,
  };
}
