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
import buildQuery from './buildQuery';

export default class EchartsGraphChartPlugin extends ChartPlugin {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./EchartsGraph'),
      metadata: new ChartMetadata({
        category: t('Flow'),
        credits: ['https://echarts.apache.org'],
        description: t(
          'Displays connections between entities in a graph structure. Useful for mapping relationships and showing which nodes are important in a network. Graph charts can be configured to be force-directed or circulate. If your data has a geospatial component, try the deck.gl Arc chart.',
        ),
        name: t('Graph Chart'),
        tags: [
          t('Aesthetic'),
          t('Circular'),
          t('Comparison'),
          t('Directional'),
          t('ECharts'),
          t('Relational'),
          t('Structural'),
          t('Transformable'),
        ],
        thumbnail,
      }),
      transformProps,
    });
  }
}
