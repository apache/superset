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
import { DrillDownLevel } from './types';

interface DrillDownChartState {
  stack: DrillDownLevel[];
  selectedLeaf?: string;
}

interface DrillDownState {
  [chartId: number]: DrillDownChartState;
}

const initialState: DrillDownState = {};

const drillDownSlice = createSlice({
  name: 'drillDown',
  initialState,
  reducers: {
    pushDrillLevel(
      state,
      action: PayloadAction<{ chartId: number; level: DrillDownLevel }>,
    ) {
      const { chartId, level } = action.payload;
      if (!state[chartId]) {
        state[chartId] = { stack: [] };
      }
      state[chartId].stack.push(level);
      state[chartId].selectedLeaf = undefined;
    },
    resetDrillTo(
      state,
      action: PayloadAction<{ chartId: number; depth: number }>,
    ) {
      const { chartId, depth } = action.payload;
      if (state[chartId]) {
        state[chartId].stack = state[chartId].stack.slice(0, depth);
        state[chartId].selectedLeaf = undefined;
      }
    },
    setDrillLeaf(
      state,
      action: PayloadAction<{ chartId: number; leaf?: string }>,
    ) {
      const { chartId, leaf } = action.payload;
      if (!state[chartId]) {
        state[chartId] = { stack: [] };
      }
      state[chartId].selectedLeaf = leaf;
    },
    clearDrill(state, action: PayloadAction<{ chartId: number }>) {
      delete state[action.payload.chartId];
    },
  },
});

export const { pushDrillLevel, resetDrillTo, setDrillLeaf, clearDrill } =
  drillDownSlice.actions;
export default drillDownSlice.reducer;
