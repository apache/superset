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
import { ReactElement } from 'react';
import { renderHook } from '@testing-library/react';
import { render } from 'spec/helpers/testing-library';
import { ExtensionsProvider, useExtensionsContext } from './ExtensionsContext';

test('provides extensions context with initial empty state', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ExtensionsProvider>{children}</ExtensionsProvider>
  );

  const { result } = renderHook(() => useExtensionsContext(), { wrapper });

  const view = result.current.getView('non-existent');
  expect(view).not.toBeNull();
  // Should return a placeholder when no provider is registered
  const { getByText } = render(view);
  expect(
    getByText('The extension non-existent could not be loaded.'),
  ).toBeInTheDocument();
  expect(
    getByText(/This may be due to the extension not being activated/),
  ).toBeInTheDocument();

  expect(typeof result.current.getView).toBe('function');
  expect(typeof result.current.registerViewProvider).toBe('function');
  expect(typeof result.current.unregisterViewProvider).toBe('function');
});

test('registers a view provider', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ExtensionsProvider>{children}</ExtensionsProvider>
  );

  const { result } = renderHook(() => useExtensionsContext(), { wrapper });

  const mockViewProvider = (): ReactElement => <div>Mock View</div>;

  result.current.registerViewProvider('test-view', mockViewProvider);

  const view = result.current.getView('test-view');
  expect(view).not.toBeNull();
});

test('unregisters a view provider', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ExtensionsProvider>{children}</ExtensionsProvider>
  );

  const { result } = renderHook(() => useExtensionsContext(), { wrapper });

  const mockViewProvider = (): ReactElement => (
    <div data-test="registered-view">Mock View</div>
  );

  // First register a view provider
  result.current.registerViewProvider('test-view', mockViewProvider);
  const registeredView = result.current.getView('test-view');
  const { getByTestId: getByTestIdRegistered } = render(registeredView);
  expect(getByTestIdRegistered('registered-view')).toBeInTheDocument();

  // Then unregister it - should return placeholder instead
  result.current.unregisterViewProvider('test-view');
  const unregisteredView = result.current.getView('test-view');
  const { getByText } = render(unregisteredView);
  expect(
    getByText('The extension test-view could not be loaded.'),
  ).toBeInTheDocument();
  expect(
    getByText(/This may be due to the extension not being activated/),
  ).toBeInTheDocument();
});

test('throws error when useExtensionsContext is used outside provider', () => {
  const { result } = renderHook(() => useExtensionsContext());

  expect(result.error).toEqual(
    Error('useExtensionsContext must be used within a ExtensionsProvider'),
  );
});

test('getView returns the correct rendered component', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ExtensionsProvider>{children}</ExtensionsProvider>
  );

  const { result } = renderHook(() => useExtensionsContext(), { wrapper });

  const MockComponent = (): ReactElement => (
    <div data-test="mock-component">Mock View Content</div>
  );

  result.current.registerViewProvider('test-view', MockComponent);

  const view = result.current.getView('test-view');
  expect(view).not.toBeNull();

  // Render the returned view to verify it's wrapped in ErrorBoundary and contains the component
  const { getByTestId } = render(view!);
  expect(getByTestId('mock-component')).toBeInTheDocument();
  expect(getByTestId('mock-component')).toHaveTextContent('Mock View Content');
});

test('getView returns placeholder when no provider is registered', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ExtensionsProvider>{children}</ExtensionsProvider>
  );

  const { result } = renderHook(() => useExtensionsContext(), { wrapper });

  const view = result.current.getView('non-existent-view');
  expect(view).not.toBeNull();

  const { getByText } = render(view);
  expect(
    getByText('The extension non-existent-view could not be loaded.'),
  ).toBeInTheDocument();
  expect(
    getByText(/This may be due to the extension not being activated/),
  ).toBeInTheDocument();
});

test('renders children correctly', () => {
  const TestChild = () => <div data-test="test-child">Test Child</div>;

  const { getByTestId } = render(
    <ExtensionsProvider>
      <TestChild />
    </ExtensionsProvider>,
  );

  expect(getByTestId('test-child')).toBeInTheDocument();
});
