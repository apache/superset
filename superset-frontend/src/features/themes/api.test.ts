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
import SupersetClient from '@superset-ui/core/connection/SupersetClient';
import {
  setSystemDefaultTheme,
  setSystemDarkTheme,
  unsetSystemDefaultTheme,
  unsetSystemDarkTheme,
} from './api';

// Mock SupersetClient
jest.mock('@superset-ui/core/connection/SupersetClient', () => ({
  __esModule: true,
  default: {
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Theme API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setSystemDefaultTheme', () => {
    it('should call the correct endpoint with theme id', async () => {
      const mockResponse = { json: { id: 1, result: 'success' } };
      (SupersetClient.put as jest.Mock).mockResolvedValue(mockResponse);

      const result = await setSystemDefaultTheme(1);

      expect(SupersetClient.put).toHaveBeenCalledWith({
        endpoint: '/api/v1/theme/1/set_system_default',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors properly', async () => {
      const error = new Error('API Error');
      (SupersetClient.put as jest.Mock).mockRejectedValue(error);

      await expect(setSystemDefaultTheme(1)).rejects.toThrow('API Error');
    });
  });

  describe('setSystemDarkTheme', () => {
    it('should call the correct endpoint with theme id', async () => {
      const mockResponse = { json: { id: 2, result: 'success' } };
      (SupersetClient.put as jest.Mock).mockResolvedValue(mockResponse);

      const result = await setSystemDarkTheme(2);

      expect(SupersetClient.put).toHaveBeenCalledWith({
        endpoint: '/api/v1/theme/2/set_system_dark',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors properly', async () => {
      const error = new Error('API Error');
      (SupersetClient.put as jest.Mock).mockRejectedValue(error);

      await expect(setSystemDarkTheme(2)).rejects.toThrow('API Error');
    });
  });

  describe('unsetSystemDefaultTheme', () => {
    it('should call the correct endpoint', async () => {
      const mockResponse = { json: { result: 'success' } };
      (SupersetClient.delete as jest.Mock).mockResolvedValue(mockResponse);

      const result = await unsetSystemDefaultTheme();

      expect(SupersetClient.delete).toHaveBeenCalledWith({
        endpoint: '/api/v1/theme/unset_system_default',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors properly', async () => {
      const error = new Error('API Error');
      (SupersetClient.delete as jest.Mock).mockRejectedValue(error);

      await expect(unsetSystemDefaultTheme()).rejects.toThrow('API Error');
    });
  });

  describe('unsetSystemDarkTheme', () => {
    it('should call the correct endpoint', async () => {
      const mockResponse = { json: { result: 'success' } };
      (SupersetClient.delete as jest.Mock).mockResolvedValue(mockResponse);

      const result = await unsetSystemDarkTheme();

      expect(SupersetClient.delete).toHaveBeenCalledWith({
        endpoint: '/api/v1/theme/unset_system_dark',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors properly', async () => {
      const error = new Error('API Error');
      (SupersetClient.delete as jest.Mock).mockRejectedValue(error);

      await expect(unsetSystemDarkTheme()).rejects.toThrow('API Error');
    });
  });
});
