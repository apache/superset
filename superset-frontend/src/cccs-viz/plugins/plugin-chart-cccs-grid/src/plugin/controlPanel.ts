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
  validateNonEmpty, FeatureFlag, isFeatureEnabled,
  QueryMode,
  QueryFormColumn,
} from '@superset-ui/core';
import {
  ControlConfig,
  ControlStateMapping,
  ControlPanelConfig,
  ControlPanelsContainerProps,
  sections,
  QueryModeLabel,
} from '@superset-ui/chart-controls';


//import cidrRegex from 'cidr-regex';



function getQueryMode(controls: ControlStateMapping): QueryMode {
  const mode = controls?.query_mode?.value;
  if (mode === QueryMode.aggregate || mode === QueryMode.raw) {
    return mode as QueryMode;
  }
  const rawColumns = controls?.all_columns?.value as QueryFormColumn[] | undefined;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.raw : QueryMode.aggregate;
}


/**
 * Visibility check
 */
 function isQueryMode(mode: QueryMode) {
  return ({ controls }: ControlPanelsContainerProps) => getQueryMode(controls) === mode;
}

const isAggMode = isQueryMode(QueryMode.aggregate);
const isRawMode = isQueryMode(QueryMode.raw);

const queryMode: ControlConfig<'RadioButtonControl'> = {
  type: 'RadioButtonControl',
  label: t('Query mode'),
  default: null,
  options: [
    [QueryMode.aggregate, QueryModeLabel[QueryMode.aggregate]],
    [QueryMode.raw, QueryModeLabel[QueryMode.raw]],
  ],
  mapStateToProps: ({ controls }) => ({ value: getQueryMode(controls) }),
};





// function isIP(v: unknown) {
//   if (typeof v === 'string' && v.trim().length > 0) {
//     //console.log(v.trim());
//     // Test IP
//     if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v.trim())) {
//       return true;
//     }
//     // Test CIDR
//     return cidrRegex({ exact: true }).test(v.trim());
//   }
//   return false;
// }

// function validateIP(v: unknown) {

//   if (Array.isArray(v)) {
//     //console.log('is array');
//     if (v.every(isIP)) {
//       return false;
//     }
//   }
//   else {
//     if (isIP(v)) {
//       return false;
//     }
//   }

//   return (' is expected to be an IP address in dotted decimal or CIDR notation');
// }

// /**
//  * Validates the adhoc filter control. Each filter has a subject (the column name for example SRC_PORT) and a comparator (the value being tested),
//  * it can be a single value for operators like !=, >, <= etc
//  * or it can be an array of values for example when the IN or NOT IN operator is used.
//  *
//  * @param filters an array of adhoc filter with the following attributes
//  * @param state the current state of the adhoc filter control it includes a copy of the columns as defined in the dataset model
//  * @returns a string explaining the reason why the control is in an invalid state or false if there is no errors
//  */
// function adhocFilterValidator(filters: unknown, state: ControlState) {
//   if (Array.isArray(filters)) {
//     for (let i = 0; i < filters.length; i++) {
//       const filter = filters[i];
//       // Find the corresponding column in the model
//       const column = state.columns.find((c: any) => c.column_name == filter.subject);
//       if (typeof column !== 'undefined' && typeof column.type !== 'undefined') {
//         // Currently supporting 2 types of columns
//         // IPV4
//         // IPV4 FILTER
//         if (column.type.includes('IPV4')) {
//           const v = filter.comparator;
//           // check single value
//           if (typeof v === 'string' && v.trim().length > 0) {
//             const error = validateIP(v.trim());
//             if (error) {
//               return filter.subject + error;
//             }
//           }
//           // check array of values
//           else if (Array.isArray(v)) {
//             for (let index = 0; index < v.length; index++) {
//               const element = v[index];
//               const error = validateIP(element.trim());
//               if (error) {
//                 return filter.subject + error;
//               }
//             }
//           }
//         }
//         // else we assume the value is okay
//         // more type validators can be added here
//       }
//     }
//   }
//   return false;
// }

const config: ControlPanelConfig = {
  // For control input types, see: superset-frontend/src/explore/components/controls/index.js
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'query_mode',
            config: queryMode,
          },
        ],

        [
          {
            name: 'metrics',
            override: {
              validators: [],
              visibility: isAggMode,
            },
          },
        ],

        [
          {
            name: 'groupby',
            override: {
              visibility: isAggMode,
            },
          },
        ],

        [
          {
            name: 'columns',
            override: {
              visibility: isRawMode,
            },
          },
        ],

        [
          {
            name: 'order_by_cols',
            config: {
              type: 'SelectControl',
              label: t('Ordering'),
              description: t('Order results by selected columns'),
              multi: true,
              default: [],
              mapStateToProps: ({ datasource }) => ({
                choices: datasource?.order_by_choices || [],
              }),
              visibility: isRawMode,
            },
          },
        ],

        [
          {
            name: 'adhoc_filters',
            override: {
              // validators: [adhocFilterValidator],
            }
          }
        ],
        [
          {
            name: 'row_limit',
            override: {
              default: 100,
            },
          },

        ],
      ],

    },
    {
      label: t('Hello Controls!'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'header_text',
            config: {
              type: 'TextControl',
              default: 'Hello, World!',
              renderTrigger: true,
              // ^ this makes it apply instantaneously, without triggering a "run query" button
              label: t('Header Text'),
              description: t('The text you want to see in the header'),
            },
          },
        ],
        [
          {
            name: 'bold_text',
            config: {
              type: 'CheckboxControl',
              label: t('Bold Text'),
              renderTrigger: true,
              default: true,
              description: t('A checkbox to make the '),
            },
          },
        ],
        isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)
        ? [
            {
              name: 'emit_filter',
              config: {
                type: 'CheckboxControl',
                label: t('Enable emitting filters'),
                default: true,
                renderTrigger: true,
                description: t('Enable emmiting filters.'),
              },
            },
          ] : []
        ,
        [
          {
            name: 'header_font_size',
            config: {
              type: 'SelectControl',
              label: t('Font Size'),
              default: 'xl',
              choices: [
                // [value, label]
                ['xxs', 'xx-small'],
                ['xs', 'x-small'],
                ['s', 'small'],
                ['m', 'medium'],
                ['l', 'large'],
                ['xl', 'x-large'],
                ['xxl', 'xx-large'],
              ],
              renderTrigger: true,
              description: t('The size of your header font'),
            },
          },
        ],
      ],
    },
  ],

  // override controls that are inherited by the default configuration
  controlOverrides: {
    series: {
      validators: [validateNonEmpty],
      clearable: false,
    },
    viz_type: {
      default: 'cccs_grid'
    },
    time_range: {
      default: t('Last day'),
    },
  },
};

export default config;
