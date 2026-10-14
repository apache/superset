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
  ControlPanelState,
  ControlSetItem,
  ControlState,
  sharedControls,
} from '@superset-ui/chart-controls';
import { ensureIsArray } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { isPivotMode } from './shared';

export const PIVOT_ROWS = 'univer_pivot_rows';
export const PIVOT_COLUMNS = 'univer_pivot_columns';
export const PIVOT_TOTALS = 'univer_pivot_totals';

export const pivotRowsControlSetItem: ControlSetItem = {
  name: PIVOT_ROWS,
  config: {
    ...sharedControls.groupby,
    label: t('Rows'),
    description: t('Columns to group by on the rows'),
    visibility: isPivotMode,
    resetOnHide: false,
    mapStateToProps: (state: ControlPanelState, controlState: ControlState) => {
      const newState =
        sharedControls.groupby.mapStateToProps?.(state, controlState) ?? {};
      newState.externalValidationErrors =
        isPivotMode(state) && !ensureIsArray(controlState?.value).length
          ? [t('Pivot needs at least one row')]
          : [];
      return newState;
    },
  },
};

export const pivotColumnsControlSetItem: ControlSetItem = {
  name: PIVOT_COLUMNS,
  config: {
    ...sharedControls.groupby,
    label: t('Columns'),
    description: t('Columns to group by on the columns'),
    visibility: isPivotMode,
    resetOnHide: false,
  },
};

export const pivotTotalsControlSetItem: ControlSetItem = {
  name: PIVOT_TOTALS,
  config: {
    type: 'CheckboxControl',
    label: t('Show totals'),
    description: t(
      'Add a Total row and a Total column for each metric. Totals add up the values in the table.',
    ),
    default: true,
    visibility: isPivotMode,
    resetOnHide: false,
  },
};
