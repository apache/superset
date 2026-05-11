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
import { t } from '@apache-superset/core/translation';
import { Behavior, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import thumbnail from '../images/thumbnail.png';
import thumbnailDark from '../images/thumbnail-dark.png';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';

export default class SandpackChartPlugin extends ChartPlugin {
  constructor() {
    const metadata = new ChartMetadata({
      description: t(
        'Render a Sandpack-powered React or JS app against the query result. ' +
          'The dataset is exposed to the app as `./data.json`.',
      ),
      name: t('Sandpack App'),
      tags: [t('Advanced'), t('Custom'), t('Experimental')],
      thumbnail,
      thumbnailDark,
      behaviors: [Behavior.InteractiveChart],
    });

    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('../SandpackChart'),
      metadata,
      transformProps,
    });
  }
}
