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
import example from './images/example.jpg';
import exampleDark from './images/example-dark.jpg';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Correlation'),
  description: t(
    'Table that visualizes paired t-tests, which are used to understand statistical differences between groups.',
  ),
  exampleGallery: [{ url: example, urlDark: exampleDark }],
  name: t('Paired t-test Table'),
  tags: [t('Legacy'), t('Statistical'), t('Tabular')],
  thumbnail,
  thumbnailDark,
  useLegacyApi: true,
});

export default class PairedTTestChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./PairedTTest'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
