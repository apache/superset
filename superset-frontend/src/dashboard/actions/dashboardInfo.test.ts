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
import { SupersetClient } from '@superset-ui/core';
import { RootState } from 'src/dashboard/types';
import {
  dashboardSaveSucceeded,
  saveChartConfiguration,
  SAVE_CHART_CONFIG_COMPLETE,
  SAVE_CHART_CONFIG_FAIL,
} from './dashboardInfo';

afterEach(() => jest.restoreAllMocks());

const getState = () =>
  ({ dashboardInfo: { id: 1, metadata: {} } }) as RootState;

test('successful cross-filter scoping save refreshes dashboard version history', async () => {
  const request = jest.spyOn(SupersetClient, 'request').mockResolvedValue(
    new Response(
      JSON.stringify({
        result: { json_metadata: '{}' },
        last_modified_time: 123,
      }),
      { status: 200 },
    ),
  );
  const dispatch = jest.fn();

  await saveChartConfiguration({})(dispatch, getState);

  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: 'PUT',
      endpoint: '/api/v1/dashboard/1',
    }),
  );
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: SAVE_CHART_CONFIG_COMPLETE }),
  );
  expect(dispatch).toHaveBeenCalledWith(dashboardSaveSucceeded(1));
});

test('failed cross-filter scoping save does not refresh dashboard version history', async () => {
  jest
    .spyOn(SupersetClient, 'request')
    .mockRejectedValue(new Error('save failed'));
  const dispatch = jest.fn();

  await saveChartConfiguration({})(dispatch, getState);

  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: SAVE_CHART_CONFIG_FAIL }),
  );
  expect(dispatch).not.toHaveBeenCalledWith(dashboardSaveSucceeded(1));
});
