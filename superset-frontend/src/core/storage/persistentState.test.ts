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
import { createPersistentState } from './persistentState';

jest.mock('@superset-ui/core', () => ({
  SupersetClient: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const EXT_ID = 'acme.dashboard';
const BASE = '/api/v1/extensions/acme/dashboard/storage/persistent';

describe('createPersistentState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('user-scoped operations', () => {
    it('gets a value via GET', async () => {
      (SupersetClient.get as jest.Mock).mockResolvedValueOnce({
        json: { result: { theme: 'dark' } },
      });
      const api = createPersistentState(EXT_ID);
      const result = await api.get('preferences');
      expect(SupersetClient.get).toHaveBeenCalledWith({
        endpoint: `${BASE}/preferences`,
      });
      expect(result).toEqual({ theme: 'dark' });
    });

    it('returns null when result is missing', async () => {
      (SupersetClient.get as jest.Mock).mockResolvedValueOnce({ json: {} });
      const api = createPersistentState(EXT_ID);
      const result = await api.get('missing');
      expect(result).toBeNull();
    });

    it('sets a value via PUT', async () => {
      (SupersetClient.put as jest.Mock).mockResolvedValueOnce({});
      const api = createPersistentState(EXT_ID);
      await api.set('preferences', { theme: 'dark', locale: 'en' });
      expect(SupersetClient.put).toHaveBeenCalledWith({
        endpoint: `${BASE}/preferences`,
        body: JSON.stringify({ value: { theme: 'dark', locale: 'en' } }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('removes a value via DELETE', async () => {
      (SupersetClient.delete as jest.Mock).mockResolvedValueOnce({});
      const api = createPersistentState(EXT_ID);
      await api.remove('preferences');
      expect(SupersetClient.delete).toHaveBeenCalledWith({
        endpoint: `${BASE}/preferences`,
      });
    });
  });

  describe('shared operations', () => {
    it('gets a shared value with ?shared=true', async () => {
      (SupersetClient.get as jest.Mock).mockResolvedValueOnce({
        json: { result: { version: 2 } },
      });
      const api = createPersistentState(EXT_ID);
      const result = await api.shared.get('global_config');
      expect(SupersetClient.get).toHaveBeenCalledWith({
        endpoint: `${BASE}/global_config?shared=true`,
      });
      expect(result).toEqual({ version: 2 });
    });

    it('sets a shared value with ?shared=true', async () => {
      (SupersetClient.put as jest.Mock).mockResolvedValueOnce({});
      const api = createPersistentState(EXT_ID);
      await api.shared.set('global_config', { version: 3 });
      expect(SupersetClient.put).toHaveBeenCalledWith({
        endpoint: `${BASE}/global_config?shared=true`,
        body: JSON.stringify({ value: { version: 3 } }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('removes a shared value', async () => {
      (SupersetClient.delete as jest.Mock).mockResolvedValueOnce({});
      const api = createPersistentState(EXT_ID);
      await api.shared.remove('global_config');
      expect(SupersetClient.delete).toHaveBeenCalledWith({
        endpoint: `${BASE}/global_config?shared=true`,
      });
    });
  });

  describe('URL encoding', () => {
    it('encodes special characters in keys', async () => {
      (SupersetClient.get as jest.Mock).mockResolvedValueOnce({
        json: { result: 'ok' },
      });
      const api = createPersistentState(EXT_ID);
      await api.get('key/with spaces&special=chars');
      expect(SupersetClient.get).toHaveBeenCalledWith({
        endpoint: `${BASE}/${encodeURIComponent('key/with spaces&special=chars')}`,
      });
    });

    it('encodes special characters in publisher/name', async () => {
      (SupersetClient.get as jest.Mock).mockResolvedValueOnce({
        json: { result: 'ok' },
      });
      const api = createPersistentState('org name.ext name');
      await api.get('key');
      expect(SupersetClient.get).toHaveBeenCalledWith({
        endpoint: `/api/v1/extensions/${encodeURIComponent('org name')}/${encodeURIComponent('ext name')}/storage/persistent/key`,
      });
    });
  });

  describe('validation', () => {
    it('throws for key exceeding 255 characters', () => {
      const api = createPersistentState(EXT_ID);
      const longKey = 'x'.repeat(256);
      expect(api.get(longKey)).rejects.toThrow(
        'Persistent storage key must be 255 characters or less',
      );
    });

    it('accepts key at exactly 255 characters', async () => {
      (SupersetClient.get as jest.Mock).mockResolvedValueOnce({
        json: { result: 'ok' },
      });
      const api = createPersistentState(EXT_ID);
      const exactKey = 'x'.repeat(255);
      await api.get(exactKey);
      expect(SupersetClient.get).toHaveBeenCalled();
    });

    it('throws for extensionId without a dot separator', () => {
      expect(() => {
        const api = createPersistentState('nodot');
        api.get('key');
      }).rejects.toThrow('expected format "publisher.name"');
    });
  });
});
