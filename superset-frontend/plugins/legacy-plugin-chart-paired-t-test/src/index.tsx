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
import { defineChart } from '@superset-ui/glyph-core';
import example from './images/example.jpg';
import exampleDark from './images/example-dark.jpg';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PairedTTest = require('./PairedTTest').default;

type PairedTTestExtra = {
  alpha: number;
  groups: string[];
  liftValPrec: number;
  metrics: string[];
  pValPrec: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<any, PairedTTestExtra>({
  metadata: {
    name: t('Paired t-test Table'),
    description: t(
      'Table that visualizes paired t-tests, which are used to understand statistical differences between groups.',
    ),
    category: t('Correlation'),
    tags: [t('Legacy'), t('Statistical'), t('Tabular')],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
    useLegacyApi: true,
  },
  arguments: {},
  additionalControls: {
    queryBefore: [['metrics']],
    query: [
      [
        {
          name: 'groupby',
          override: {
            validators: [validateNonEmpty],
          },
        },
      ],
      ['limit', 'timeseries_limit_metric'],
      ['order_desc'],
      [
        {
          name: 'contribution',
          config: {
            type: 'CheckboxControl',
            label: t('Contribution'),
            default: false,
            description: t('Compute the contribution to the total'),
          },
        },
      ],
      ['row_limit', null],
    ],
  },
  additionalSections: [
    {
      label: t('Parameters'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'significance_level',
            config: {
              type: 'TextControl',
              label: t('Significance Level'),
              default: 0.05,
              description: t(
                'Threshold alpha level for determining significance',
              ),
            },
          },
        ],
        [
          {
            name: 'pvalue_precision',
            config: {
              type: 'TextControl',
              label: t('p-value precision'),
              default: 6,
              description: t(
                'Number of decimal places with which to display p-values',
              ),
            },
          },
        ],
        [
          {
            name: 'liftvalue_precision',
            config: {
              type: 'TextControl',
              label: t('Lift percent precision'),
              default: 4,
              description: t(
                'Number of decimal places with which to display lift values',
              ),
            },
          },
        ],
      ],
    },
  ],
  transform: chartProps => {
    const { formData } = chartProps;
    const {
      groupby,
      liftvaluePrecision,
      metrics,
      pvaluePrecision,
      significanceLevel,
    } = formData as Record<string, unknown>;

    return {
      alpha: (significanceLevel as number) ?? 0.05,
      groups: (groupby as string[]) ?? [],
      liftValPrec: parseInt(String(liftvaluePrecision ?? '4'), 10),
      metrics: ((metrics as Array<string | { label: string }>) ?? []).map(
        metric => (typeof metric === 'string' ? metric : metric.label),
      ),
      pValPrec: parseInt(String(pvaluePrecision ?? '6'), 10),
    };
  },
  render: ({ alpha, groups, liftValPrec, metrics, pValPrec, data }) => (
    <PairedTTest
      alpha={alpha}
      data={data}
      groups={groups}
      liftValPrec={liftValPrec}
      metrics={metrics}
      pValPrec={pValPrec}
    />
  ),
});
