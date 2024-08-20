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
  ControlSetItem,
  ExtraControlProps,
  sharedControls,
  Dataset,
  ColumnMeta,
} from '@superset-ui/chart-controls';
import { ensureIsArray, t } from '@superset-ui/core';
import { getQueryMode, isRawMode } from './shared';

const dndAllColumns: typeof sharedControls.groupby = {
  type: 'DndColumnSelect',
  label: t('Columns'),
  description: t('Columns to display'),
  default: [],
  mapStateToProps({ datasource, controls }, controlState) {
    const newState: ExtraControlProps = {};
    if (datasource) {
      if (datasource?.columns[0]?.hasOwnProperty('filterable')) {
        newState.options = (datasource as Dataset)?.columns?.filter(
          (c: ColumnMeta) => c.filterable,
        );
      } else newState.options = datasource.columns;
    }
    newState.queryMode = getQueryMode(controls);
    newState.externalValidationErrors =
      isRawMode({ controls }) && ensureIsArray(controlState?.value).length === 0
        ? [t('must have a value')]
        : [];
    return newState;
  },
  visibility: isRawMode,
  resetOnHide: false,
};

export const allColumnsControlSetItem: ControlSetItem = {
  name: 'all_columns',
  config: dndAllColumns,
};
