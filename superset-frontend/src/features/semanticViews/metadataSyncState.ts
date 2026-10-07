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

export type MetadataSyncState = Record<string, string>;

const initialState: MetadataSyncState = {};

const metadataSyncSlice = createSlice({
  name: 'semanticMetadataSync',
  initialState,
  reducers: {
    markUnconfirmed(
      state,
      { payload }: PayloadAction<{ uuid: string; message: string }>,
    ) {
      state[payload.uuid] = payload.message;
    },
    confirmReload(state, { payload }: PayloadAction<string>) {
      delete state[payload];
    },
  },
});

export const { markUnconfirmed, confirmReload } = metadataSyncSlice.actions;
export default metadataSyncSlice.reducer;
