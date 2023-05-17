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
import {
  ensureIsArray,
  isAdhocColumn,
  isPhysicalColumn,
  t,
  validateNonEmpty,
} from '@superset-ui/core';
import {
  D3_FORMAT_DOCS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  sections,
  ControlPanelConfig,
  getStandardizedControls,
  ControlState,
  ControlPanelState,
  getTemporalColumns,
  sharedControls,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['columns'],
        [
          {
            name: 'time_grain_sqla',
            config: {
              ...sharedControls.time_grain_sqla,
              visibility: ({ controls }) => {
                const dttmLookup = Object.fromEntries(
                  ensureIsArray(controls?.columns?.options).map(option => [
                    option.column_name,
                    option.is_dttm,
                  ]),
                );

                return ensureIsArray(controls?.columns.value)
                  .map(selection => {
                    if (isAdhocColumn(selection)) {
                      return true;
                    }
                    if (isPhysicalColumn(selection)) {
                      return !!dttmLookup[selection];
                    }
                    return false;
                  })
                  .some(Boolean);
              },
            },
          },
          'temporal_columns_lookup',
        ],
        ['groupby'],
        ['metrics'],
        ['adhoc_filters'],
        ['series_limit'],
        ['series_limit_metric'],
        [
          {
            name: 'whiskerOptions',
            config: {
              clearable: false,
              type: 'SelectControl',
              freeForm: true,
              label: t('Whisker/outlier options'),
              default: 'Tukey',
              description: t(
                'Determines how whiskers and outliers are calculated.',
              ),
              choices: [
                ['Tukey', t('Tukey')],
                ['Min/max (no outliers)', t('Min/max (no outliers)')],
                ['2/98 percentiles', t('2/98 percentiles')],
                ['9/91 percentiles', t('9/91 percentiles')],
              ],
            },
          },
        ],
      ],
    },
    sections.titleControls,
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        [
          {
            name: 'x_ticks_layout',
            config: {
              type: 'SelectControl',
              label: t('X Tick Layout'),
              choices: [
                ['auto', t('auto')],
                ['flat', t('flat')],
                ['45°', '45°'],
                ['90°', '90°'],
                ['staggered', t('staggered')],
              ],
              default: 'auto',
              clearable: false,
              renderTrigger: true,
              description: t('The way the ticks are laid out on the X-axis'),
            },
          },
        ],
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
              description: `${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`,
            },
          },
        ],
        [
          {
            name: 'date_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Date format'),
              renderTrigger: true,
              choices: D3_TIME_FORMAT_OPTIONS,
              default: 'smart_date',
              description: D3_FORMAT_DOCS,
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      label: t('Dimensions'),
      description: t('Categories to group by on the x-axis.'),
    },
    columns: {
      label: t('Distribute across'),
      multi: true,
      description: t('Columns to calculate distribution across.'),
      initialValue: (
        control: ControlState,
        state: ControlPanelState | null,
      ) => {
        if (
          state &&
          (!control?.value ||
            (Array.isArray(control?.value) && control.value.length === 0))
        ) {
          return [getTemporalColumns(state.datasource).defaultTemporalColumn];
        }
        return control.value;
      },
      validators: [validateNonEmpty],
    },
  },
  formDataOverrides: formData => {
    const groupby = getStandardizedControls().controls.columns.filter(
      col => !ensureIsArray(formData.columns).includes(col),
    );
    getStandardizedControls().controls.columns =
      getStandardizedControls().controls.columns.filter(
        col => !groupby.includes(col),
      );

    return {
      ...formData,
      metrics: getStandardizedControls().popAllMetrics(),
      groupby,
    };
  },
};
export default config;
