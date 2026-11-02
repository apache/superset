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

import type { Page } from '@playwright/test';
import { apiCreateStubSemanticView } from './semanticLayer';
import { apiDelete, apiGet, apiPost } from './requests';

jest.mock('@playwright/test', () => ({ test: { skip: jest.fn() } }));
jest.mock('./requests', () => ({
  apiDelete: jest.fn(),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

const post = apiPost as jest.Mock;
const get = apiGet as jest.Mock;
const remove = apiDelete as jest.Mock;
const page = {} as Page;

test.each([
  ['view creation fails', false, false],
  ['datasource lookup fails', true, false],
  ['cleanup also fails', false, true],
])(
  'preserves the request error and attempts cleanup when %s',
  async (_, viewCreated, cleanupFails) => {
    const failure = new Error('request failed');
    post.mockReset();
    get.mockReset();
    remove.mockReset();
    post.mockResolvedValueOnce({
      json: async () => ({ result: { uuid: 'layer-1' } }),
    });
    if (viewCreated) {
      post.mockResolvedValueOnce({
        json: async () => ({ result: { created: [{ uuid: 'view-1' }] } }),
      });
      get.mockRejectedValueOnce(failure);
    } else {
      post.mockRejectedValueOnce(failure);
    }
    if (cleanupFails) {
      remove.mockRejectedValueOnce(new Error('cleanup failed'));
    }

    await expect(apiCreateStubSemanticView(page, 'test')).rejects.toBe(failure);
    expect(remove).toHaveBeenCalledWith(page, 'api/v1/semantic_layer/layer-1');
  },
);
