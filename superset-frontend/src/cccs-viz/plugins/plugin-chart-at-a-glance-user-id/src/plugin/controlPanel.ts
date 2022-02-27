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
  FeatureFlag,
  isFeatureEnabled,
  QueryMode,
  QueryFormColumn,
  ensureIsArray,
  validateNonEmpty,
} from '@superset-ui/core';
import {
  ControlConfig,
  ControlStateMapping,
  ControlPanelConfig,
  ControlPanelsContainerProps,
  sections,
  QueryModeLabel,
  sharedControls,
  ControlPanelState,
  ControlState,
} from '@superset-ui/chart-controls';

function getQueryMode(controls: ControlStateMapping): QueryMode {
  const mode = controls?.query_mode?.value;
  if (mode === QueryMode.aggregate || mode === QueryMode.raw) {
    return mode as QueryMode;
  }
  const rawColumns = controls?.all_columns?.value as
    | QueryFormColumn[]
    | undefined;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.raw : QueryMode.aggregate;
}

/**
 * Visibility check
 */
function isQueryMode(mode: QueryMode) {
  return ({ controls }: ControlPanelsContainerProps) =>
    getQueryMode(controls) === mode;
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
  rerender: ['columns', 'groupby', 'metrics'],
};

const validateAggControlValues = (
  controls: ControlStateMapping,
  values: any[],
) => {
  const areControlsEmpty = values.every(val => ensureIsArray(val).length === 0);
  // @ts-ignore
  return areControlsEmpty && isAggMode({ controls })
    ? [t('Metrics or Group By must have a value')]
    : [];
};

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
            name: 'groupby',
            override: {
              visibility: isAggMode,
              mapStateToProps: (
                state: ControlPanelState,
                controlState: ControlState,
              ) => {
                const { controls } = state;
                const originalMapStateToProps =
                  sharedControls?.groupby?.mapStateToProps;
                const newState =
                  originalMapStateToProps?.(state, controlState) ?? {};
                newState.externalValidationErrors = validateAggControlValues(
                  controls,
                  [controls.metrics?.value, controlState.value],
                );
                return newState;
              },
              rerender: ['metrics'],
            },
          },
        ],
        [
          {
            name: 'metrics',
            override: {
              visibility: isAggMode,
              validators: [],
              mapStateToProps: (
                state: ControlPanelState,
                controlState: ControlState,
              ) => {
                const { controls } = state;
                const originalMapStateToProps =
                  sharedControls?.metrics?.mapStateToProps;
                const newState =
                  originalMapStateToProps?.(state, controlState) ?? {};
                newState.externalValidationErrors = validateAggControlValues(
                  controls,
                  [controls.groupby?.value, controlState.value],
                );
                return newState;
              },
              rerender: ['groupby'],
            },
          },
        ],
        [
          {
            name: 'columns',
            override: {
              visibility: isRawMode,
              mapStateToProps: (
                state: ControlPanelState,
                controlState: ControlState,
              ) => {
                const originalMapStateToProps =
                  sharedControls?.columns?.mapStateToProps;
                const newState =
                  originalMapStateToProps?.(state, controlState) ?? {};
                // @ts-ignore
                newState.externalValidationErrors =
                  ensureIsArray(controlState.value).length === 0
                    ? [t('This component must have a value.')]
                    : [];
                return newState;
              },
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
        ['adhoc_filters'],
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
      label: t('IP dashboard link configuration'),
      expanded: true,
      tabOverride: 'data',
      controlSetRows: [
        [
          {
            name: 'ipDashBoardBaseUrl',
            config: {
              type: 'TextControl',
              label: t('Base URL for superset'),
              renderTrigger: true,
              description: t('The URL for superset that you wish to link to (ex. superset.com).'),
            },
          }
        ],
        [
          {
            name: 'ipDashboardId',
            config: {
              type: 'TextControl',
              label: t('IP dasboard ID'),
              renderTrigger: true,
              description: t('The ID for the dashboard which you wish to link to.'),
            },
          },
        ],
        [
          {
            name: 'ipDashboardFilterId',
            config: {
              type: 'TextControl',
              label: t('Filter ID for IP dashboard'),
              renderTrigger: true,
              description: t('The filter ID you wish to be prepopulated with an IP upon clicking the link.'),
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
      default: 'cccs_grid',
    },
    time_range: {
      default: t('Last day'),
    },
  },
};

// CLDN-941: Only show the CUSTOMIZE tab if DASHBOARD_CROSS_FILTERS are enabled in the system.
// When more customization is added in the future this code can be removed and the code above
// can be re-enabled.
if (isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)) {
  config.controlPanelSections.push({
    label: t('CCCS Grid Options'),
    expanded: true,
    controlSetRows: [
      [
        {
          name: 'table_filter',
          config: {
            type: 'CheckboxControl',
            label: t('Enable emitting filters'),
            default: false,
            renderTrigger: true,
            description: t(
              'Whether to apply filter to dashboards when grid cells are clicked.',
            ),
          },
        },
      ],
    ],
  });
}

export default config;
