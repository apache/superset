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
import { renderHook } from '@testing-library/react-hooks';
import { render } from 'spec/helpers/testing-library';
import { ExtensionsProvider, useExtensionsContext } from './ExtensionsContext';

test('provides extensions context with initial empty state', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ExtensionsProvider>{children}</ExtensionsProvider>
  );

  const { result } = renderHook(() => useExtensionsContext(), { wrapper });

  expect(result.current.viewProviders).toEqual({});
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

  expect(result.current.viewProviders['test-view']).toBe(mockViewProvider);
});

test('unregisters a view provider', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ExtensionsProvider>{children}</ExtensionsProvider>
  );

  const { result } = renderHook(() => useExtensionsContext(), { wrapper });

  const mockViewProvider = (): ReactElement => <div>Mock View</div>;

  // First register a view provider
  result.current.registerViewProvider('test-view', mockViewProvider);
  expect(result.current.viewProviders['test-view']).toBe(mockViewProvider);

  // Then unregister it
  result.current.unregisterViewProvider('test-view');
  expect(result.current.viewProviders['test-view']).toBeUndefined();
});

test('throws error when useExtensionsContext is used outside provider', () => {
  const { result } = renderHook(() => useExtensionsContext());

  expect(result.error).toEqual(
    Error('useExtensionsContext must be used within a ExtensionsProvider'),
  );
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
