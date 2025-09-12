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

import downloadAsPivotExcel from './downloadAsPivotExcel';

// Mock the toasts module
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
  }),
}));

// Mock fetch
global.fetch = jest.fn();

test('downloadAsPivotExcel should be callable without throwing', () => {
  // Create a simple table in the DOM
  const table = document.createElement('table');
  table.id = 'test-table';
  table.innerHTML = `
    <thead>
      <tr><th>Name</th><th>Age</th></tr>
    </thead>
    <tbody>
      <tr><td>John</td><td>30</td></tr>
      <tr><td>Jane</td><td>25</td></tr>
    </tbody>
  `;
  document.body.appendChild(table);

  expect(() => {
    downloadAsPivotExcel('#test-table', 'test-file');
  }).not.toThrow();

  // Cleanup
  document.body.removeChild(table);
});

test('downloadAsPivotExcel should throw when table is missing', () => {
  expect(() => {
    downloadAsPivotExcel('#non-existent-table', 'test-file');
  }).toThrow('Cannot read properties of null');
});

test('downloadAsPivotExcel should handle invalid selector gracefully', () => {
  expect(() => {
    downloadAsPivotExcel('', 'test-file');
  }).toThrow(); // Invalid selector should throw
});
