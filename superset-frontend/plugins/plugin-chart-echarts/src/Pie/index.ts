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
import { Behavior, ChartMetadata, ChartPlugin, t } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import example1 from './images/Pie1.jpg';
import example2 from './images/Pie2.jpg';
import example3 from './images/Pie3.jpg';
import example4 from './images/Pie4.jpg';
import { EchartsPieChartProps, EchartsPieFormData } from './types';

export default class EchartsPieChartPlugin extends ChartPlugin<
  EchartsPieFormData,
  EchartsPieChartProps
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
      loadChart: () => import('./EchartsPie'),
      metadata: new ChartMetadata({
        behaviors: [Behavior.INTERACTIVE_CHART, Behavior.DRILL_TO_DETAIL],
        category: t('Part of a Whole'),
        credits: ['https://echarts.apache.org'],
        description:
          t(`The classic. Great for showing how much of a company each investor gets, what demographics follow your blog, or what portion of the budget goes to the military industrial complex.

        Pie charts can be difficult to interpret precisely. If clarity of relative proportion is important, consider using a bar or other chart type instead.`),
        exampleGallery: [
          { url: example1 },
          { url: example2 },
          { url: example3 },
          { url: example4 },
        ],
        name: t('Pie Chart'),
        tags: [
          t('Aesthetic'),
          t('Categorical'),
          t('Circular'),
          t('Comparison'),
          t('Percentages'),
          t('Popular'),
          t('Proportional'),
          t('ECharts'),
        ],
        thumbnail,
      }),
      transformProps,
    });
  }
}
