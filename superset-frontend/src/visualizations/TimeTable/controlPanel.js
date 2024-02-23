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
import { t, validateNonEmpty } from '@superset-ui/core';
import { getStandardizedControls, sections } from '@superset-ui/chart-controls';

export default {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        ['groupby'],
        ['limit'],
        [
          {
            name: 'column_collection',
            config: {
              type: 'CollectionControl',
              label: t('Time series columns'),
              renderTrigger: true,
              validators: [validateNonEmpty],
              controlName: 'TimeSeriesColumnControl',
            },
          },
        ],
        ['row_limit'],
        [
          {
            name: 'url',
            config: {
              type: 'TextControl',
              label: t('URL'),
              description: t(
                "Templated link, it's possible to include {{ metric }} " +
                  'or other values coming from the controls.',
              ),
              default: '',
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      multiple: false,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    groupby: getStandardizedControls().popAllColumns(),
    metrics: getStandardizedControls().popAllMetrics(),
  }),
};
