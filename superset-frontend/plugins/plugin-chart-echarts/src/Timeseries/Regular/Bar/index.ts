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
import controlPanel from './controlPanel';
import transformProps from '../../transformProps';
import thumbnail from './images/thumbnail.png';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  EchartsTimeseriesSeriesType,
} from '../../types';
import example1 from './images/Bar1.png';
import example2 from './images/Bar2.png';
import example3 from './images/Bar3.png';

const barTransformProps = (chartProps: EchartsTimeseriesChartProps) =>
  transformProps({
    ...chartProps,
    formData: {
      ...chartProps.formData,
      seriesType: EchartsTimeseriesSeriesType.Bar,
    },
  });

export default class EchartsTimeseriesBarChartPlugin extends ChartPlugin<
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
          ? t('Bar Charts are used to show metrics as a series of bars.')
          : t(
              'Time-series Bar Charts are used to show the changes in a metric over time as a series of bars.',
            ),
        exampleGallery: [
          { url: example1 },
          { url: example2 },
          { url: example3 },
        ],
        supportedAnnotationTypes: [
          AnnotationType.Event,
          AnnotationType.Formula,
          AnnotationType.Interval,
          AnnotationType.Timeseries,
        ],
        name: isFeatureEnabled(FeatureFlag.GENERIC_CHART_AXES)
          ? t('Bar Chart v2')
          : t('Time-series Bar Chart v2'),
        tags: [
          t('ECharts'),
          t('Predictive'),
          t('Advanced-Analytics'),
          t('Aesthetic'),
          t('Time'),
          t('Transformable'),
          t('Stacked'),
          t('Vertical'),
          t('Bar'),
          t('Popular'),
        ],
        thumbnail,
      }),
      transformProps: barTransformProps,
    });
  }
}
