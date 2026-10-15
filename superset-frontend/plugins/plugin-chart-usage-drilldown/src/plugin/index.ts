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
import { ChartMetadata, ChartPlugin } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from '../images/thumbnail.png';
import thumbnailDark from '../images/thumbnail-dark.png';
import { UsageDrilldownFormData } from '../types';

/** viz_type stored on charts that use this plugin. */
export const USAGE_DRILLDOWN_VIZ_TYPE = 'usage_drilldown';

const metadata = new ChartMetadata({
  category: t('Table'),
  name: t('Usage Drilldown'),
  description: t(
    'A table that drills through a hierarchy of columns (e.g. project → workflow → API). Click a row to open the next level; use the breadcrumb to go back.',
  ),
  tags: [t('Tabular'), t('Hierarchical'), t('Percentages')],
  thumbnail,
  thumbnailDark,
  // The second query only keeps Superset's "No results" screen away; see alwaysOneRow
  queryObjectCount: 2,
});

export default class UsageDrilldownChartPlugin extends ChartPlugin<UsageDrilldownFormData> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('../UsageDrilldown'),
      metadata,
      transformProps,
    });
  }
}
