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
import { debounce } from 'lodash';
import { Dispatch } from 'react';
import {
  setFocusedNativeFilter,
  unsetFocusedNativeFilter,
  setHoveredNativeFilter,
  unsetHoveredNativeFilter,
} from 'src/dashboard/actions/nativeFilters';
import { FAST_DEBOUNCE } from 'src/constants';

export const dispatchHoverAction = debounce(
  (dispatch: Dispatch<any>, id?: string) => {
    if (id) {
      dispatch(setHoveredNativeFilter(id));
    } else {
      dispatch(unsetHoveredNativeFilter());
    }
  },
  FAST_DEBOUNCE,
);

export const dispatchFocusAction = debounce(
  (dispatch: Dispatch<any>, id?: string) => {
    if (id) {
      dispatch(setFocusedNativeFilter(id));
    } else {
      dispatch(unsetFocusedNativeFilter());
    }
  },
  FAST_DEBOUNCE,
);
