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
import buildQuery from './buildQuery';
import controlPanel from './Regular/Line/controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
} from './types';
import example from './images/Time-series_Chart.jpg';

export default class EchartsTimeseriesChartPlugin extends ChartPlugin<
  EchartsTimeseriesFormData,
  EchartsTimeseriesChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsTimeseries'),
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
              'Swiss army knife for visualizing data. Choose between step, line, scatter, and bar charts. This viz type has many customization options as well.',
            )
          : t(
              'Swiss army knife for visualizing time series data. Choose between step, line, scatter, and bar charts. This viz type has many customization options as well.',
            ),
        exampleGallery: [{ url: example }],
        supportedAnnotationTypes: [
          AnnotationType.Event,
          AnnotationType.Formula,
          AnnotationType.Interval,
          AnnotationType.Timeseries,
        ],
        name: hasGenericChartAxes ? t('Generic Chart') : t('Time-series Chart'),
        tags: [
          t('Advanced-Analytics'),
          t('Aesthetic'),
          t('Line'),
          t('Predictive'),
          t('Time'),
          t('Transformable'),
        ],
        thumbnail,
      }),
      transformProps,
    });
  }
}
