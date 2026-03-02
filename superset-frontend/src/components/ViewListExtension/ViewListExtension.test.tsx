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
import React, { ReactElement } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import * as ExtensionsContextUtils from 'src/extensions/ExtensionsContextUtils';
import { views } from 'src/core';
import { ExtensionsProvider } from 'src/extensions/ExtensionsContext';
import ViewListExtension from '.';

const mockRegisterViewProvider = jest.fn();
const mockUnregisterViewProvider = jest.fn();

jest
  .spyOn(ExtensionsContextUtils, 'getExtensionsContextValue')
  .mockReturnValue({
    registerViewProvider: mockRegisterViewProvider,
    unregisterViewProvider: mockUnregisterViewProvider,
    getView: jest.fn(),
  });

const TEST_VIEW_ID = 'test.view';

const dummyProvider = () => React.createElement('div', null, 'placeholder');

const renderWithExtensionsProvider = (ui: ReactElement) =>
  render(ui, { wrapper: ExtensionsProvider as any });

beforeEach(() => {
  mockRegisterViewProvider.mockClear();
  mockUnregisterViewProvider.mockClear();
});

test('renders nothing when no view contributions exist', () => {
  const { container } = renderWithExtensionsProvider(
    <ViewListExtension viewId={TEST_VIEW_ID} />,
  );

  expect(container.firstChild?.childNodes.length ?? 0).toBe(0);
});

test('renders placeholder for unregistered view provider', () => {
  views.registerView(
    { id: 'test-view-1', name: 'test-view-1 View' },
    TEST_VIEW_ID,
    dummyProvider,
  );

  renderWithExtensionsProvider(<ViewListExtension viewId={TEST_VIEW_ID} />);

  expect(screen.getByText(/test-view-1/)).toBeInTheDocument();
});

test('renders multiple view placeholders for multiple contributions', () => {
  views.registerView(
    { id: 'test-view-1', name: 'test-view-1 View' },
    TEST_VIEW_ID,
    dummyProvider,
  );
  views.registerView(
    { id: 'test-view-2', name: 'test-view-2 View' },
    TEST_VIEW_ID,
    dummyProvider,
  );

  renderWithExtensionsProvider(<ViewListExtension viewId={TEST_VIEW_ID} />);

  expect(screen.getByText(/test-view-1/)).toBeInTheDocument();
  expect(screen.getByText(/test-view-2/)).toBeInTheDocument();
});

test('renders nothing for viewId with no matching contributions', () => {
  const { container } = renderWithExtensionsProvider(
    <ViewListExtension viewId="nonexistent.view" />,
  );

  expect(container.firstChild?.childNodes.length ?? 0).toBe(0);
});

test('handles multiple views registered at the same location', () => {
  views.registerView(
    { id: 'ext1-view', name: 'ext1-view View' },
    TEST_VIEW_ID,
    dummyProvider,
  );
  views.registerView(
    { id: 'ext2-view', name: 'ext2-view View' },
    TEST_VIEW_ID,
    dummyProvider,
  );

  renderWithExtensionsProvider(<ViewListExtension viewId={TEST_VIEW_ID} />);

  expect(screen.getByText(/ext1-view/)).toBeInTheDocument();
  expect(screen.getByText(/ext2-view/)).toBeInTheDocument();
});

test('renders views for different viewIds independently', () => {
  const VIEW_ID_A = 'view.a';
  const VIEW_ID_B = 'view.b';

  views.registerView(
    { id: 'view-a-component', name: 'view-a-component View' },
    VIEW_ID_A,
    dummyProvider,
  );
  views.registerView(
    { id: 'view-b-component', name: 'view-b-component View' },
    VIEW_ID_B,
    dummyProvider,
  );

  const { rerender } = renderWithExtensionsProvider(
    <ViewListExtension viewId={VIEW_ID_A} />,
  );

  expect(screen.getByText(/view-a-component/)).toBeInTheDocument();
  expect(screen.queryByText(/view-b-component/)).not.toBeInTheDocument();

  rerender(<ViewListExtension viewId={VIEW_ID_B} />);

  expect(screen.getByText(/view-b-component/)).toBeInTheDocument();
  expect(screen.queryByText(/view-a-component/)).not.toBeInTheDocument();
});
