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
import { validateNonEmpty } from '@superset-ui/core';
import {
  D3_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
  getStandardizedControls,
} from '@superset-ui/chart-controls';
import { defineChart } from '@superset-ui/glyph-core';
import exampleUsa from './images/exampleUsa.jpg';
import exampleUsaDark from './images/exampleUsa-dark.jpg';
import exampleGermany from './images/exampleGermany.jpg';
import exampleGermanyDark from './images/exampleGermany-dark.jpg';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import { countryOptions } from './countries';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ReactCountryMap = require('./ReactCountryMap').default;

export { default as countries } from './countries';

type CountryMapExtra = {
  country: string | null;
  linearColorScheme: string;
  numberFormat: string;
  colorScheme: string;
  sliceId: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<any, CountryMapExtra>({
  metadata: {
    name: t('Country Map'),
    description: t(
      "Visualizes how a single metric varies across a country's principal subdivisions (states, provinces, etc) on a choropleth map. Each subdivision's value is elevated when you hover over the corresponding geographic boundary.",
    ),
    category: t('Map'),
    credits: ['https://bl.ocks.org/john-guerra'],
    tags: [
      t('2D'),
      t('Comparison'),
      t('Geo'),
      t('Range'),
      t('Report'),
      t('Stacked'),
    ],
    thumbnail,
    thumbnailDark,
    exampleGallery: [
      { url: exampleUsa, urlDark: exampleUsaDark },
      { url: exampleGermany, urlDark: exampleGermanyDark },
    ],
    useLegacyApi: true,
  },
  arguments: {},
  additionalControls: {
    queryBefore: [
      [
        {
          name: 'select_country',
          config: {
            type: 'SelectControl',
            label: t('Country'),
            default: null,
            choices: countryOptions,
            description: t('Which country to plot the map for?'),
            validators: [validateNonEmpty],
          },
        },
      ],
      ['entity'],
      ['metric'],
    ],
    chartOptions: [
      [
        {
          name: 'number_format',
          config: {
            type: 'SelectControl',
            freeForm: true,
            label: t('Number format'),
            renderTrigger: true,
            default: 'SMART_NUMBER',
            choices: D3_FORMAT_OPTIONS,
            description: D3_FORMAT_DOCS,
          },
        },
      ],
      ['linear_color_scheme'],
    ],
  },
  chartOptionsTabOverride: 'customize',
  additionalControlOverrides: {
    entity: {
      label: t('ISO 3166-2 Codes'),
      description: t(
        'Column containing ISO 3166-2 codes of region/province/department in your table.',
      ),
    },
    metric: {
      label: t('Metric'),
      description: t('Metric to display bottom title'),
    },
    linear_color_scheme: {
      renderTrigger: false,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    entity: getStandardizedControls().shiftColumn(),
    metric: getStandardizedControls().shiftMetric(),
  }),
  transform: chartProps => {
    const { formData } = chartProps;
    const {
      linearColorScheme,
      numberFormat,
      selectCountry,
      colorScheme,
      sliceId,
    } = formData as Record<string, unknown>;
    return {
      country: selectCountry ? String(selectCountry).toLowerCase() : null,
      linearColorScheme: (linearColorScheme as string) ?? '',
      numberFormat: (numberFormat as string) ?? '',
      colorScheme: (colorScheme as string) ?? '',
      sliceId: (sliceId as number) ?? 0,
    };
  },
  render: ({
    width,
    height,
    data,
    country,
    linearColorScheme,
    numberFormat,
    colorScheme,
    sliceId,
  }) => (
    <ReactCountryMap
      width={width}
      height={height}
      data={data}
      country={country}
      linearColorScheme={linearColorScheme}
      numberFormat={numberFormat}
      colorScheme={colorScheme}
      sliceId={sliceId}
    />
  ),
});
