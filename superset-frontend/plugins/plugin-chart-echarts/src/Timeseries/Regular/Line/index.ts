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
  FeatureFlag,
  isFeatureEnabled,
  t,
} from '@superset-ui/core';
import buildQuery from '../../buildQuery';
import controlPanel from '../controlPanel';
import transformProps from '../../transformProps';
import thumbnail from './images/thumbnail.png';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  EchartsTimeseriesSeriesType,
} from '../../types';
import example1 from './images/Line1.png';
import example2 from './images/Line2.png';

const lineTransformProps = (chartProps: EchartsTimeseriesChartProps) =>
  transformProps({
    ...chartProps,
    formData: {
      ...chartProps.formData,
      seriesType: EchartsTimeseriesSeriesType.Line,
    },
  });

export default class EchartsTimeseriesLineChartPlugin extends ChartPlugin<
  EchartsTimeseriesFormData,
  EchartsTimeseriesChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('../../EchartsTimeseries'),
      metadata: new ChartMetadata({
        behaviors: [Behavior.INTERACTIVE_CHART],
        category: t('Evolution'),
        credits: ['https://echarts.apache.org'],
        description: isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES)
          ? t(
              'Line chart is used to visualize measurements taken over a given category. Line chart is a type of chart which displays information as a series of data points connected by straight line segments. It is a basic type of chart common in many fields.',
            )
          : t(
              'Time-series line chart is used to visualize repeated measurements taken over regular time intervals. Line chart is a type of chart which displays information as a series of data points connected by straight line segments. It is a basic type of chart common in many fields.',
            ),
        exampleGallery: [{ url: example1 }, { url: example2 }],
        supportedAnnotationTypes: [
          AnnotationType.Event,
          AnnotationType.Formula,
          AnnotationType.Interval,
          AnnotationType.Timeseries,
        ],
        name: isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES)
          ? t('Line Chart')
          : t('Time-series Line Chart'),
        tags: [
          t('ECharts'),
          t('Predictive'),
          t('Advanced-Analytics'),
          t('Aesthetic'),
          t('Line'),
          t('Popular'),
        ],
        thumbnail,
      }),
      transformProps: lineTransformProps,
    });
  }
}
