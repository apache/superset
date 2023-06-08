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
import { t, ChartMetadata, ChartPlugin, ChartLabel } from '@superset-ui/core';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
import example1 from './images/example1.jpg';
import example2 from './images/example2.jpg';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Tools'),
  label: ChartLabel.DEPRECATED,
  name: t('Filter box (legacy)'),
  description:
    t(`Chart component that lets you add a custom filter UI in your dashboard. When added to dashboard, a filter box lets users specify specific values or ranges to filter charts by. The charts that each filter box is applied to can be fine tuned as well in the dashboard view.

    Note that this plugin is being replaced with the new Filters feature that lives in the dashboard view itself. It's easier to use and has more capabilities!`),
  exampleGallery: [{ url: example1 }, { url: example2 }],
  thumbnail,
  useLegacyApi: true,
  tags: [t('Legacy'), t('Deprecated')],
});

/**
 * @deprecated in version 3.0.
 */
export default class FilterBoxChartPlugin extends ChartPlugin {
  constructor() {
    super({
      controlPanel,
      metadata,
      transformProps,
      loadChart: () => import('./FilterBox'),
    });
  }
}
