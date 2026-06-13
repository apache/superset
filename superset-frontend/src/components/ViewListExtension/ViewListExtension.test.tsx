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
import { views } from 'src/core';
import ViewListExtension from '.';

const TEST_VIEW_ID = 'test.view';

const disposables: Array<{ dispose: () => void }> = [];

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
});

test('renders nothing when no view contributions exist', () => {
  const { container } = render(<ViewListExtension viewId={TEST_VIEW_ID} />);

  expect(container.firstChild?.childNodes.length ?? 0).toBe(0);
});

test('renders provider content for registered view', () => {
  const provider = () =>
    React.createElement('div', null, 'My Extension Content');
  disposables.push(
    views.registerView(
      { id: 'test-view-1', name: 'test-view-1 View' },
      TEST_VIEW_ID,
      provider,
    ),
  );

  render(<ViewListExtension viewId={TEST_VIEW_ID} />);

  expect(screen.getByText('My Extension Content')).toBeInTheDocument();
});

test('renders content for multiple registered views', () => {
  const provider1 = () => React.createElement('div', null, 'Content One');
  const provider2 = () => React.createElement('div', null, 'Content Two');

  disposables.push(
    views.registerView(
      { id: 'test-view-1', name: 'test-view-1 View' },
      TEST_VIEW_ID,
      provider1,
    ),
    views.registerView(
      { id: 'test-view-2', name: 'test-view-2 View' },
      TEST_VIEW_ID,
      provider2,
    ),
  );

  render(<ViewListExtension viewId={TEST_VIEW_ID} />);

  expect(screen.getByText('Content One')).toBeInTheDocument();
  expect(screen.getByText('Content Two')).toBeInTheDocument();
});

test('renders nothing for viewId with no matching contributions', () => {
  const { container } = render(<ViewListExtension viewId="nonexistent.view" />);

  expect(container.firstChild?.childNodes.length ?? 0).toBe(0);
});

test('handles multiple views registered at the same location', () => {
  const provider1 = () => React.createElement('div', null, 'Ext1 Content');
  const provider2 = () => React.createElement('div', null, 'Ext2 Content');

  disposables.push(
    views.registerView(
      { id: 'ext1-view', name: 'ext1-view View' },
      TEST_VIEW_ID,
      provider1,
    ),
    views.registerView(
      { id: 'ext2-view', name: 'ext2-view View' },
      TEST_VIEW_ID,
      provider2,
    ),
  );

  render(<ViewListExtension viewId={TEST_VIEW_ID} />);

  expect(screen.getByText('Ext1 Content')).toBeInTheDocument();
  expect(screen.getByText('Ext2 Content')).toBeInTheDocument();
});

test('renders views for different viewIds independently', () => {
  const VIEW_ID_A = 'view.a';
  const VIEW_ID_B = 'view.b';

  const providerA = () => React.createElement('div', null, 'View A Content');
  const providerB = () => React.createElement('div', null, 'View B Content');

  disposables.push(
    views.registerView(
      { id: 'view-a-component', name: 'view-a-component View' },
      VIEW_ID_A,
      providerA,
    ),
    views.registerView(
      { id: 'view-b-component', name: 'view-b-component View' },
      VIEW_ID_B,
      providerB,
    ),
  );

  const { rerender } = render(<ViewListExtension viewId={VIEW_ID_A} />);

  expect(screen.getByText('View A Content')).toBeInTheDocument();
  expect(screen.queryByText('View B Content')).not.toBeInTheDocument();

  rerender(<ViewListExtension viewId={VIEW_ID_B} />);

  expect(screen.getByText('View B Content')).toBeInTheDocument();
  expect(screen.queryByText('View A Content')).not.toBeInTheDocument();
});
