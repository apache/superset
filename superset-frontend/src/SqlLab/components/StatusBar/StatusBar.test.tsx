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
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import StatusBar from 'src/SqlLab/components/StatusBar';
import { ViewLocations } from 'src/SqlLab/contributions';
import {
  registerTestView,
  cleanupExtensions,
} from 'spec/helpers/extensionTestHelpers';

let consoleErrorSpy: jest.SpyInstance;

afterEach(() => {
  cleanupExtensions();
  if (consoleErrorSpy) {
    consoleErrorSpy.mockRestore();
  }
});

test('renders extension content when registered at statusBar slot', () => {
  registerTestView(
    ViewLocations.sqllab.statusBar,
    'test-status',
    'Test Status',
    () => React.createElement('div', null, 'Status Extension'),
  );
  render(<StatusBar />);
  expect(screen.getByText('Status Extension')).toBeInTheDocument();
});

test('does not render container when no extensions registered', () => {
  const { container } = render(<StatusBar />);
  expect(container).toBeEmptyDOMElement();
});

test('extension throwing during render does not crash host', () => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  const ThrowingComponent = () => {
    throw new Error('Extension error');
  };

  registerTestView(
    ViewLocations.sqllab.statusBar,
    'throwing-ext',
    'Throwing',
    () => React.createElement(ThrowingComponent),
  );
  registerTestView(
    ViewLocations.sqllab.statusBar,
    'healthy-ext',
    'Healthy',
    () => React.createElement('div', null, 'Healthy Content'),
  );

  render(<StatusBar />);

  // Healthy extension still renders despite the throwing extension
  expect(screen.getByText('Healthy Content')).toBeInTheDocument();
  // Verify the error boundary caught the throwing extension
  expect(consoleErrorSpy).toHaveBeenCalled();
});

test('renders multiple extensions in status bar', () => {
  registerTestView(
    ViewLocations.sqllab.statusBar,
    'test-status-1',
    'Status One',
    () => React.createElement('div', null, 'Extension One'),
  );
  registerTestView(
    ViewLocations.sqllab.statusBar,
    'test-status-2',
    'Status Two',
    () => React.createElement('div', null, 'Extension Two'),
  );
  render(<StatusBar />);
  expect(screen.getByText('Extension One')).toBeInTheDocument();
  expect(screen.getByText('Extension Two')).toBeInTheDocument();
});
