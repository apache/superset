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
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { Modal } from '@superset-ui/core/components';
import {
  DOWNLOAD_REASON_PARAM,
  requestDownloadReason,
  withDownloadReason,
} from './downloadReason';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('@superset-ui/core/components', () => ({
  ...jest.requireActual('@superset-ui/core/components'),
  Modal: { confirm: jest.fn() },
}));

const mockFeatureEnabled = isFeatureEnabled as jest.Mock;
const mockConfirm = Modal.confirm as jest.Mock;

beforeEach(() => {
  mockFeatureEnabled.mockReset();
  mockConfirm.mockReset();
});

test('resolves with an empty reason and no dialog when the flag is off', async () => {
  mockFeatureEnabled.mockReturnValue(false);
  await expect(requestDownloadReason()).resolves.toBe('');
  expect(mockFeatureEnabled).toHaveBeenCalledWith(
    FeatureFlag.RequireDownloadReason,
  );
  expect(mockConfirm).not.toHaveBeenCalled();
});

test('asks for a reason and resolves with the trimmed value', async () => {
  mockFeatureEnabled.mockReturnValue(true);
  const promise = requestDownloadReason();
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  const config = mockConfirm.mock.calls[0][0];
  config.content.props.onChange({ target: { value: '  WP-1 audit  ' } });
  await config.onOk();
  await expect(promise).resolves.toBe('WP-1 audit');
});

test('keeps the dialog open when the reason is blank', async () => {
  mockFeatureEnabled.mockReturnValue(true);
  requestDownloadReason();
  const config = mockConfirm.mock.calls[0][0];
  config.content.props.onChange({ target: { value: '   ' } });
  await expect(config.onOk()).rejects.toThrow();
});

test('resolves with null when the dialog is cancelled', async () => {
  mockFeatureEnabled.mockReturnValue(true);
  const promise = requestDownloadReason();
  mockConfirm.mock.calls[0][0].onCancel();
  await expect(promise).resolves.toBeNull();
});

test('withDownloadReason appends the encoded reason', () => {
  expect(withDownloadReason('/api/v1/chart/data', '')).toBe(
    '/api/v1/chart/data',
  );
  expect(withDownloadReason('/api/v1/chart/data', 'a b&c')).toBe(
    `/api/v1/chart/data?${DOWNLOAD_REASON_PARAM}=a%20b%26c`,
  );
  expect(withDownloadReason('/x?format=csv', 'r')).toBe(
    `/x?format=csv&${DOWNLOAD_REASON_PARAM}=r`,
  );
});
