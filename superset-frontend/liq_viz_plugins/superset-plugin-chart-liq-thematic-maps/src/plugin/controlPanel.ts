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
import { t, validateNonEmpty, legacyValidateInteger } from '@superset-ui/core';
import { ControlPanelConfig, sections, sharedControls } from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  /**
   * The control panel is split into two tabs: "Query" and
   * "Chart Options". The controls that define the inputs to
   * the chart data request, such as columns and metrics, usually
   * reside within "Query", while controls that affect the visual
   * appearance or functionality of the chart are under the
   * "Chart Options" section.
   *
   * There are several predefined controls that can be used.
   * Some examples:
   * - groupby: columns to group by (tranlated to GROUP BY statement)
   * - series: same as groupby, but single selection.
   * - metrics: multiple metrics (translated to aggregate expression)
   * - metric: sane as metrics, but single selection
   * - adhoc_filters: filters (translated to WHERE or HAVING
   *   depending on filter type)
   * - row_limit: maximum number of rows (translated to LIMIT statement)
   *
   * If a control panel has both a `series` and `groupby` control, and
   * the user has chosen `col1` as the value for the `series` control,
   * and `col2` and `col3` as values for the `groupby` control,
   * the resulting query will contain three `groupby` columns. This is because
   * we considered `series` control a `groupby` query field and its value
   * will automatically append the `groupby` field when the query is generated.
   *
   * It is also possible to define custom controls by importing the
   * necessary dependencies and overriding the default parameters, which
   * can then be placed in the `controlSetRows` section
   * of the `Query` section instead of a predefined control.
   *
   * import { validateNonEmpty } from '@superset-ui/core';
   * import {
   *   sharedControls,
   *   ControlConfig,
   *   ControlPanelConfig,
   * } from '@superset-ui/chart-controls';
   *
   * const myControl: ControlConfig<'SelectControl'> = {
   *   name: 'secondary_entity',
   *   config: {
   *     ...sharedControls.entity,
   *     type: 'SelectControl',
   *     label: t('Secondary Entity'),
   *     mapStateToProps: state => ({
   *       sharedControls.columnChoices(state.datasource)
   *       .columns.filter(c => c.groupby)
   *     })
   *     validators: [validateNonEmpty],
   *   },
   * }
   *
   * In addition to the basic drop down control, there are several predefined
   * control types (can be set via the `type` property) that can be used. Some
   * commonly used examples:
   * - SelectControl: Dropdown to select single or multiple values,
       usually columns
   * - MetricsControl: Dropdown to select metrics, triggering a modal
       to define Metric details
   * - AdhocFilterControl: Control to choose filters
   * - CheckboxControl: A checkbox for choosing true/false values
   * - SliderControl: A slider with min/max values
   * - TextControl: Control for text data
   *
   * For more control input types, check out the `incubator-superset` repo
   * and open this file: superset-frontend/src/explore/components/controls/index.js
   *
   * To ensure all controls have been filled out correctly, the following
   * validators are provided
   * by the `@superset-ui/core/lib/validator`:
   * - validateNonEmpty: must have at least one value
   * - validateInteger: must be an integer value
   * - validateNumber: must be an intger or decimal value
   */

  // For control input types, see: superset-frontend/src/explore/components/controls/index.js
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'cols',
            config: {
              ...sharedControls.groupby,
              label: t('Columns'),
              description: t('Columns to group by'),
            },
          },
        ],
        [
          {
            name: 'metric',
            config: {
              ...sharedControls.metric,
              // it's possible to add validators to controls if
              // certain selections/types need to be enforced
              validators: [validateNonEmpty],
            },
          },
        ],
        ['adhoc_filters'],
        [
          {
            name: 'row_limit',
            config: sharedControls.row_limit,
          },
        ],
      ],
    },
    {
      label: t('Map Style Settings'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'map_style',
            config: {
              type: 'SelectControl',
              default: 'mapbox://styles/mapbox/streets-v12',
              choices: [
                ['mapbox://styles/mapbox/streets-v12', 'Streets'],
                ['mapbox://styles/mapbox/outdoors-v12', 'Outdoors'],
                ['mapbox://styles/mapbox/light-v11', 'Light'],
                ['mapbox://styles/mapbox/dark-v11', 'Dark'],
                ['mapbox://styles/mapbox/satellite-v9', 'Satellite'],
                ['mapbox://styles/mapbox/satellite-streets-v12', 'Satellite Streets'],
                ['mapbox://styles/mapbox/navigation-day-v1', 'Navigation Day'],
                ['mapbox://styles/mapbox/navigation-night-v1', 'Navigation Night']
              ],
              renderTrigger: true,
              label: t('Base Map Style')
            }
          }
        ]
      ]
    },
    {
      label: t('Base Layer Settings'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'intranet_layers',
            config: {
              type: 'SelectControl',
              multi: true,
              renderTrigger: true,
              label: t('Intranet Layers'),
              description: t('Various retail, non-retail & infrastructure layers from the LIQ Database.'),
              choices: [
                ['shopping_centres', 'Shopping Centres'],
                ['department_stores', 'Department Stores'],
                ['discount_department_stores', 'Discount Department Stores'],
                ['large_format_retail', 'Large Format Retail'],
                ['mini_majors', 'Mini Majors'],
                ['supermarkets', 'Supermarkets'],
                ['liquor', 'Liquor']
              ]
            }
          }
        ]
      ]
    },
    {
      label: t('Thematic Settings'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'boundary',
            config: {
              type: 'SelectControl',
              default: 'sa1',
              choices: [
                ['sa1', 'SA1'],
                ['sa2', 'SA2'],
                ['sa3', 'SA3'],
                ['sa4', 'SA4'],
                ['gccsa', 'GCCSA'],
                ['local_government_area', 'LGA'],
                ['postcode', 'POA'],
                ['state', 'State'],
                ['suburb', 'SAL'],
                ['worker', 'DZN']
              ],
              renderTrigger: false,
              // ^ this makes it apply instantaneously, without triggering a "run query" button
              label: t('Boundary'),
              description: t('ABS boundaries'),
            },
          },
        ],
        ['linear_color_scheme'],
        [
          {
            'name': 'breaks_mode',
            'config': {
              type: 'SelectControl',
              default: 'equal_count',
              choices: [
                ['custom', 'Custom'],
                ['equal_count', 'Equal Count (Quantile)'],
                ['equal_interval', 'Equal Interval']
              ],
              renderTrigger: false,
              label: t('Mode'),
              description: t('Method used for color styling in thematic. If specifying a custom mode below, select "Custom" here.')
            }
          }
        ],
        [
          {
            name: 'custom_mode',
            config: {
              type: 'TextControl',
              renderTrigger: false,
              default: '',
              label: t('Custom Mode'),
              description: t('Specify a custom mode here for the number of classes, e.g. for 5 classes in custom mode would look something like 0,5,10,15,20,25 for breaks of 0-4, 5-9, 10-14, 15-19, 20+. Leave blank if specifying a mode above.')
            }
          }
        ],
        [
          {
            name: 'num_classes',
            config: {
              type: 'TextControl',
              isInt: true,
              default: 0,
              validators: [legacyValidateInteger],
              renderTrigger: false,
              label: t('Number of classes'),
              description: t('The number of breaks for the thematic'),
            },
          },
        ]
      ],
    },
    {
      label: t('Trade Area Settings'),
      expanded: true,
      controlSetRows: []
    }
  ],
  controlOverrides: {
    linear_color_scheme: {
      renderTrigger: false
    }
  }
};

export default config;
