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
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import example from './images/example.png';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Part of a Whole'),
  credits: ['https://bl.ocks.org/kerryrodden/7090426'],
  description: t(
    'Uses circles to visualize the flow of data through different stages of a system. Hover over individual paths in the visualization to understand the stages a value took. Useful for multi-stage, multi-group visualizing funnels and pipelines.',
  ),
  exampleGallery: [{ url: example }],
  name: t('Sunburst Chart'),
  tags: [t('Aesthetic'), t('Legacy'), t('Multi-Levels'), t('Proportional')],
  thumbnail,
  useLegacyApi: true,
});

export default class SunburstChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./ReactSunburst'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
