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
import userEvent from '@testing-library/user-event';
import { views } from 'src/core';
import PanelToolbar from 'src/components/PanelToolbar';
import StatusBar from 'src/SqlLab/components/StatusBar';
import { ViewLocations } from 'src/SqlLab/contributions';
import {
  registerTestView,
  registerToolbarAction,
  cleanupExtensions,
} from 'src/SqlLab/test-utils/extensionTestHelpers';

afterEach(cleanupExtensions);

test('disposing a registered view removes it from rendering', () => {
  const disposable = views.registerView(
    { id: 'dispose-test', name: 'Dispose Test' },
    ViewLocations.sqllab.statusBar,
    () => React.createElement('div', null, 'Disposable Content'),
  );

  const { rerender } = render(<StatusBar />);
  expect(screen.getByText('Disposable Content')).toBeInTheDocument();

  disposable.dispose();
  rerender(<StatusBar />);
  expect(screen.queryByText('Disposable Content')).not.toBeInTheDocument();
});

test('extension throwing during render does not crash host', () => {
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

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

  consoleError.mockRestore();
});

test('PanelToolbar click executes registered command callback', async () => {
  const callback = jest.fn();
  registerToolbarAction(
    'test.clickLocation',
    'test-click-cmd',
    'Click Me',
    callback,
  );

  render(<PanelToolbar viewId="test.clickLocation" />);

  await userEvent.click(screen.getByRole('button', { name: 'Click Me' }));
  expect(callback).toHaveBeenCalledTimes(1);
});
