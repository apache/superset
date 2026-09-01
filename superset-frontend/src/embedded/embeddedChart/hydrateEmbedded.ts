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
import { DataMaskWithId, JsonObject } from '@superset-ui/core';
import { chart } from 'src/components/Chart/chartReducer';
import { getInitialDataMask } from 'src/dataMask/reducer';
import { applyDefaultFormData } from 'src/explore/store';
import { CommonBootstrapData } from 'src/types/bootstrapTypes';
import { HYDRATE_DASHBOARD } from 'src/dashboard/actions/hydrate';

/**
 * A chart embedded on its own still renders through the dashboard's chart
 * stack, because that is where cross-filtering, drill, and the header controls
 * live. Rather than reimplement any of that, this builds the minimum slice of
 * dashboard state a single chart needs and lets the existing components run
 * against it unchanged.
 *
 * It reuses HYDRATE_DASHBOARD rather than introducing a parallel action, so
 * every dashboard reducer stays untouched: `charts`, `sliceEntities`,
 * `dataMask`, `dashboardInfo` and `dashboardState` all already handle it.
 * `datasources` is the one slice with no hydrate handler, so the caller
 * dispatches `setDatasources` for it separately.
 */

export interface EmbeddedChartData {
  slice: {
    slice_id: number;
    slice_url: string;
    slice_name: string;
    form_data: JsonObject & { viz_type: string; datasource: string };
    description?: string | null;
    description_markeddown?: string | null;
    modified?: string | null;
    changed_on?: string | number | null;
  };
  dataset: JsonObject & { uid: string };
}

export interface HydrateEmbeddedAction {
  type: typeof HYDRATE_DASHBOARD;
  data: {
    charts: Record<number, JsonObject>;
    sliceEntities: { slices: Record<number, JsonObject> };
    dataMask: Record<number, DataMaskWithId>;
    dashboardInfo: JsonObject;
    dashboardState: JsonObject;
  };
}

const hydrateEmbedded = (
  { slice }: EmbeddedChartData,
  common: CommonBootstrapData,
): HydrateEmbeddedAction => {
  const key = slice.slice_id;

  return {
    type: HYDRATE_DASHBOARD,
    data: {
      charts: {
        [key]: {
          ...chart,
          id: key,
          form_data: applyDefaultFormData(slice.form_data),
        },
      },
      sliceEntities: {
        slices: {
          [key]: {
            slice_id: key,
            slice_url: slice.slice_url,
            slice_name: slice.slice_name,
            form_data: slice.form_data,
            viz_type: slice.form_data.viz_type,
            datasource: slice.form_data.datasource,
            description: slice.description,
            description_markeddown: slice.description_markeddown,
            modified: slice.modified,
            changed_on: slice.changed_on
              ? new Date(slice.changed_on).getTime()
              : undefined,
          },
        },
      },
      dataMask: {
        [key]: getInitialDataMask(key) as DataMaskWithId,
      },
      dashboardInfo: {
        common,
        // A guest viewing an embedded chart has no Superset UI to navigate to,
        // so the actions that would leave the iframe stay off.
        metadata: {},
        superset_can_explore: false,
        superset_can_share: false,
        // Chart.tsx reads `superset_can_download`; `superset_can_csv` is not
        // a key the current dashboard chart stack looks at.
        superset_can_download: true,
        crossFiltersEnabled: false,
      },
      dashboardState: {
        expandedSlices: { [key]: false },
        sliceIds: [key],
      },
    },
  };
};

export default hydrateEmbedded;
