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

import { SandboxManager } from './SandboxManager';
import { SandboxConfig } from './types';

// Mock logging
jest.mock('@apache-superset/core', () => ({
  logging: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock nanoid with incrementing IDs
const mockNanoid = jest.fn();
jest.mock('nanoid', () => ({
  nanoid: () => mockNanoid(),
}));

describe('SandboxManager', () => {
  let manager: SandboxManager;

  let idCounter = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton and counter for each test
    (SandboxManager as any).instance = undefined;
    idCounter = 0;
    mockNanoid.mockImplementation(() => `test-id-${++idCounter}`);
    manager = SandboxManager.getInstance();
  });

  afterEach(() => {
    manager.disposeAll();
  });

  const testConfig: SandboxConfig = {
    trustLevel: 'iframe',
    permissions: ['sqllab:read', 'notification:show'],
  };

  test('getInstance returns singleton', () => {
    const instance1 = SandboxManager.getInstance();
    const instance2 = SandboxManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('createSandbox creates and tracks sandbox instance', () => {
    const sandboxId = manager.createSandbox('test-extension', testConfig);

    expect(sandboxId).toMatch(/^sandbox-test-extension-test-id-/);

    const sandbox = manager.getSandbox(sandboxId);
    expect(sandbox).toBeDefined();
    expect(sandbox?.extensionId).toBe('test-extension');
    expect(sandbox?.isReady).toBe(false);
  });

  test('getSandboxesForExtension returns all sandbox IDs for an extension', () => {
    manager.createSandbox('ext-1', testConfig);
    manager.createSandbox('ext-1', testConfig);
    manager.createSandbox('ext-2', testConfig);

    const ext1Sandboxes = manager.getSandboxesForExtension('ext-1');
    const ext2Sandboxes = manager.getSandboxesForExtension('ext-2');

    expect(ext1Sandboxes).toHaveLength(2);
    expect(ext2Sandboxes).toHaveLength(1);
  });

  test('hasReadySandbox returns false when no sandbox is ready', () => {
    manager.createSandbox('test-extension', testConfig);

    expect(manager.hasReadySandbox('test-extension')).toBe(false);
  });

  test('disposeSandbox removes sandbox instance', () => {
    const sandboxId = manager.createSandbox('test-extension', testConfig);

    expect(manager.getSandbox(sandboxId)).toBeDefined();

    manager.disposeSandbox(sandboxId);

    expect(manager.getSandbox(sandboxId)).toBeUndefined();
    expect(manager.getSandboxesForExtension('test-extension')).toHaveLength(0);
  });

  test('disposeExtensionSandboxes removes all sandboxes for an extension', () => {
    manager.createSandbox('ext-1', testConfig);
    manager.createSandbox('ext-1', testConfig);
    manager.createSandbox('ext-2', testConfig);

    manager.disposeExtensionSandboxes('ext-1');

    expect(manager.getSandboxesForExtension('ext-1')).toHaveLength(0);
    expect(manager.getSandboxesForExtension('ext-2')).toHaveLength(1);
  });

  test('dispatchCommandToExtension queues command when sandbox not ready', () => {
    const sandboxId = manager.createSandbox('test-extension', testConfig);
    const sandbox = manager.getSandbox(sandboxId);

    manager.dispatchCommandToExtension('test-extension', 'test.command', [
      'arg1',
    ]);

    expect(sandbox?.pendingCommands).toHaveLength(1);
    expect(sandbox?.pendingCommands[0]).toEqual({
      command: 'test.command',
      args: ['arg1'],
    });
  });

  test('onSandboxReady registers callback', () => {
    const callback = jest.fn();

    const unsubscribe = manager.onSandboxReady(callback);

    expect(typeof unsubscribe).toBe('function');

    // Unsubscribe should work
    unsubscribe();
  });

  test('disposeAll clears all sandboxes and callbacks', () => {
    const callback = jest.fn();
    manager.onSandboxReady(callback);

    manager.createSandbox('ext-1', testConfig);
    manager.createSandbox('ext-2', testConfig);

    manager.disposeAll();

    expect(manager.getSandboxesForExtension('ext-1')).toHaveLength(0);
    expect(manager.getSandboxesForExtension('ext-2')).toHaveLength(0);
  });
});
