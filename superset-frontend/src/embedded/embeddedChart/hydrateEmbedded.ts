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
import { DataMaskWithId } from '@superset-ui/core';
import { keyBy } from 'lodash';
import { chart } from 'src/components/Chart/chartReducer';
import { getInitialDataMask } from 'src/dataMask/reducer';
import { applyDefaultFormData } from 'src/explore/store';
import { CommonBootstrapData } from 'src/types/bootstrapTypes';

export const HYDRATE_EMBEDDED = 'HYDRATE_EMBEDDED';

// Define proper interfaces for our objects
interface ChartQueries {
  [key: number]: {
    id: number;
    form_data: any;
  };
}

interface Slices {
  [key: number]: {
    slice_id: number;
    slice_url: string;
    slice_name: string;
    form_data: any;
    viz_type: string;
    datasource: any;
    description: string;
    description_markeddown: string;
    owners: any[];
    modified: string;
    changed_on: number;
  };
}

interface DataMask {
  [key: number]: DataMaskWithId;
}

interface ExploreData {
  slice: {
    slice_id: number;
    slice_url: string;
    slice_name: string;
    form_data: {
      viz_type: string;
      datasource: any;
      [key: string]: any;
    };
    description: string;
    description_markeddown: string;
    owners: any[];
    modified: string;
    changed_on: string;
  };
  dataset: {
    uid: string;
    [key: string]: any;
  };
}

export interface HydrateEmbeddedAction {
  type: typeof HYDRATE_EMBEDDED;
  data: {
    charts: ChartQueries;
    datasources: Record<string, any>;
    sliceEntities: {
      slices: Slices;
    };
    dataMask: DataMask;
    dashboardInfo: {
      common: CommonBootstrapData;
      superset_can_explore: boolean;
      superset_can_share: boolean;
      suerset_can_csv: boolean;
      crossFiltersEnabled: boolean;
    };
    dashboardState: {
      expandedSlices: {
        [sliceId: number]: boolean;
      };
    };
  };
}

const hydrateEmbedded = (
  exploreData: ExploreData,
  common: CommonBootstrapData,
): HydrateEmbeddedAction => {
  const chartQueries: ChartQueries = {};
  const slices: Slices = {};
  const { slice } = exploreData;
  const key = slice.slice_id;
  const formData = {
    ...slice.form_data,
  };
  const cleanStateForDataMask: DataMask = {};

  cleanStateForDataMask[key] = {
    ...(getInitialDataMask(key) as DataMaskWithId),
  };

  chartQueries[key] = {
    ...chart,
    id: key,
    form_data: applyDefaultFormData(formData),
  };

  slices[key] = {
    slice_id: key,
    slice_url: slice.slice_url,
    slice_name: slice.slice_name,
    form_data: slice.form_data,
    viz_type: slice.form_data.viz_type,
    datasource: slice.form_data.datasource,
    description: slice.description,
    description_markeddown: slice.description_markeddown,
    owners: slice.owners,
    modified: slice.modified,
    changed_on: new Date(slice.changed_on).getTime(),
  };

  const datasourceObj = [exploreData.dataset];
  const modifiedDs = keyBy(datasourceObj, 'uid');

  return {
    type: HYDRATE_EMBEDDED,
    data: {
      charts: chartQueries,
      datasources: modifiedDs,
      sliceEntities: { slices },
      dataMask: cleanStateForDataMask,
      dashboardInfo: {
        common,
        superset_can_explore: true,
        superset_can_share: false,
        suerset_can_csv: true,
        crossFiltersEnabled: false,
      },
      dashboardState: {
        expandedSlices: {
          [key]: false,
        },
      },
    },
  };
};

export default hydrateEmbedded;
