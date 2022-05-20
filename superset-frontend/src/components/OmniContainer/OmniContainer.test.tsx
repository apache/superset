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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import { isFeatureEnabled } from 'src/featureFlags';
import OmniContainer from './index';

jest.mock('src/featureFlags', () => ({
  isFeatureEnabled: jest.fn(),
  FeatureFlag: { OMNIBAR: 'OMNIBAR' },
  initFeatureFlags: jest.fn(),
}));

test('Do not open Omnibar with the featureflag disabled', () => {
  (isFeatureEnabled as jest.Mock).mockImplementation(
    (ff: string) => !(ff === 'OMNIBAR'),
  );
  render(
    <div data-test="test">
      <OmniContainer />
    </div>,
  );

  expect(
    screen.queryByPlaceholderText('Search all dashboards'),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByTestId('test'), {
    ctrlKey: true,
    code: 'KeyK',
  });
  expect(
    screen.queryByPlaceholderText('Search all dashboards'),
  ).not.toBeInTheDocument();
});

test('Open Omnibar with ctrl + k with featureflag enabled', () => {
  (isFeatureEnabled as jest.Mock).mockImplementation(
    (ff: string) => ff === 'OMNIBAR',
  );
  render(
    <div data-test="test">
      <OmniContainer />
    </div>,
  );

  expect(
    screen.queryByPlaceholderText('Search all dashboards'),
  ).not.toBeInTheDocument();

  // show Omnibar
  fireEvent.keyDown(screen.getByTestId('test'), {
    ctrlKey: true,
    code: 'KeyK',
  });
  expect(
    screen.queryByPlaceholderText('Search all dashboards'),
  ).toBeInTheDocument();

  // hide Omnibar
  fireEvent.keyDown(screen.getByTestId('test'), {
    ctrlKey: true,
    code: 'KeyK',
  });
  expect(
    screen.queryByPlaceholderText('Search all dashboards'),
  ).not.toBeInTheDocument();
});

test('Open Omnibar with Command + k with featureflag enabled', () => {
  (isFeatureEnabled as jest.Mock).mockImplementation(
    (ff: string) => ff === 'OMNIBAR',
  );
  render(
    <div data-test="test">
      <OmniContainer />
    </div>,
  );

  expect(
    screen.queryByPlaceholderText('Search all dashboards'),
  ).not.toBeInTheDocument();

  // show Omnibar
  fireEvent.keyDown(screen.getByTestId('test'), {
    metaKey: true,
    code: 'KeyK',
  });
  expect(
    screen.queryByPlaceholderText('Search all dashboards'),
  ).toBeInTheDocument();

  // hide Omnibar
  fireEvent.keyDown(screen.getByTestId('test'), {
    metaKey: true,
    code: 'KeyK',
  });
  expect(
    screen.queryByPlaceholderText('Search all dashboards'),
  ).not.toBeInTheDocument();
});

test('Open Omnibar with Cmd/Ctrl-K and close with ESC', () => {
  (isFeatureEnabled as jest.Mock).mockImplementation(
    (ff: string) => ff === 'OMNIBAR',
  );
  render(
    <div data-test="test">
      <OmniContainer />
    </div>,
  );

  expect(
    screen.queryByPlaceholderText('Search all dashboards'),
  ).not.toBeInTheDocument();

  // show Omnibar
  fireEvent.keyDown(screen.getByTestId('test'), {
    ctrlKey: true,
    code: 'KeyK',
  });
  expect(
    screen.queryByPlaceholderText('Search all dashboards'),
  ).toBeInTheDocument();

  // Close Omnibar
  fireEvent.keyDown(screen.getByTestId('test'), {
    key: 'Escape',
    code: 'Escape',
  });
  expect(
    screen.queryByPlaceholderText('Search all dashboards'),
  ).not.toBeInTheDocument();
});
