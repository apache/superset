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
import { startUploadDataModalTour } from './uploadDataModalTour';

const mockDrive = jest.fn();
const mockDriver = jest.fn<{ drive: jest.Mock }, [Record<string, unknown>]>(
  () => ({
    drive: mockDrive,
  }),
);

jest.mock('driver.js', () => ({
  driver: (config: Record<string, unknown>) => mockDriver(config),
}));

// Suppress CSS import in tests
jest.mock('driver.js/dist/driver.css', () => ({}));

beforeEach(() => {
  jest.clearAllMocks();
});

function getDriverConfig(): Record<string, unknown> {
  expect(mockDriver).toHaveBeenCalled();
  const call = mockDriver.mock.calls[0] as unknown[];
  return call[0] as Record<string, unknown>;
}

test('startUploadDataModalTour calls driver with correct config for CSV', () => {
  startUploadDataModalTour('csv');

  expect(mockDriver).toHaveBeenCalledTimes(1);
  const config = getDriverConfig();
  expect(config.animate).toBe(false);
  expect(config.showProgress).toBe(true);
  expect(config.showButtons).toEqual(['next', 'previous', 'close']);
  const steps = config.steps as Array<{ element: string }>;
  expect(steps).toHaveLength(5);
  expect(steps[0].element).toBe(
    '[data-tour="upload-modal-csv"] [data-tour="upload-file-dropzone-csv"]',
  );
  expect(steps[4].element).toBe(
    '[data-tour="upload-modal-csv"] [data-tour="upload-submit-button-csv"]',
  );
  expect(mockDrive).toHaveBeenCalledTimes(1);
});

test('startUploadDataModalTour calls driver with correct selectors for Excel', () => {
  startUploadDataModalTour('excel');

  const config = getDriverConfig();
  const steps = config.steps as Array<{ element: string }>;
  expect(steps[0].element).toBe(
    '[data-tour="upload-modal-excel"] [data-tour="upload-file-dropzone-excel"]',
  );
  expect(steps[4].element).toBe(
    '[data-tour="upload-modal-excel"] [data-tour="upload-submit-button-excel"]',
  );
});

test('startUploadDataModalTour calls driver with correct selectors for columnar', () => {
  startUploadDataModalTour('columnar');

  const config = getDriverConfig();
  const steps = config.steps as Array<{ element: string }>;
  expect(steps[0].element).toBe(
    '[data-tour="upload-modal-columnar"] [data-tour="upload-file-dropzone-columnar"]',
  );
  expect(steps[4].element).toBe(
    '[data-tour="upload-modal-columnar"] [data-tour="upload-submit-button-columnar"]',
  );
});

test('startUploadDataModalTour steps have expected popover structure', () => {
  startUploadDataModalTour('csv');

  const config = getDriverConfig();
  const expectedTitles = [
    'Upload your file',
    'Preview columns',
    'Select database',
    'Table name',
    'Upload',
  ];
  const steps = config.steps as Array<{
    popover: { title: string; description?: string };
  }>;
  steps.forEach((step, idx) => {
    expect(step.popover).toBeDefined();
    expect(step.popover.title).toBe(expectedTitles[idx]);
    expect(step.popover.description).toBeDefined();
    expect(typeof step.popover.description).toBe('string');
  });
});

test('startUploadDataModalTour includes all five tour steps with correct element targets', () => {
  startUploadDataModalTour('csv');

  const config = getDriverConfig();
  const expectedTargets = [
    'upload-file-dropzone-csv',
    'upload-preview-csv',
    'upload-database-csv',
    'upload-table-name-csv',
    'upload-submit-button-csv',
  ];
  const steps = config.steps as Array<{ element: string }>;
  steps.forEach((step, idx) => {
    expect(step.element).toContain(expectedTargets[idx]);
  });
});
