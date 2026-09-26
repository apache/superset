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
import type { ReactElement } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { Modal } from '@superset-ui/core/components';
import {
  DOWNLOAD_REASON_PARAM,
  isDownloadReasonRequired,
  requestDownloadReason,
  withDownloadReason,
} from './downloadReason';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockFeatureEnabled = isFeatureEnabled as jest.Mock;
const mockConfirm = jest.spyOn(Modal, 'confirm');

type ReasonInputProps = { onChange: (value: string) => void };

/** The dialog config passed to Modal.confirm on the last call. */
const lastConfig = () => {
  expect(mockConfirm).toHaveBeenCalled();
  const [[config]] = mockConfirm.mock.calls;
  return config;
};

const typeReason = (value: string) =>
  (lastConfig().content as ReactElement<ReasonInputProps>).props.onChange(
    value,
  );

beforeEach(() => {
  mockFeatureEnabled.mockReset();
  mockConfirm.mockReset();
  mockConfirm.mockImplementation(
    () => ({ destroy: jest.fn(), update: jest.fn() }) as never,
  );
});

test('isDownloadReasonRequired mirrors the feature flag', () => {
  mockFeatureEnabled.mockReturnValue(true);
  expect(isDownloadReasonRequired()).toBe(true);
  mockFeatureEnabled.mockReturnValue(false);
  expect(isDownloadReasonRequired()).toBe(false);
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
  typeReason('  WP-1 audit  ');
  await lastConfig().onOk?.();
  await expect(promise).resolves.toBe('WP-1 audit');
});

test('keeps the dialog open when the reason is blank', async () => {
  mockFeatureEnabled.mockReturnValue(true);
  requestDownloadReason();
  typeReason('   ');
  await expect(lastConfig().onOk?.()).rejects.toThrow(
    'A download reason is required',
  );
});

test('shows the validation message inline when the reason is blank', async () => {
  mockFeatureEnabled.mockReturnValue(true);
  requestDownloadReason();
  render(lastConfig().content as ReactElement);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await expect(lastConfig().onOk?.()).rejects.toThrow();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'A download reason is required',
  );
});

test('resolves with null when the dialog is cancelled', async () => {
  mockFeatureEnabled.mockReturnValue(true);
  const promise = requestDownloadReason();
  lastConfig().onCancel?.();
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
