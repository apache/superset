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
  setExtensionsContextValue,
  getExtensionsContextValue,
} from './ExtensionsContextUtils';
import { ExtensionsContextType } from './ExtensionsContext';

const mockExtensionsContext: ExtensionsContextType = {
  viewProviders: {},
  registerViewProvider: jest.fn(),
  unregisterViewProvider: jest.fn(),
};

test('sets and gets extensions context value', () => {
  setExtensionsContextValue(mockExtensionsContext);
  const retrievedContext = getExtensionsContextValue();

  expect(retrievedContext).toBe(mockExtensionsContext);
  expect(retrievedContext.viewProviders).toEqual({});
  expect(retrievedContext.registerViewProvider).toBe(
    mockExtensionsContext.registerViewProvider,
  );
  expect(retrievedContext.unregisterViewProvider).toBe(
    mockExtensionsContext.unregisterViewProvider,
  );
});

test('throws error when getting context value before setting it', () => {
  // Reset the context to null (this simulates initial state)
  // We need to access the internal state, so we'll set it to a mock that will throw
  expect(() => {
    // Clear any previously set value by setting to null
    (setExtensionsContextValue as any)(null);
    getExtensionsContextValue();
  }).toThrow('ExtensionsContext value is not set');
});

test('overwrites previous context value when setting new one', () => {
  const firstContext: ExtensionsContextType = {
    viewProviders: { first: jest.fn() },
    registerViewProvider: jest.fn(),
    unregisterViewProvider: jest.fn(),
  };

  const secondContext: ExtensionsContextType = {
    viewProviders: { second: jest.fn() },
    registerViewProvider: jest.fn(),
    unregisterViewProvider: jest.fn(),
  };

  setExtensionsContextValue(firstContext);
  expect(getExtensionsContextValue()).toBe(firstContext);

  setExtensionsContextValue(secondContext);
  expect(getExtensionsContextValue()).toBe(secondContext);
  expect(getExtensionsContextValue().viewProviders).toEqual({
    second: expect.any(Function),
  });
});
