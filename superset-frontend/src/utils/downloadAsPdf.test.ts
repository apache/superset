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

import downloadAsPdf from './downloadAsPdf';

// Mock the toasts module
jest.mock('src/components/MessageToasts/withToasts', () => ({
  useToasts: () => ({
    addDangerToast: jest.fn(),
    addWarningToast: jest.fn(),
  }),
}));

// Mock logging
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  logging: {
    warn: jest.fn(),
  },
  t: (str: string) => str,
}));

test('downloadAsPdf should be callable without throwing', () => {
  // Create a simple DOM element
  const element = document.createElement('div');
  element.id = 'test-element';
  element.innerHTML = '<p>Test content</p>';
  document.body.appendChild(element);

  // The function should return an event handler that doesn't throw when called
  const handler = downloadAsPdf('#test-element', 'test-file');
  const mockEvent = {
    currentTarget: {
      closest: jest.fn().mockReturnValue(element),
    },
  };
  expect(() => {
    handler(mockEvent as any);
  }).not.toThrow();

  // Cleanup
  document.body.removeChild(element);
});

test('downloadAsPdf should handle missing element gracefully', () => {
  const handler = downloadAsPdf('#non-existent-element', 'test-file');
  const mockEvent = {
    currentTarget: {
      closest: jest.fn().mockReturnValue(null),
    },
  };
  expect(() => {
    handler(mockEvent as any);
  }).not.toThrow();
});
