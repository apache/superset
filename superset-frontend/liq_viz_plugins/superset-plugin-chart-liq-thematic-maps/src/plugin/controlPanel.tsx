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
  t, 
  validateNonEmpty, 
  legacyValidateInteger, 
  validateNumber,   
  getSequentialSchemeRegistry,
  SequentialScheme 
} from '@superset-ui/core';
import { ControlPanelConfig, sections, sharedControls } from '@superset-ui/chart-controls';

const sequentialSchemeRegistry = getSequentialSchemeRegistry();

export type Result = {
  id: unknown;
  database_name?: string;
  value?: string;
};

export type Data = {
  result?: Result[];
};

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
        [
          {
            name: 'map_type',
            config: {
              type: 'SelectControl',
              default: 'thematic',
              multi: true,
              renderTrigger: false,
              choices: [
                ['thematic', 'Thematic'],
                ['trade_area', 'Trade Area'],
                ['intranet', 'Intranet']
              ],
              label: t('Map Type'),
              description: t('What the dataset is for, i.e. the socios dataset would fall under Thematic or a dataset with entity_ids will fill under intranet.')
            }
          },
        ]
      ],
    },
    {
      label: t('Map Style & Layer Settings'),
      expanded: false,
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
          },
        ],
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
        ],
      ]
    },
    {
      label: t('Map Feature Settings'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'features',
            config: {
              type: 'SelectControl',
              default: 'legend',
              multi: true,
              choices: [
                ['legend', 'Legend'],
                ['radius', 'Radius'],
                ['drivetime', 'Drivetime']
              ],
              renderTrigger: true,
              label: t('Map Features'),
              description: t('Select features/functionality you want to add to the map.')
            }
          }
        ]
      ]
    },
    {
      label: t('Thematic Settings'),
      expanded: false,
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
              visibility: ({ controls }) => Boolean(controls.map_type.value.includes('thematic'))
            },
          },
        ],
        ['linear_color_scheme'],
        [
          {
            name: 'breaks_mode',
            config: {
              type: 'SelectControl',
              default: 'equal_count',
              choices: [
                ['custom', 'Custom'],
                ['equal_count', 'Equal Count (Quantile)'],
                ['equal_interval', 'Equal Interval'],
                ['categorized', 'Categorized']
              ],
              renderTrigger: false,
              label: t('Mode'),
              description: t('Method used for color styling in thematic.'),
              visibility: ({ controls }) => Boolean(controls.map_type.value.includes('thematic'))
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
              description: t('Specify a custom mode here for the number of classes, e.g. for 5 classes in custom mode would look something like 0,5,10,15,20,25 for breaks of 0-4, 5-9, 10-14, 15-19, 20+. Leave blank if specifying a mode above.'),
              visibility: ({ controls }) => Boolean(controls.breaks_mode.value === 'custom') && Boolean(controls.map_type.value.includes('thematic'))
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
              label: t('Classes'),
              description: t('The number of breaks for the thematic'),
              visibility: ({ controls }) => Boolean(!(controls.breaks_mode.value === 'categorized')) && Boolean(controls.map_type.value.includes('thematic'))
            },
          },
          {
            name: 'opacity',
            config: {
              type: 'SliderControl',
              min: 0,
              max: 1,
              step: 0.1,
              default: 0.5,
              renderTrigger: true,
              label: t('Opacity'),
              description: t('Opacity of thematic'),
            }
          }
        ]
      ],
    },
    {
      label: t('Initial Map Position'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'latitude',
            config : {
              type: 'TextControl',
              isFloat: true,
              renderTrigger: false,
              default: -33.8,
              label: t('Latitude')
            }
          },
          {
            name: 'longitude',
            config: {
              type: 'TextControl',
              isFloat: true,
              renderTrigger: false,
              default: 151.2,
              label: t('Longitude')
            }
          }
        ],
        [
          {
            name: 'zoom',
            config: {
              type: 'TextControl',
              isFloat: true,
              renderTrigger: false,
              default: 9,
              label: t('Zoom')
            }
          }
        ]
      ]
    },
    {
      label: t('Radius Settings'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'radius_color',
            config: {
              label: t('Radius Color'),
              type: 'ColorPickerControl',
              renderTrigger: true,
              default: {
                r: 31,
                g: 168,
                b: 201,
                a: 100
              },
              visibility: ({ controls }) => Boolean(controls.features.value.includes('radius'))
            }
          },
          {
            name: 'radius_threshold',
            config: {
              type: 'SliderControl',
              min: 0,
              max: 1,
              step: 0.1,
              default: 0.5,
              renderTrigger: false,
              label: t('Threshold'),
              description: t('Threshold for ratio of SA1 intersection with radius, i.e. a ratio of 0.5 excludes SA1s where less than 50% of their area intersect with the radius.'),
              visibility: ({ controls }) => Boolean(controls.features.value.includes('radius'))
            }
          }
        ],
        [
          {
            name: 'radius_border_color',
            config: {
              label: t('Border Color'),
              type: 'ColorPickerControl',
              renderTrigger: true,
              default: {
                r: 31,
                g: 168,
                b: 201,
                a: 100
              },
              visibility: ({ controls }) => Boolean(controls.features.value.includes('radius'))
            }
          },
          {
            name: 'radius_border_width',
            config: {
              type: 'TextControl',
              min: 0,
              validators: [validateNumber],
              renderTrigger: true,
              default: 0,
              label: t('Border Width'),
              visibility: ({ controls }) => Boolean(controls.features.value.includes('radius'))
            }
          }
        ],
        [
          {
            name: 'radius_linked_charts',
            config: {
              type: 'TextControl',
              renderTrigger: false,
              label: t('Chart IDs'),
              description: t('Comma separated list of chart IDs whose charts we want to update when radius updates.'),
              visibility: ({ controls }) => Boolean(controls.features.value.includes('radius'))
            }
          }
        ]
      ]
    },
    {
      label: t('Drivetime Settings'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'drivetime_color',
            config: {
              label: t('Drivetime Color'),
              type: 'ColorPickerControl',
              renderTrigger: true,
              default: {
                r: 31,
                g: 168,
                b: 201,
                a: 100
              },
              visibility: ({ controls }) => Boolean(controls.features.value.includes('drivetime'))
            }
          },
          {
            name: 'drivetime_threshold',
            config: {
              type: 'SliderControl',
              min: 0,
              max: 1,
              step: 0.1,
              default: 0.5,
              renderTrigger: false,
              label: t('Threshold'),
              description: t('Threshold for ratio of SA1 intersection with drivetime, i.e. a ratio of 0.5 excludes SA1s where less than 50% of their area intersect with the drivetime.'),
              visibility: ({ controls }) => Boolean(controls.features.value.includes('drivetime'))
            }
          }
        ],
        [
          {
            name: 'drivetime_border_color',
            config: {
              label: t('Border Color'),
              type: 'ColorPickerControl',
              renderTrigger: true,
              default: {
                r: 31,
                g: 168,
                b: 201,
                a: 100
              },
              visibility: ({ controls }) => Boolean(controls.features.value.includes('drivetime'))
            }
          },
          {
            name: 'drivetime_border_width',
            config: {
              type: 'TextControl',
              min: 0,
              validators: [validateNumber],
              renderTrigger: true,
              default: 0,
              label: t('Border Width'),
              visibility: ({ controls }) => Boolean(controls.features.value.includes('drivetime'))
            }
          }
        ],
        [
          {
            name: 'drivetime_linked_charts',
            config: {
              type: 'TextControl',
              renderTrigger: false,
              label: t('Chart IDs'),
              description: t('Comma separated list of chart IDs whose charts we want to update when drivetime updates.'),
              visibility: ({ controls }) => Boolean(controls.features.value.includes('drivetime'))
            }
          }
        ]
      ]
    },
    {
      label: t('Custom Data'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'custom_name',
            config: {
              type: 'TextControl',
              renderTrigger: false,
              label: t('Custom layer name'),
              default: ''
            }
          }
        ],
        [
          {
            name: 'custom_type',
            config: {
              type: 'SelectControl',
              renderTrigger: false,
              label: t('Data Source'),
              description: t('Custom layer is either from a mapbox tileset URL or an existing table.'),
              choices: [
                ['tileset', 'Tileset'],
                ['table', 'Table']
              ],
              placeholder: t('Select type') 
            }
          }
        ],
        [
          {
            name: 'custom_tileset',
            config: {
              type: 'TextControl',
              renderTrigger: false,
              label: t('Mapbox Tileset URL'),
              visibility: ({ controls }) => Boolean(controls?.custom_type.value === 'tileset')
            }
          }
        ],
        [
          {
            name: 'custom_database',
            config: {
              type: 'SelectAsyncControl',
              multi: false,
              label: t('Database'),
              dataEndpoint:
                '/api/v1/database',
              placeholder: t('Select database'),
              onAsyncErrorMessage: t('Error while fetching databases'),
              mutator: (data? : Data) => {
                if (!data || !data.result) {
                  return [];
                }
                return data.result.map(o => ({
                  value: o.id,
                  label: o.database_name,
                }));
              },
              visibility: ({ controls }) => Boolean(controls.custom_type.value === 'table')
            },
          },
        ],
        [
          {
            name: 'custom_schema',
            config: {
              type: 'SelectAsyncControl',
              multi: false,
              label: t('Schema'),
              placeholder: t('Select schema'),
              onAsyncErrorMessage: t('Error while fetching schemas'),
              mapStateToProps(state) {
                const db = state.controls.custom_database.value;
                if (typeof db === 'number') {
                  return {
                    dataEndpoint: `/api/v1/database/${db}/schemas`
                  }
                }
              },
              shouldMapStateToProps() {
                return true
              },
              mutator: (data?: Data) => {
                if (!data || !data.result) {
                  return [];
                }
                return data.result.map(o => ({
                  value: o,
                  label: o,
                }));
              },
              visibility: ({ controls }) => Boolean(typeof controls.custom_database.value === 'number')
            },
          },
        ],
        [
          {
            name: 'custom_table',
            config: {
              type: 'SelectAsyncControl',
              multi: false,
              label: t('Table'),
              placeholder: t('Select table'),
              onAsyncErrorMessage: t('Error while fetching tables'),
              mapStateToProps(state) {
                const db = state.controls.custom_database.value;
                const schema = state.controls.custom_schema.value;
                if ((typeof db === 'number') && (typeof schema === 'string')) {
                  return {
                    dataEndpoint: `/api/v1/database/${db}/tables/?q=(schema_name:${schema})`
                  }
                }
              },
              shouldMapStateToProps() {
                return true
              },
              mutator: (data?: Data) => {
                if (!data || !data.result) {
                  return [];
                }
                return data.result.map(o => ({
                  value: o.value,
                  label: o.value,
                }));
              },
              visibility: ({ controls }) => Boolean(typeof controls.custom_schema.value === 'string')
            },
          },
        ],
        [
          {
            name: 'custom_geom',
            config: {
              type: 'SelectControl',
              renderTrigger: false,
              label: t('Geometry type'),
              choices: [
                ['point', 'Point'],
                ['polygon', 'Polygon'],
                ['polyline', 'Polyline'],
                ['h3', 'H3']
              ],
              placeholder: t('Select geometry')
            }
          }
        ],
      ]
    },
    {
      label: t('Custom Style'),
      expanded: false,
      controlSetRows: [
        // Custom shape settings
        [
          {
            name: 'custom_shape',
            config: {
              label: t('Shape'),
              type: 'SelectControl',
              renderTrigger: false,
              choices: [
                ['circle', 'Circle'],
                ['square', 'Square'],
                ['star', 'Star'],
                ['pentagon', 'Pentagon'],
                ['triangle', 'Triangle']
              ],
              visibility: ({ controls }) => Boolean(controls.custom_geom.value === 'point')
            },
          }
        ],
        [
          {
            name: 'custom_color_attribute_check',
            config: {
              type: 'CheckboxControl',
              default: false,
              label: t('Color based on attribute?')
            }
          }
        ],
        // Custom color settings
        [
          {
            name: 'custom_color_attribute',
            config: {
              label: t('Color Attribute'),
              type: 'TextControl',
              renderTrigger: false,
              visibility: ({ controls }) => Boolean(controls.custom_color_attribute_check === true)
            }
          }
        ],
        [
          {
            name: 'custom_color',
            config: {
              label: t('Color'),
              type: 'ColorPickerControl',
              renderTrigger: true,
              default: {
                r: 31,
                g: 168,
                b: 201,
                a: 100
              },
              visibility: ({ controls }) => Boolean(!(controls.custom_color_attribute_check.value === true))
            }
          },
          {
            name: 'custom_color_scheme',
            config: {
              type: 'ColorSchemeControl',
              label: t('Linear Color Scheme'),
              choices: () =>
                (sequentialSchemeRegistry.values() as SequentialScheme[]).map(value => [
                  value.id,
                  value.label,
                ]),
              default: sequentialSchemeRegistry.getDefaultKey(),
              clearable: false,
              description: '',
              renderTrigger: true,
              schemes: () => sequentialSchemeRegistry.getMap(),
              isLinear: true,
              mapStateToProps: state => ({
                dashboardId: state?.form_data?.dashboardId,
              }),
              visibility: ({ controls }) => Boolean(controls.custom_color_attribute_check.value === true)
            }
          }
        ],
        [
          {
            name: 'custom_color_breaks_mode',
            config: {
              type: 'SelectControl',
              default: 'equal_count',
              choices: [
                ['custom', 'Custom'],
                ['equal_count', 'Equal Count (Quantile)'],
                ['equal_interval', 'Equal Interval'],
                ['categorized', 'Categorized']
              ],
              renderTrigger: false,
              label: t('Mode'),
              description: t('Method used for color styling in thematic.'),
              visibility: ({ controls }) => Boolean(controls.custom_color_attribute_check.value === true)
            }
          }
        ],
        [
          {
            name: 'custom_color_mode',
            config: {
              type: 'TextControl',
              renderTrigger: false,
              default: '',
              label: t('Custom Mode'),
              description: t('Specify a custom mode here for the number of classes, e.g. for 5 classes in custom mode would look something like 0,5,10,15,20,25 for breaks of 0-4, 5-9, 10-14, 15-19, 20+. Leave blank if specifying a mode above.'),
              visibility: ({ controls }) => Boolean(controls.custom_color_breaks_mode.value === 'custom') 
                && Boolean(controls.custom_color_attribute_check.value === true)
            }
          }
        ],
        [
          {
            name: 'custom_color_num_classes',
            config: {
              type: 'TextControl',
              isInt: true,
              default: 0,
              validators: [legacyValidateInteger],
              renderTrigger: false,
              label: t('Classes'),
              description: t('The number of breaks for the thematic'),
              visibility: ({ controls }) => Boolean(!(controls.custom_color_breaks_mode.value === 'categorized')) 
                && Boolean(controls.custom_color_attribute_check.value === true)
            },
          },
          {
            name: 'custom_color_opacity',
            config: {
              type: 'SliderControl',
              min: 0,
              max: 1,
              step: 0.1,
              default: 0.5,
              renderTrigger: true,
              label: t('Opacity'),
              description: t('Opacity of thematic'),
              visibility: ({ controls }) => Boolean(controls.custom_color_attribute_check.value === true)
            }
          }
        ],
        // Custom size settings
        [
          {
            name: 'custom_size_attribute_check',
            config: {
              type: 'CheckboxControl',
              default: false,
              label: t('Size based on attribute?'),
              visibility: ({ controls }) => Boolean(controls.custom_geom.value === 'point')
            }
          }
        ],
        [
          {
            name: 'custom_size_attribute',
            config: {
              label: t('Size Attribute'),
              type: 'TextControl',
              renderTrigger: false,
              visibility: ({ controls }) => Boolean(controls.custom_size_attribute_check === true)
            }
          }
        ],
        [
          {
            name: 'custom_size',
            config: {
              label: t('Size (px)'),
              type: 'TextControl',
              validators: [legacyValidateInteger],
              default: 25,
              renderTrigger: false,
              visibility: ({ controls }) => Boolean(controls.custom_geom.value === 'point'),
              shouldMapStateToProps() {
                return true;
              },
              mapStateToProps(state) {
                if (state.controls.custom_size_attribute_check.value === true) {
                  return {
                    label: t('Min Size (px)')
                  }
                }
              }
            }
          },
          {
            name: 'custom_size_multiplier',
            config: {
              label: t('Multiplier'),
              description: t('Size increase multiplier for each increase in class'),
              type: 'TextControl',
              renderTrigger: false,
              validators: [validateNumber],
              default: 2,
              visibility: ({ controls }) => Boolean(controls.custom_size_attribute_check.value === true),
            }
          }
        ],
        [
          {
            name: 'custom_size_breaks_mode',
            config: {
              type: 'SelectControl',
              default: 'equal_count',
              choices: [
                ['custom', 'Custom'],
                ['equal_count', 'Equal Count (Quantile)'],
                ['equal_interval', 'Equal Interval'],
                ['categorized', 'Categorized']
              ],
              renderTrigger: false,
              label: t('Mode'),
              description: t('Method used for color styling in thematic.'),
              visibility: ({ controls }) => Boolean(controls.custom_size_attribute_check.value === true)
            }
          }
        ],
        [
          {
            name: 'custom_size_mode',
            config: {
              type: 'TextControl',
              renderTrigger: false,
              default: '',
              label: t('Custom Mode'),
              description: t('Specify a custom mode here for the number of classes, e.g. for 5 classes in custom mode would look something like 0,5,10,15,20,25 for breaks of 0-4, 5-9, 10-14, 15-19, 20+. Leave blank if specifying a mode above.'),
              visibility: ({ controls }) => Boolean(controls.custom_size_breaks_mode.value === 'custom') 
                && Boolean(controls.custom_size_attribute_check.value === true)
            }
          }
        ],
        [
          {
            name: 'custom_size_num_classes',
            config: {
              type: 'TextControl',
              isInt: true,
              default: 0,
              validators: [legacyValidateInteger],
              renderTrigger: false,
              label: t('Classes'),
              description: t('The number of breaks for the thematic'),
              visibility: ({ controls }) => Boolean(!(controls.custom_size_breaks_mode.value === 'categorized')) 
                && Boolean(controls.custom_size_attribute_check.value === true)
            },
          },
        ]
      ]
    }
  ],
  controlOverrides: {
    linear_color_scheme: {
      renderTrigger: false,
      visibility: ({ controls }) => Boolean(controls.map_type.value.includes('thematic'))
    }
  }
};

export default config;
