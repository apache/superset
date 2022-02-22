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
  t,
  ChartMetadata,
  ChartPlugin,
  AnnotationType,
  Behavior,
  isFeatureEnabled,
  FeatureFlag,
} from '@superset-ui/core';
import buildQuery from '../buildQuery';
import controlPanel from './controlPanel';
import transformProps from '../transformProps';
import thumbnail from './images/thumbnail.png';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
} from '../types';
import example1 from './images/Area1.png';

const areaTransformProps = (chartProps: EchartsTimeseriesChartProps) =>
  transformProps({
    ...chartProps,
    formData: { ...chartProps.formData, area: true },
  });

export default class EchartsAreaChartPlugin extends ChartPlugin<
  EchartsTimeseriesFormData,
  EchartsTimeseriesChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('../EchartsTimeseries'),
      metadata: new ChartMetadata({
        behaviors: [Behavior.INTERACTIVE_CHART],
        category: t('Evolution'),
        credits: ['https://echarts.apache.org'],
        description: isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES)
          ? t(
              'Area charts are similar to line charts in that they represent variables with the same scale, but area charts stack the metrics on top of each other.',
            )
          : t(
              'Time-series Area chart are similar to line chart in that they represent variables with the same scale, but area charts stack the metrics on top of each other. An area chart in Superset can be stream, stack, or expand.',
            ),
        exampleGallery: [{ url: example1 }],
        supportedAnnotationTypes: [
          AnnotationType.Event,
          AnnotationType.Formula,
          AnnotationType.Interval,
          AnnotationType.Timeseries,
        ],
        name: isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES)
          ? t('Area Chart v2')
          : t('Time-series Area Chart'),
        tags: [
          t('ECharts'),
          t('Predictive'),
          t('Advanced-Analytics'),
          t('Aesthetic'),
          t('Time'),
          t('Line'),
          t('Transformable'),
          t('Stacked'),
          t('Popular'),
        ],
        thumbnail,
      }),
      transformProps: areaTransformProps,
    });
  }
}
