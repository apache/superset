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
import {
  ColumnMeta,
  ControlStateMapping,
  ControlPanelSectionConfig,
  ControlPanelState,
  ControlState,
  ControlConfig,
  getTemporalColumns,
  sharedControls,
} from '@superset-ui/chart-controls';
import { TREE_QUERY_MODE } from '../queryMode';
import { SERVER_PAGE_SIZE_OPTIONS } from '../consts';
import levelsToMirrors from './levelsToMirrors';
import { TreeLevel } from './types';
import { validateLevelColumns, validateLevels } from './validateLevels';

const isTreeMode = (state: ControlPanelState) =>
  (state.controls?.query_mode?.value ?? state.form_data?.query_mode) ===
  TREE_QUERY_MODE;

export const treeServerPageLength: ControlConfig<'SelectControl'> = {
  type: 'SelectControl',
  label: t('Page length'),
  description: t('Rows per page. Viewers can change it under the table.'),
  choices: SERVER_PAGE_SIZE_OPTIONS,
  freeForm: false,
  clearable: false,
  mapStateToProps: state => ({ default: isTreeMode(state) ? 50 : undefined }),
  visibility: ({ controls }) => controls?.query_mode?.value === TREE_QUERY_MODE,
  resetOnHide: false,
};

export function mapLevelsStateToProps(
  state: ControlPanelState,
  controlState: ControlState,
) {
  if (!isTreeMode(state)) return { externalValidationErrors: [] };
  const { datasource, form_data } = state;
  const datasourceColumns = (datasource?.columns ?? []).map(
    column =>
      (column as ColumnMeta).column_name ?? (column as { name: string }).name,
  );
  return {
    datasourceColumns,
    columnOptions:
      sharedControls.groupby.mapStateToProps?.(state, controlState).options ??
      [],
    temporalOptions: getTemporalColumns(datasource).temporalColumns,
    formMirrors: {
      tree_columns: form_data?.tree_columns,
      tree_metrics: form_data?.tree_metrics,
      tree_orderby: form_data?.tree_orderby,
    },
    externalValidationErrors: [
      validateLevels(controlState.value as TreeLevel[] | undefined),
      validateLevelColumns(controlState.value as TreeLevel[] | undefined, {
        datasourceColumns,
      }),
    ].filter(
      (error): error is string => typeof error === 'string' && error.length > 0,
    ),
  };
}

const hiddenMirror = (name: string) => ({
  name,
  config: { type: 'HiddenControl' as const, hidden: true },
});

export function treeModeOnInit(
  controls: ControlStateMapping,
): ControlStateMapping {
  if (controls.query_mode?.value !== TREE_QUERY_MODE) return controls;
  const mirrors = levelsToMirrors(
    (controls.levels?.value as TreeLevel[] | undefined) ?? [],
  );
  return {
    ...controls,
    ...Object.fromEntries(
      Object.entries(mirrors).map(([name, value]) => [
        name,
        { ...controls[name], value },
      ]),
    ),
  };
}

export const treeLevelsSection: ControlPanelSectionConfig = {
  label: t('Levels'),
  description: t(
    'All levels come from this dataset. Each child row is linked to its parent. Parent columns must be the same on every row. Child level columns must be the same on every dataset row for one child ID; otherwise the count and Load more can disagree.',
  ),
  expanded: true,
  controlSetRows: [
    [
      {
        name: 'levels',
        config: {
          type: 'LevelsControl',
          initialLevels: [
            {
              key: 'level-1',
              name: '',
              id_column: '',
              columns: [],
              detail_fields: [],
            },
            {
              key: 'level-2',
              name: '',
              id_column: '',
              columns: [],
              detail_fields: [],
              children_shown: 100,
              apply_date_filter: false,
            },
          ],
          shouldMapStateToProps: (_previous, state) => isTreeMode(state),
          mapStateToProps: mapLevelsStateToProps,
          validators: [],
          mirrorsOf: levelsToMirrors,
        },
      },
    ],
    [hiddenMirror('tree_columns')],
    [hiddenMirror('tree_metrics')],
    [hiddenMirror('tree_orderby')],
  ],
};
