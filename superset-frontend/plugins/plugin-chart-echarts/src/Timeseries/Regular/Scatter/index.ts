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
  AnnotationType,
  Behavior,
  ChartMetadata,
  ChartPlugin,
  hasGenericChartAxes,
  t,
} from '@superset-ui/core';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  EchartsTimeseriesSeriesType,
} from '../../types';
import buildQuery from '../../buildQuery';
import controlPanel from './controlPanel';
import transformProps from '../../transformProps';
import thumbnail from './images/thumbnail.png';
import example1 from './images/Scatter1.png';

const scatterTransformProps = (chartProps: EchartsTimeseriesChartProps) =>
  transformProps({
    ...chartProps,
    formData: {
      ...chartProps.formData,
      seriesType: EchartsTimeseriesSeriesType.Scatter,
    },
  });

export default class EchartsTimeseriesScatterChartPlugin extends ChartPlugin<
  EchartsTimeseriesFormData,
  EchartsTimeseriesChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('../../EchartsTimeseries'),
      metadata: new ChartMetadata({
        behaviors: [
          Behavior.INTERACTIVE_CHART,
          Behavior.DRILL_TO_DETAIL,
          Behavior.DRILL_BY,
        ],
        category: t('Evolution'),
        credits: ['https://echarts.apache.org'],
        description: hasGenericChartAxes
          ? t(
              'Scatter Plot has the horizontal axis in linear units, and the points are connected in order. It shows a statistical relationship between two variables.',
            )
          : t(
              'Time-series Scatter Plot has time on the horizontal axis in linear units, and the points are connected in order. It shows a statistical relationship between two variables.',
            ),
        exampleGallery: [{ url: example1 }],
        supportedAnnotationTypes: [
          AnnotationType.Event,
          AnnotationType.Formula,
          AnnotationType.Interval,
          AnnotationType.Timeseries,
        ],
        name: hasGenericChartAxes
          ? t('Scatter Plot')
          : t('Time-series Scatter Plot'),
        tags: [
          t('ECharts'),
          t('Predictive'),
          t('Advanced-Analytics'),
          t('Aesthetic'),
          t('Time'),
          t('Transformable'),
          t('Scatter'),
          t('Popular'),
        ],
        thumbnail,
      }),
      transformProps: scatterTransformProps,
    });
  }
}
