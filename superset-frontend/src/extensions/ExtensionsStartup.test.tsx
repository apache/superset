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
import { render, waitFor } from 'spec/helpers/testing-library';
import { logging, FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import ExtensionsStartup from './ExtensionsStartup';
import ExtensionsManager from './ExtensionsManager';

// Mock the isFeatureEnabled function
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

const mockInitialState = {
  user: { userId: 1 },
};

const mockInitialStateNoUser = {
  user: { userId: undefined },
};

// Clean up global state before each test
beforeEach(() => {
  // Clear the window.superset object
  delete (window as any).superset;

  // Clear any existing ExtensionsManager instance
  (ExtensionsManager as any).instance = undefined;

  // Reset feature flag mock to enabled by default
  mockIsFeatureEnabled.mockReset();
  mockIsFeatureEnabled.mockReturnValue(true);

  // Setup fetch mocks for API calls
  fetchMock.restore();
  fetchMock.get('glob:*/api/v1/extensions/', {
    result: [],
  });
});

afterEach(() => {
  // Clean up after each test
  delete (window as any).superset;
  (ExtensionsManager as any).instance = undefined;

  // Reset mocks
  mockIsFeatureEnabled.mockReset();
  fetchMock.restore();
});

test('renders without crashing', () => {
  render(<ExtensionsStartup />, {
    useRedux: true,
    initialState: mockInitialState,
  });

  // Component renders null, so just check it doesn't throw
  expect(true).toBe(true);
});

test('sets up global superset object when user is logged in', async () => {
  // Mock initializeExtensions to avoid API calls in this test
  const manager = ExtensionsManager.getInstance();
  const initializeSpy = jest
    .spyOn(manager, 'initializeExtensions')
    .mockImplementation(() => Promise.resolve());

  render(<ExtensionsStartup />, {
    useRedux: true,
    initialState: mockInitialState,
  });

  await waitFor(() => {
    // Verify the global superset object is set up
    expect((window as any).superset).toBeDefined();
    expect((window as any).superset.authentication).toBeDefined();
    expect((window as any).superset.core).toBeDefined();
    expect((window as any).superset.commands).toBeDefined();
    expect((window as any).superset.environment).toBeDefined();
    expect((window as any).superset.extensions).toBeDefined();
    expect((window as any).superset.sqlLab).toBeDefined();
  });

  initializeSpy.mockRestore();
});

test('does not set up global superset object when user is not logged in', async () => {
  render(<ExtensionsStartup />, {
    useRedux: true,
    initialState: mockInitialStateNoUser,
  });

  // Wait for the useEffect to complete and verify the global object is not set up
  await waitFor(() => {
    expect((window as any).superset).toBeUndefined();
  });
});

test('initializes ExtensionsManager when user is logged in', async () => {
  // Mock initializeExtensions to avoid API calls, but track that it was called
  const manager = ExtensionsManager.getInstance();
  const initializeSpy = jest
    .spyOn(manager, 'initializeExtensions')
    .mockImplementation(() => Promise.resolve());

  render(<ExtensionsStartup />, {
    useRedux: true,
    initialState: mockInitialState,
  });

  await waitFor(() => {
    // Verify ExtensionsManager initialization was called
    expect(initializeSpy).toHaveBeenCalledTimes(1);
    // The manager should exist and be ready to use
    expect(manager).toBeDefined();
    expect(manager.getExtensions).toBeDefined();
  });

  initializeSpy.mockRestore();
});

test('does not initialize ExtensionsManager when user is not logged in', async () => {
  render(<ExtensionsStartup />, {
    useRedux: true,
    initialState: mockInitialStateNoUser,
  });

  // Wait for the useEffect to complete and verify no initialization happened
  await waitFor(() => {
    const manager = ExtensionsManager.getInstance();
    expect(manager).toBeDefined();
    // Since no initialization happened, there should be no extensions loaded initially
    expect(manager.getExtensions()).toEqual([]);
  });
});

test('only initializes once even with multiple renders', async () => {
  // Track calls to the manager's public API
  const manager = ExtensionsManager.getInstance();
  const originalInitialize = manager.initializeExtensions;
  let initializeCallCount = 0;

  manager.initializeExtensions = jest.fn().mockImplementation(() => {
    initializeCallCount += 1;
    return Promise.resolve();
  });

  const { rerender } = render(<ExtensionsStartup />, {
    useRedux: true,
    initialState: mockInitialState,
  });

  await waitFor(() => {
    expect(initializeCallCount).toBe(1);
  });

  // Re-render the component
  rerender(<ExtensionsStartup />);

  // Wait for any potential async operations, but expect no additional calls
  await waitFor(() => {
    expect(initializeCallCount).toBe(1);
  });

  // Verify initialization is still only called once
  expect(initializeCallCount).toBe(1);

  // Restore original method
  manager.initializeExtensions = originalInitialize;
});

test('initializes ExtensionsManager and logs success when EnableExtensions feature flag is enabled', async () => {
  // Ensure feature flag is enabled
  mockIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.EnableExtensions,
  );

  const infoSpy = jest.spyOn(logging, 'info').mockImplementation();

  // Mock the initializeExtensions method to succeed
  const originalInitialize = ExtensionsManager.prototype.initializeExtensions;
  ExtensionsManager.prototype.initializeExtensions = jest
    .fn()
    .mockImplementation(() => Promise.resolve());

  render(<ExtensionsStartup />, {
    useRedux: true,
    initialState: mockInitialState,
  });

  await waitFor(() => {
    // Verify feature flag was checked
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith(
      FeatureFlag.EnableExtensions,
    );
    // Verify initialization was called
    expect(
      ExtensionsManager.prototype.initializeExtensions,
    ).toHaveBeenCalledTimes(1);
    // Verify success message was logged
    expect(infoSpy).toHaveBeenCalledWith(
      'Extensions initialized successfully.',
    );
  });

  // Restore original method
  ExtensionsManager.prototype.initializeExtensions = originalInitialize;
  infoSpy.mockRestore();
});

test('does not initialize ExtensionsManager when EnableExtensions feature flag is disabled', async () => {
  // Disable the feature flag
  mockIsFeatureEnabled.mockReturnValue(false);

  const manager = ExtensionsManager.getInstance();
  const initializeSpy = jest
    .spyOn(manager, 'initializeExtensions')
    .mockImplementation();

  render(<ExtensionsStartup />, {
    useRedux: true,
    initialState: mockInitialState,
  });

  await waitFor(() => {
    // Verify feature flag was checked
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith(
      FeatureFlag.EnableExtensions,
    );
    // Verify the global superset object is still set up
    expect((window as any).superset).toBeDefined();
    // But extensions should not be initialized
    expect(initializeSpy).not.toHaveBeenCalled();
  });

  initializeSpy.mockRestore();
});

test('logs error when ExtensionsManager initialization fails', async () => {
  // Ensure feature flag is enabled
  mockIsFeatureEnabled.mockReturnValue(true);

  const errorSpy = jest.spyOn(logging, 'error').mockImplementation();

  // Mock the initializeExtensions method to throw an error
  const originalInitialize = ExtensionsManager.prototype.initializeExtensions;
  ExtensionsManager.prototype.initializeExtensions = jest
    .fn()
    .mockImplementation(() => {
      throw new Error('Test initialization error');
    });

  render(<ExtensionsStartup />, {
    useRedux: true,
    initialState: mockInitialState,
  });

  await waitFor(() => {
    // Verify feature flag was checked
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith(
      FeatureFlag.EnableExtensions,
    );
    // Verify error was logged
    expect(errorSpy).toHaveBeenCalledWith(
      'Error setting up extensions:',
      expect.any(Error),
    );
  });

  // Restore original method
  ExtensionsManager.prototype.initializeExtensions = originalInitialize;
  errorSpy.mockRestore();
});
