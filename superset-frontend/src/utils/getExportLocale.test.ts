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
import { getUrlParam } from 'src/utils/urlUtils';
import { getExportLocale } from './getExportLocale';

jest.mock('src/utils/urlUtils', () => ({
  getUrlParam: jest.fn(),
}));

const getUrlParamMock = getUrlParam as jest.Mock;

test('returns locale from URL when present', () => {
  getUrlParamMock.mockReturnValue('de_DE');
  expect(getExportLocale()).toBe('de_DE');
});

test('returns undefined when locale param is absent', () => {
  getUrlParamMock.mockReturnValue(null);
  expect(getExportLocale()).toBeUndefined();
});
