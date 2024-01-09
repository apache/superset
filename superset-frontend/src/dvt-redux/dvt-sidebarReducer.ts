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
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface DvtSidebarState {
  reports: {
    owner: string;
    createdBy: string;
    chartType: string;
    dataset: string;
    dashboards: string;
    favorite: string;
    certified: string;
  };

  alerts: {
    createdBy: string;
    owner: string;
    status: string;
    search: string;
  };

  connection: {
    expose_in_sqllab: string;
    allow_run_async: string;
    search: string;
  };

  datasets: {
    owner: string;
    database: string;
    schema: string;
    type: string;
    certified: string;
  };

  chartAdd: {
    dataset: string;
    recommended_tags: string;
    category: string;
    tags: string;
  };
}

const initialState: DvtSidebarState = {
  reports: {
    owner: '',
    createdBy: '',
    chartType: '',
    dataset: '',
    dashboards: '',
    favorite: '',
    certified: '',
  },
  alerts: {
    createdBy: '',
    owner: '',
    status: '',
    search: '',
  },
  connection: {
    expose_in_sqllab: '',
    allow_run_async: '',
    search: '',
  },
  datasets: {
    owner: '',
    database: '',
    schema: '',
    type: '',
    certified: '',
  },
  chartAdd: {
    dataset: '',
    recommended_tags: '',
    category: '',
    tags: '',
  },
};

const dvtSidebarSlice = createSlice({
  name: 'dvt-sidebar',
  initialState,
  reducers: {
    dvtSidebarReportsSetProperty: (
      state,
      action: PayloadAction<{ reports: DvtSidebarState['reports'] }>,
    ) => ({
      ...state,
      reports: {
        ...state.reports,
        ...action.payload.reports,
      },
    }),
    dvtSidebarAlertsSetProperty: (
      state,
      action: PayloadAction<{ alerts: DvtSidebarState['alerts'] }>,
    ) => ({
      ...state,
      alerts: {
        ...state.alerts,
        ...action.payload.alerts,
      },
    }),
    dvtSidebarConnectionSetProperty: (
      state,
      action: PayloadAction<{ connection: DvtSidebarState['connection'] }>,
    ) => ({
      ...state,
      connection: {
        ...state.connection,
        ...action.payload.connection,
      },
    }),
    dvtSidebarDatasetsSetProperty: (
      state,
      action: PayloadAction<{ datasets: DvtSidebarState['datasets'] }>,
    ) => ({
      ...state,
      datasets: {
        ...state.datasets,
        ...action.payload.datasets,
      },
    }),
    dvtSidebarChartAddSetProperty: (
      state,
      action: PayloadAction<{ chartAdd: DvtSidebarState['chartAdd'] }>,
    ) => ({
      ...state,
      chartAdd: {
        ...state.connection,
        ...action.payload.chartAdd,
      },
    }),
  },
});

export const {
  dvtSidebarReportsSetProperty,
  dvtSidebarAlertsSetProperty,
  dvtSidebarConnectionSetProperty,
  dvtSidebarDatasetsSetProperty,
  dvtSidebarChartAddSetProperty,
} = dvtSidebarSlice.actions;

export default dvtSidebarSlice.reducer;
