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
import exampleUsa from './images/exampleUsa.jpg';
import exampleGermany from './images/exampleGermany.jpg';
import thumbnail from './images/thumbnail.png';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  category: t('Map'),
  credits: ['https://bl.ocks.org/john-guerra'],
  description: t(
    "Visualizes how a single metric varies across a country's principal subdivisions (states, provinces, etc) on a choropleth map. Each subdivision's value is elevated when you hover over the corresponding geographic boundary.",
  ),
  exampleGallery: [{ url: exampleUsa }, { url: exampleGermany }],
  name: t('Country Map'),
  tags: [
    t('2D'),
    t('Comparison'),
    t('Geo'),
    t('Range'),
    t('Report'),
    t('Stacked'),
  ],
  thumbnail,
  useLegacyApi: true,
});

export default class CountryMapChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./ReactCountryMap'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}

export { default as countries } from './countries';
