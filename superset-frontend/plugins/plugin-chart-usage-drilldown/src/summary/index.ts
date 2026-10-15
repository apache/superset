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
import { UsageSummaryFormData } from './types';

/** viz_type stored on charts that use this plugin. */
export const USAGE_SUMMARY_VIZ_TYPE = 'usage_summary';

const metadata = new ChartMetadata({
  category: t('KPI'),
  name: t('Usage Summary'),
  description: t(
    'A total for the selected time range with one bar per day (or per few days). Viewers can switch the bucket size.',
  ),
  tags: [t('Report'), t('Time')],
  thumbnail,
  thumbnailDark,
  // The second query only keeps Superset's "No results" screen away; see alwaysOneRow
  queryObjectCount: 2,
});

export default class UsageSummaryChartPlugin extends ChartPlugin<UsageSummaryFormData> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('./UsageSummary'),
      metadata,
      transformProps,
    });
  }
}
