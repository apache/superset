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

import exploreReducer from './exploreReducer';
import { setStashFormData, setControlValue } from '../actions/exploreActions';

test('reset hiddenFormData on SET_STASH_FORM_DATA', () => {
  const initialState = {
    form_data: { a: 3, c: 4 },
  };
  const action = setStashFormData(true, ['a', 'c']);
  const newState = exploreReducer(initialState, action);
  expect(newState.form_data).toEqual({});
  expect(newState.hiddenFormData).toEqual({ a: 3, c: 4 });
  const restoreAction = setStashFormData(false, ['c']);
  const newState2 = exploreReducer(newState, restoreAction);
  expect(newState2.form_data).toEqual({ c: 4 });
  expect(newState2.hiddenFormData).toEqual({ a: 3 });
});

test('skips updates when the field is already updated on SET_STASH_FORM_DATA', () => {
  const initialState = {
    form_data: { a: 3, c: 4 },
    hiddenFormData: { b: 2 },
  };
  const restoreAction = setStashFormData(false, ['c', 'd']);
  const newState = exploreReducer(initialState, restoreAction);
  expect(newState).toBe(initialState);
});

test('normalizes server_page_length from string to number on SET_FIELD_VALUE', () => {
  const initialState = {
    form_data: { viz_type: 'table' },
    controls: {},
  };
  
  const action = setControlValue('server_page_length', '100');
  const newState = exploreReducer(initialState, action);
  
  expect(newState.form_data.server_page_length).toBe(100);
  expect(typeof newState.form_data.server_page_length).toBe('number');
});

test('preserves server_page_length when already numeric', () => {
  const initialState = {
    form_data: { viz_type: 'table' },
    controls: {},
  };
  
  const action = setControlValue('server_page_length', 100);
  const newState = exploreReducer(initialState, action);
  
  expect(newState.form_data.server_page_length).toBe(100);
});

test('does not normalize other string control values', () => {
  const initialState = {
    form_data: { viz_type: 'table' },
    controls: {},
  };
  
  const action = setControlValue('row_limit', '50');
  const newState = exploreReducer(initialState, action);
  
  expect(newState.form_data.row_limit).toBe('50');
});

test('normalizes server_page_length from string "0" to number 0', () => {
  const initialState = {
    form_data: { viz_type: 'table' },
    controls: {},
  };

  const action = setControlValue('server_page_length', '0');
  const newState = exploreReducer(initialState, action);

  expect(newState.form_data.server_page_length).toBe(0);
  expect(typeof newState.form_data.server_page_length).toBe('number');
});

test('preserves empty string for server_page_length for validation', () => {
  const initialState = {
    form_data: { viz_type: 'table' },
    controls: {},
  };

  const action = setControlValue('server_page_length', '');
  const newState = exploreReducer(initialState, action);

  expect(newState.form_data.server_page_length).toBe('');
  expect(typeof newState.form_data.server_page_length).toBe('string');
});

test('preserves whitespace-only string for server_page_length for validation', () => {
  const initialState = {
    form_data: { viz_type: 'table' },
    controls: {},
  };

  const action = setControlValue('server_page_length', '   ');
  const newState = exploreReducer(initialState, action);

  expect(newState.form_data.server_page_length).toBe('   ');
  expect(typeof newState.form_data.server_page_length).toBe('string');
});

test('preserves invalid string for server_page_length for validation', () => {
  const initialState = {
    form_data: { viz_type: 'table' },
    controls: {},
  };

  const action = setControlValue('server_page_length', 'abc');
  const newState = exploreReducer(initialState, action);

  expect(newState.form_data.server_page_length).toBe('abc');
  expect(typeof newState.form_data.server_page_length).toBe('string');
});

test('preserves decimal string for server_page_length for validation', () => {
  const initialState = {
    form_data: { viz_type: 'table' },
    controls: {},
  };

  const action = setControlValue('server_page_length', '10.5');
  const newState = exploreReducer(initialState, action);

  expect(newState.form_data.server_page_length).toBe('10.5');
  expect(typeof newState.form_data.server_page_length).toBe('string');
});
