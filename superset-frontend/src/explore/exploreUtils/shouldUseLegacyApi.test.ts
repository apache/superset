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
import { getChartMetadataRegistry } from '@superset-ui/core';
import { getQuerySettings } from '.';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getChartMetadataRegistry: jest.fn(),
}));

const mockedGetChartMetadataRegistry = getChartMetadataRegistry as jest.Mock;

test('Should return false', () => {
  const get = jest.fn();
  mockedGetChartMetadataRegistry.mockReturnValue({ get } as any);
  expect(get).toHaveBeenCalledTimes(0);
  const [useLegacyApi] = getQuerySettings({ viz_type: 'name_test' });
  expect(useLegacyApi).toBe(false);
  expect(get).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith('name_test');
});

test('Should return true', () => {
  const get = jest.fn();
  get.mockReturnValue({ useLegacyApi: true });
  mockedGetChartMetadataRegistry.mockReturnValue({ get } as any);
  expect(get).toHaveBeenCalledTimes(0);
  const [useLegacyApi] = getQuerySettings({ viz_type: 'name_test' });
  expect(useLegacyApi).toBe(true);
  expect(get).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith('name_test');
});

test('Should return false when useLegacyApi:false', () => {
  const get = jest.fn();
  get.mockReturnValue({ useLegacyApi: false });
  mockedGetChartMetadataRegistry.mockReturnValue({ get } as any);
  expect(get).toHaveBeenCalledTimes(0);
  const [useLegacyApi] = getQuerySettings({ viz_type: 'name_test' });
  expect(useLegacyApi).toBe(false);
  expect(get).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith('name_test');
});
