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
  ControlPanelsContainerProps,
  ControlStateMapping,
} from '@superset-ui/chart-controls';
import { ensureIsArray, QueryFormColumn, QueryMode } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';

/** Pivot mode: the query result pivoted on the backend, see buildQuery */
export const PIVOT_MODE = 'pivot';

export type UniverQueryMode = QueryMode | typeof PIVOT_MODE;

export function getQueryMode(controls: ControlStateMapping): UniverQueryMode {
  const mode = controls?.query_mode?.value;
  if (
    mode === QueryMode.Aggregate ||
    mode === QueryMode.Raw ||
    mode === PIVOT_MODE
  ) {
    return mode as UniverQueryMode;
  }
  const rawColumns = controls?.all_columns?.value as
    | QueryFormColumn[]
    | undefined;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.Raw : QueryMode.Aggregate;
}

/**
 * Visibility check
 */
export function isQueryMode(mode: UniverQueryMode) {
  return ({ controls }: Pick<ControlPanelsContainerProps, 'controls'>) =>
    getQueryMode(controls) === mode;
}

export const isAggMode = isQueryMode(QueryMode.Aggregate);
export const isRawMode = isQueryMode(QueryMode.Raw);
export const isPivotMode = isQueryMode(PIVOT_MODE);
export const isAggOrPivotMode = ({
  controls,
}: Pick<ControlPanelsContainerProps, 'controls'>) =>
  isAggMode({ controls }) || isPivotMode({ controls });

export const validateAggControlValues = (
  controls: ControlStateMapping,
  values: any[],
) => {
  const areControlsEmpty = values.every(val => ensureIsArray(val).length === 0);
  return areControlsEmpty && isAggMode({ controls })
    ? [t('Group By or Metrics must have a value')]
    : [];
};
