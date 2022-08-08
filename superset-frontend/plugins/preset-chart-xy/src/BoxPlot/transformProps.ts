/*
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

import { pick } from 'lodash';
import { ChartProps } from '@superset-ui/core';
import { BoxPlotDataRow, RawBoxPlotDataRow } from '../components/BoxPlot/types';
import { HookProps } from '../components/BoxPlot/BoxPlot';
import { BoxPlotEncoding } from '../components/BoxPlot/Encoder';

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const { margin, theme } = formData;
  const encoding = formData.encoding as BoxPlotEncoding;

  const data = (queriesData[0].data as RawBoxPlotDataRow[]).map(
    ({ label, values }) => ({
      label,
      min: values.whisker_low,
      max: values.whisker_high,
      firstQuartile: values.Q1,
      median: values.Q2,
      thirdQuartile: values.Q3,
      outliers: values.outliers,
    }),
  );

  const isHorizontal = encoding.y.type === 'nominal';

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

  if (isHorizontal) {
    if (encoding.x.scale) {
      encoding.x.scale.domain = valueDomain;
    } else {
      encoding.x.scale = { domain: valueDomain };
    }
  } else if (encoding.y.scale) {
    encoding.y.scale.domain = valueDomain;
  } else {
    encoding.y.scale = { domain: valueDomain };
  }

  const hooks = chartProps.hooks as HookProps;

  const fieldsFromHooks: (keyof HookProps)[] = [
    'TooltipRenderer',
    'LegendRenderer',
    'LegendGroupRenderer',
    'LegendItemRenderer',
    'LegendItemMarkRenderer',
    'LegendItemLabelRenderer',
  ];

  return {
    data,
    width,
    height,
    margin,
    theme,
    encoding,
    ...pick(hooks, fieldsFromHooks),
  };
}
