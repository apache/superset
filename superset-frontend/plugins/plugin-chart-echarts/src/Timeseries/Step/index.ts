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
import { AnnotationType, Behavior, t } from '@superset-ui/core';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
} from '@superset-ui/plugin-chart-echarts';
import buildQuery from '../buildQuery';
import controlPanel from './controlPanel';
import transformProps from '../transformProps';
import thumbnail from './images/thumbnail.png';
import example1 from './images/Step1.png';
import example2 from './images/Step2.png';
import { EchartsChartPlugin } from '../../types';

export default class EchartsTimeseriesStepChartPlugin extends EchartsChartPlugin<
  EchartsTimeseriesFormData,
  EchartsTimeseriesChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('../EchartsTimeseries'),
      metadata: {
        behaviors: [
          Behavior.InteractiveChart,
          Behavior.DrillToDetail,
          Behavior.DrillBy,
        ],
        category: t('Evolution'),
        credits: ['https://echarts.apache.org'],
        description: t(
          'Stepped-line graph (also called step chart) is a variation of line chart but with the line forming a series of steps between data points. A step chart can be useful when you want to show the changes that occur at irregular intervals.',
        ),
        exampleGallery: [{ url: example1 }, { url: example2 }],
        supportedAnnotationTypes: [
          AnnotationType.Event,
          AnnotationType.Formula,
          AnnotationType.Interval,
          AnnotationType.Timeseries,
        ],
        name: t('Stepped Line'),
        tags: [
          t('ECharts'),
          t('Predictive'),
          t('Advanced-Analytics'),
          t('Time'),
          t('Transformable'),
          t('Stacked'),
        ],
        thumbnail,
      },
      transformProps,
    });
  }
}
