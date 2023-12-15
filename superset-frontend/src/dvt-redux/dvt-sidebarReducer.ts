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
    reports: { owner: string; createdBy: string; chartType: string; dataset: string; dashboards: string; favorite: string; certified: string };
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
};

const dvtSidebarSlice = createSlice({
    name: 'dvt-sidebar',
    initialState,
    reducers: {
        dvtSidebarReportsSetProperty: (state, action: PayloadAction<{ property: 'owner' | 'createdBy' | 'chartType' | 'dataset' | 'dashboards' | 'favorite' | 'certified'; value: string }>) => {
            const { property, value } = action.payload;
            return {
                ...state,
                reports: {
                    ...state.reports,
                    [property]: value,
                },
            };
        },
    },
});

export const { dvtSidebarReportsSetProperty } = dvtSidebarSlice.actions;

export default dvtSidebarSlice.reducer;
