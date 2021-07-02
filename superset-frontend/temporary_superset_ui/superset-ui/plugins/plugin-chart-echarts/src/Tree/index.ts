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
import { t, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import example from './images/tree.png';
import buildQuery from './buildQuery';

export default class EchartsTreeChartPlugin extends ChartPlugin {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsTree'),
      metadata: new ChartMetadata({
        category: t('Part of a Whole'),
        credits: ['https://echarts.apache.org'],
        description: t(
          'Visualize multiple levels of hierarchy using a familiar tree-like structure.',
        ),
        exampleGallery: [{ url: example }],
        name: t('Tree Chart'),
        tags: [t('Categorical'), t('ECharts'), t('Multi-Levels'), t('Relational'), t('Structural')],
        thumbnail,
      }),
      transformProps,
    });
  }
}
