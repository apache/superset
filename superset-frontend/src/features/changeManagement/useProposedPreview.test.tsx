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
import { renderHook } from '@testing-library/react';
import { createWrapper } from 'spec/helpers/testing-library';
import { useProposedPreview } from './useProposedPreview';
import type { ChangeRequest } from './types';

const baseRequest = {
  id: 1,
  asset_type: 'dashboard',
  asset_id: 5,
  status: 'pending',
  operation: 'update',
  command: null,
  proposed: { dashboard_title: 'New' },
} as unknown as ChangeRequest;

const setup = (overrides: Partial<ChangeRequest>) =>
  renderHook(() => useProposedPreview({ ...baseRequest, ...overrides }), {
    wrapper: createWrapper({ useRedux: true, useRouter: true }),
  });

test('can preview the main dashboard update', () => {
  expect(setup({}).result.current.canPreview).toBe(true);
});

test.each(['filters', 'colors', 'chart_customizations'])(
  'cannot overlay a %s change onto the dashboard',
  command => {
    expect(setup({ command }).result.current.canPreview).toBe(false);
  },
);
