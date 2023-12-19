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
    owners: string;
    status: string;
    search: string;
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
    owners: '',
    status: '',
    search: '',
  }
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
  },
});

export const { dvtSidebarReportsSetProperty, dvtSidebarAlertsSetProperty } = dvtSidebarSlice.actions;

export default dvtSidebarSlice.reducer;
