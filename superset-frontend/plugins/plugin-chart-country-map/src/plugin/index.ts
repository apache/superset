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

/**
 * Modern Country Map plugin.
 *
 * Replaces `legacy-plugin-chart-country-map`. Built against the
 * `chart/data` endpoint with full async/caching/semantic-layer
 * integration. Data driven by the build pipeline at
 * `superset-frontend/plugins/plugin-chart-country-map/scripts/`.
 *
 * Default editorial position: ships Natural Earth's `_ukr` worldview,
 * configurable via `superset_config.COUNTRY_MAP.default_worldview`.
 * See `SIP_DRAFT.md` for design rationale and discussion of disputed
 * regions.
 */
export default class CountryMapChartPlugin extends ChartPlugin {
  constructor() {
    const metadata = new ChartMetadata({
      category: t('Map'),
      credits: ['Natural Earth (https://www.naturalearthdata.com/)'],
      description: t(
        "Visualizes a metric across a country's principal subdivisions " +
          '(states, provinces, departments, etc.) on a choropleth map. ' +
          'Supports configurable worldview for disputed regions, multi-' +
          'country composites (e.g. France with overseas territories), ' +
          'and aggregated regional layers.',
      ),
      name: t('Country Map'),
      tags: [t('2D'), t('Comparison'), t('Geo'), t('Range'), t('Report')],
      // TODO: thumbnail + example images come in a follow-up commit
      // (need to render real outputs first).
      thumbnail: '',
    });

    super({
      buildQuery,
      controlPanel,
      // Lazy-load the React renderer to keep the chart-type registry small.
      loadChart: () => import('../CountryMap'),
      metadata,
      transformProps,
    });
  }
}
