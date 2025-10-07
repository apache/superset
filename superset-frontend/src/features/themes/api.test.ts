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
import fetchMock from 'fetch-mock';
import {
  setSystemDefaultTheme,
  setSystemDarkTheme,
  unsetSystemDefaultTheme,
  unsetSystemDarkTheme,
} from './api';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('Theme API', () => {
  beforeEach(() => {
    fetchMock.reset();
  });

  afterEach(() => {
    fetchMock.restore();
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('setSystemDefaultTheme', () => {
    test('should call the correct endpoint with theme id', async () => {
      const mockResponse = { id: 1, result: 'success' };
      fetchMock.put('glob:*/api/v1/theme/1/set_system_default', mockResponse);

      await setSystemDefaultTheme(1);

      expect(fetchMock.called('glob:*/api/v1/theme/1/set_system_default')).toBe(
        true,
      );
    });

    test('should handle errors properly', async () => {
      fetchMock.put('glob:*/api/v1/theme/1/set_system_default', {
        throws: new Error('API Error'),
      });

      await expect(setSystemDefaultTheme(1)).rejects.toThrow('API Error');
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('setSystemDarkTheme', () => {
    test('should call the correct endpoint with theme id', async () => {
      const mockResponse = { id: 2, result: 'success' };
      fetchMock.put('glob:*/api/v1/theme/2/set_system_dark', mockResponse);

      await setSystemDarkTheme(2);

      expect(fetchMock.called('glob:*/api/v1/theme/2/set_system_dark')).toBe(
        true,
      );
    });

    test('should handle errors properly', async () => {
      fetchMock.put('glob:*/api/v1/theme/2/set_system_dark', {
        throws: new Error('API Error'),
      });

      await expect(setSystemDarkTheme(2)).rejects.toThrow('API Error');
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('unsetSystemDefaultTheme', () => {
    test('should call the correct endpoint', async () => {
      const mockResponse = { result: 'success' };
      fetchMock.delete(
        'glob:*/api/v1/theme/unset_system_default',
        mockResponse,
      );

      await unsetSystemDefaultTheme();

      expect(fetchMock.called('glob:*/api/v1/theme/unset_system_default')).toBe(
        true,
      );
    });

    test('should handle errors properly', async () => {
      fetchMock.delete('glob:*/api/v1/theme/unset_system_default', {
        throws: new Error('API Error'),
      });

      await expect(unsetSystemDefaultTheme()).rejects.toThrow('API Error');
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('unsetSystemDarkTheme', () => {
    test('should call the correct endpoint', async () => {
      const mockResponse = { result: 'success' };
      fetchMock.delete('glob:*/api/v1/theme/unset_system_dark', mockResponse);

      await unsetSystemDarkTheme();

      expect(fetchMock.called('glob:*/api/v1/theme/unset_system_dark')).toBe(
        true,
      );
    });

    test('should handle errors properly', async () => {
      fetchMock.delete('glob:*/api/v1/theme/unset_system_dark', {
        throws: new Error('API Error'),
      });

      await expect(unsetSystemDarkTheme()).rejects.toThrow('API Error');
    });
  });
});
