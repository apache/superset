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
  buildQueryContext,
  QueryFormData,
  DrillDown,
  QueryFormOrderBy,
} from '@superset-ui/core';
import { OwnState } from './types';

export default function buildQuery(formData: QueryFormData, options: any) {
  const { metric, sort_by_metric, drillDown } = formData;

  return buildQueryContext(formData, baseQueryObject => {
    let queryObject = {
      ...baseQueryObject,
      ...(sort_by_metric && { orderby: [<QueryFormOrderBy>[metric, false]] }),
    };

    if (drillDown) {
      const groupby = <string[]>formData.groupby;
      const ownState = <OwnState>options.ownState || {
        drilldown: DrillDown.fromHierarchy(groupby),
      };
      queryObject = {
        ...queryObject,
        ...(drillDown && {
          groupby: [DrillDown.getColumn(ownState.drilldown, groupby)],
          filters: [
            ...(baseQueryObject.filters || []),
            ...DrillDown.getFilters(ownState.drilldown, groupby),
          ],
        }),
      };
    }

    return [queryObject];
  });
}
