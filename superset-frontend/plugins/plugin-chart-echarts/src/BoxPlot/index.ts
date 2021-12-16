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
import { t, ChartMetadata, ChartPlugin, Behavior } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import example from './images/BoxPlot.jpg';
import thumbnail from './images/thumbnail.png';
import { BoxPlotQueryFormData, EchartsBoxPlotChartProps } from './types';

export default class EchartsBoxPlotChartPlugin extends ChartPlugin<
  BoxPlotQueryFormData,
  EchartsBoxPlotChartProps
> {
  /**
   * The constructor is used to pass relevant metadata and callbacks that get
   * registered in respective registries that are used throughout the library
   * and application. A more thorough description of each property is given in
   * the respective imported file.
   *
   * It is worth noting that `buildQuery` and is optional, and only needed for
   * advanced visualizations that require either post processing operations
   * (pivoting, rolling aggregations, sorting etc) or submitting multiple queries.
   */
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsBoxPlot'),
      metadata: new ChartMetadata({
        behaviors: [Behavior.INTERACTIVE_CHART],
        category: t('Distribution'),
        credits: ['https://echarts.apache.org'],
        description: t(
          'Also known as a box and whisker plot, this visualization compares the distributions of a related metric across multiple groups. The box in the middle emphasizes the mean, median, and inner 2 quartiles. The whiskers around each box visualize the min, max, range, and outer 2 quartiles.',
        ),
        exampleGallery: [{ url: example }],
        name: t('Box Plot'),
        tags: [t('ECharts'), t('Range'), t('Statistical')],
        thumbnail,
      }),
      transformProps,
    });
  }
}
