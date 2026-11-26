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
import {
  getTourTargetSelector,
  getUploadDataModalTourSteps,
  type UploadType,
} from './uploadDataModalTour';

afterEach(() => {
  document.body.innerHTML = '';
});

const TARGETS = [
  'file-dropzone',
  'preview',
  'database',
  'table-name',
  'submit-button',
] as const;

test('tour has five steps with titles and descriptions in order', () => {
  const steps = getUploadDataModalTourSteps('csv');

  expect(steps.map(step => step.title)).toEqual([
    'Upload your file',
    'Preview columns',
    'Select database',
    'Table name',
    'Upload',
  ]);
  steps.forEach(step => {
    expect(typeof step.description).toBe('string');
    expect(step.description).not.toBe('');
  });
});

test.each<UploadType>(['csv', 'excel', 'columnar'])(
  'getTourTargetSelector scopes %s targets to its upload modal',
  type => {
    expect(getTourTargetSelector(type, 'file-dropzone')).toBe(
      `[data-tour="upload-modal-${type}"] [data-tour="upload-file-dropzone-${type}"]`,
    );
  },
);

test('each step targets the matching element inside the right modal', () => {
  const otherModal = document.createElement('div');
  otherModal.setAttribute('data-tour', 'upload-modal-excel');
  otherModal.innerHTML = `<div data-tour="upload-file-dropzone-excel"></div>`;
  const modal = document.createElement('div');
  modal.setAttribute('data-tour', 'upload-modal-csv');
  modal.innerHTML = TARGETS.map(
    target => `<div data-tour="upload-${target}-csv"></div>`,
  ).join('');
  document.body.append(otherModal, modal);

  const steps = getUploadDataModalTourSteps('csv');

  steps.forEach((step, idx) => {
    const element = (step.target as () => HTMLElement | null)();
    expect(element).not.toBeNull();
    expect(element?.getAttribute('data-tour')).toBe(
      `upload-${TARGETS[idx]}-csv`,
    );
    expect(modal.contains(element)).toBe(true);
  });
});

test('a step target resolves to null when its element is not rendered', () => {
  const [firstStep] = getUploadDataModalTourSteps('csv');

  expect((firstStep.target as () => HTMLElement | null)()).toBeNull();
});
