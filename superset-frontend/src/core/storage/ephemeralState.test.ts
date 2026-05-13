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
import { createEphemeralState } from './ephemeralState';

jest.mock('@superset-ui/core', () => ({
  SupersetClient: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const EXT_ID = 'acme.dashboard';
const BASE = '/api/v1/extensions/acme/dashboard/storage/ephemeral';

describe('createEphemeralState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('user-scoped operations', () => {
    it('gets a value via GET', async () => {
      (SupersetClient.get as jest.Mock).mockResolvedValueOnce({
        json: { result: { pct: 42 } },
      });
      const api = createEphemeralState(EXT_ID);
      const result = await api.get('job_progress');
      expect(SupersetClient.get).toHaveBeenCalledWith({
        endpoint: `${BASE}/job_progress`,
      });
      expect(result).toEqual({ pct: 42 });
    });

    it('returns null when result is missing', async () => {
      (SupersetClient.get as jest.Mock).mockResolvedValueOnce({ json: {} });
      const api = createEphemeralState(EXT_ID);
      const result = await api.get('missing');
      expect(result).toBeNull();
    });

    it('sets a value via PUT', async () => {
      (SupersetClient.put as jest.Mock).mockResolvedValueOnce({});
      const api = createEphemeralState(EXT_ID);
      await api.set('job_progress', { pct: 100 });
      expect(SupersetClient.put).toHaveBeenCalledWith({
        endpoint: `${BASE}/job_progress`,
        body: JSON.stringify({ value: { pct: 100 } }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('sets a value with TTL', async () => {
      (SupersetClient.put as jest.Mock).mockResolvedValueOnce({});
      const api = createEphemeralState(EXT_ID);
      await api.set('cache', 'data', { ttl: 300 });
      expect(SupersetClient.put).toHaveBeenCalledWith({
        endpoint: `${BASE}/cache`,
        body: JSON.stringify({ value: 'data', ttl: 300 }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('removes a value via DELETE', async () => {
      (SupersetClient.delete as jest.Mock).mockResolvedValueOnce({});
      const api = createEphemeralState(EXT_ID);
      await api.remove('job_progress');
      expect(SupersetClient.delete).toHaveBeenCalledWith({
        endpoint: `${BASE}/job_progress`,
      });
    });
  });

  describe('shared operations', () => {
    it('gets a shared value with ?shared=true', async () => {
      (SupersetClient.get as jest.Mock).mockResolvedValueOnce({
        json: { result: [1, 2, 3] },
      });
      const api = createEphemeralState(EXT_ID);
      const result = await api.shared.get('shared_result');
      expect(SupersetClient.get).toHaveBeenCalledWith({
        endpoint: `${BASE}/shared_result?shared=true`,
      });
      expect(result).toEqual([1, 2, 3]);
    });

    it('sets a shared value with ?shared=true', async () => {
      (SupersetClient.put as jest.Mock).mockResolvedValueOnce({});
      const api = createEphemeralState(EXT_ID);
      await api.shared.set('config', { v: 1 });
      expect(SupersetClient.put).toHaveBeenCalledWith({
        endpoint: `${BASE}/config?shared=true`,
        body: JSON.stringify({ value: { v: 1 } }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('removes a shared value', async () => {
      (SupersetClient.delete as jest.Mock).mockResolvedValueOnce({});
      const api = createEphemeralState(EXT_ID);
      await api.shared.remove('config');
      expect(SupersetClient.delete).toHaveBeenCalledWith({
        endpoint: `${BASE}/config?shared=true`,
      });
    });
  });

  describe('URL encoding', () => {
    it('encodes special characters in keys', async () => {
      (SupersetClient.get as jest.Mock).mockResolvedValueOnce({
        json: { result: 'ok' },
      });
      const api = createEphemeralState(EXT_ID);
      await api.get('key/with spaces&special=chars');
      expect(SupersetClient.get).toHaveBeenCalledWith({
        endpoint: `${BASE}/${encodeURIComponent('key/with spaces&special=chars')}`,
      });
    });

    it('encodes special characters in publisher/name', async () => {
      (SupersetClient.get as jest.Mock).mockResolvedValueOnce({
        json: { result: 'ok' },
      });
      const api = createEphemeralState('org name.ext name');
      await api.get('key');
      expect(SupersetClient.get).toHaveBeenCalledWith({
        endpoint: `/api/v1/extensions/${encodeURIComponent('org name')}/${encodeURIComponent('ext name')}/storage/ephemeral/key`,
      });
    });
  });

  describe('validation', () => {
    it('throws for extensionId without a dot separator', () => {
      expect(() => {
        const api = createEphemeralState('nodot');
        // buildUrl is called lazily — trigger it
        api.get('key');
      }).rejects.toThrow('expected format "publisher.name"');
    });
  });
});
