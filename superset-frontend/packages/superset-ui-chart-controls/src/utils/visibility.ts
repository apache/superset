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

import { ensureIsArray, GenericDataType } from '@superset-ui/core';

export enum VisibilityRuleType {
  XTEMPORAL = 'XAxisTemporal',
}

export function isSectionVisible(rule: VisibilityRuleType, exploreState: any) {
  switch (rule) {
    case VisibilityRuleType.XTEMPORAL: {
      if (exploreState?.datasource && exploreState?.form_data) {
        const { datasource, form_data } = exploreState;

        if (form_data?.x_axis) {
          const xAxis = ensureIsArray(form_data?.x_axis)[0];
          const column = ensureIsArray(datasource.columns).find(
            (col: { column_name: string }) => col?.column_name === xAxis,
          );
          if (column?.type_generic !== GenericDataType.TEMPORAL) {
            return false;
          }
        }
      }
      return true;
    }
    default:
      return true;
  }
}
