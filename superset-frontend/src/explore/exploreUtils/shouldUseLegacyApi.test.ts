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
import * as Core from '@superset-ui/core';
import { shouldUseLegacyApi } from '.';

test('Should return false', () => {
  const spy = jest.spyOn(Core, 'getChartMetadataRegistry');
  const get = jest.fn();
  spy.mockReturnValue({ get } as any);
  expect(get).toBeCalledTimes(0);
  expect(shouldUseLegacyApi({ viz_type: 'name_test' })).toBe(false);
  expect(get).toBeCalledTimes(1);
  expect(get).toBeCalledWith('name_test');
});

test('Should return true', () => {
  const spy = jest.spyOn(Core, 'getChartMetadataRegistry');
  const get = jest.fn();
  get.mockReturnValue({ useLegacyApi: true });
  spy.mockReturnValue({ get } as any);
  expect(get).toBeCalledTimes(0);
  expect(shouldUseLegacyApi({ viz_type: 'name_test' })).toBe(true);
  expect(get).toBeCalledTimes(1);
  expect(get).toBeCalledWith('name_test');
});

test('Should return false when useLegacyApi:false', () => {
  const spy = jest.spyOn(Core, 'getChartMetadataRegistry');
  const get = jest.fn();
  get.mockReturnValue({ useLegacyApi: false });
  spy.mockReturnValue({ get } as any);
  expect(get).toBeCalledTimes(0);
  expect(shouldUseLegacyApi({ viz_type: 'name_test' })).toBe(false);
  expect(get).toBeCalledTimes(1);
  expect(get).toBeCalledWith('name_test');
});
