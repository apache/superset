/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regardin
 * g copyright ownership.  The ASF licenses this file
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
import { ChartMetadata, ChartPlugin, t } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import example1 from './images/example1.png';
import example2 from './images/example2.png';
import { SankeyChartProps, SankeyFormData } from './types';

// TODO: Implement cross filtering
export default class EchartsSankeyChartPlugin extends ChartPlugin<
  SankeyFormData,
  SankeyChartProps
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
      loadChart: () => import('./Sankey'),
      metadata: new ChartMetadata({
        credits: ['https://echarts.apache.org'],
        category: t('Flow'),
        description: t(
          `The Sankey chart visually tracks the movement and transformation of values across
          system stages. Nodes represent stages, connected by links depicting value flow. Node
          height corresponds to the visualized metric, providing a clear representation of
          value distribution and transformation.`,
        ),
        exampleGallery: [{ url: example1 }, { url: example2 }],
        name: t('Sankey Chart'),
        tags: [t('Directional'), t('Distribution'), t('Flow')],
        thumbnail,
      }),
      transformProps,
    });
  }
}
