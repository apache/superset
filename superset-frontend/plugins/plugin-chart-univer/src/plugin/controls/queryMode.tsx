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
  ControlConfig,
  ControlSetItem,
  QueryModeLabel,
} from '@superset-ui/chart-controls';
import { QueryMode } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { getQueryMode, PIVOT_MODE } from './shared';

const queryMode: ControlConfig<'RadioButtonControl'> = {
  type: 'RadioButtonControl',
  label: t('Query mode'),
  default: null,
  options: [
    [QueryMode.Aggregate, QueryModeLabel[QueryMode.Aggregate]],
    [QueryMode.Raw, QueryModeLabel[QueryMode.Raw]],
    [PIVOT_MODE, t('Pivot')],
  ],
  mapStateToProps: ({ controls }) => ({ value: getQueryMode(controls) }),
  rerender: [
    'all_columns',
    'groupby',
    'metrics',
    'univer_pivot_rows',
    'univer_pivot_columns',
  ],
};

export const queryModeControlSetItem: ControlSetItem = {
  name: 'query_mode',
  config: queryMode,
};
