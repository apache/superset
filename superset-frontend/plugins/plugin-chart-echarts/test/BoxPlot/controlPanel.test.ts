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
import { validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelState,
  ControlState,
  Dataset,
  TestDataset,
} from '@superset-ui/chart-controls';
import controlPanel from '../../src/BoxPlot/controlPanel';

const getColumnsInitialValue = (datasource: Dataset) => {
  const initialValue = controlPanel.controlOverrides?.columns
    ?.initialValue as unknown as (
    control: ControlState,
    state: ControlPanelState | null,
  ) => unknown;

  return initialValue(
    { value: [] } as unknown as ControlState,
    {
      datasource,
    } as ControlPanelState,
  );
};

test('columns defaults to the default temporal column of the datasource', () => {
  expect(getColumnsInitialValue(TestDataset)).toEqual(['ds']);
});

test('columns stays empty when the datasource has no temporal column', () => {
  const value = getColumnsInitialValue({
    ...TestDataset,
    columns: [],
    main_dttm_col: undefined,
  } as unknown as Dataset);

  expect(value).toEqual([]);
  // an empty value must be flagged as required rather than silently accepted
  expect(validateNonEmpty(value)).toBeTruthy();
});
