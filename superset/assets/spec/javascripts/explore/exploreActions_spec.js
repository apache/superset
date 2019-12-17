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
/* eslint-disable no-unused-expressions */
import { defaultState } from '../../../src/explore/store';
import exploreReducer from '../../../src/explore/reducers/exploreReducer';
import * as actions from '../../../src/explore/actions/exploreActions';

describe('reducers', () => {
  it('sets correct control value given a key and value', () => {
    const newState = exploreReducer(
      defaultState,
      actions.setControlValue('x_axis_label', 'x', []),
    );
    expect(newState.controls.x_axis_label.value).toBe('x');
  });
  it('setControlValue works as expected with a checkbox', () => {
    const newState = exploreReducer(
      defaultState,
      actions.setControlValue('show_legend', true, []),
    );
    expect(newState.controls.show_legend.value).toBe(true);
  });
});
