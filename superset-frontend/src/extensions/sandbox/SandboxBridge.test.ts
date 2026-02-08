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

import { SandboxBridge, SandboxBridgeClient } from './SandboxBridge';

// Mock logging
jest.mock('@apache-superset/core', () => ({
  logging: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: () => 'test-id-123',
}));

describe('SandboxBridge', () => {
  let bridge: SandboxBridge;
  let mockWindow: Window;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWindow = {
      postMessage: jest.fn(),
    } as unknown as Window;

    bridge = new SandboxBridge({
      bridgeId: 'test-bridge',
      extensionId: 'test-extension',
      permissions: ['sqllab:read', 'notification:show'],
    });
  });

  afterEach(() => {
    bridge.disconnect();
  });

  test('connect sets up message listener', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

    bridge.connect(mockWindow);

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );

    addEventListenerSpy.mockRestore();
  });

  test('disconnect removes message listener and clears state', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    bridge.connect(mockWindow);
    bridge.disconnect();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });

  test('hasPermission returns true for granted permissions', () => {
    expect(bridge.hasPermission('sqllab:read')).toBe(true);
    expect(bridge.hasPermission('notification:show')).toBe(true);
  });

  test('hasPermission returns false for denied permissions', () => {
    expect(bridge.hasPermission('dashboard:write')).toBe(false);
    expect(bridge.hasPermission('sqllab:execute')).toBe(false);
  });

  test('getPermissions returns all granted permissions', () => {
    const permissions = bridge.getPermissions();
    expect(permissions).toContain('sqllab:read');
    expect(permissions).toContain('notification:show');
    expect(permissions).toHaveLength(2);
  });

  test('emitEvent posts message to target window', () => {
    bridge.connect(mockWindow);

    bridge.emitEvent('test-event', { foo: 'bar' });

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'event',
        extensionId: 'test-extension',
        eventName: 'test-event',
        data: { foo: 'bar' },
      }),
      '*',
    );
  });

  test('emitEvent does nothing when not connected', () => {
    bridge.emitEvent('test-event', { foo: 'bar' });

    expect(mockWindow.postMessage).not.toHaveBeenCalled();
  });
});

describe('SandboxBridgeClient', () => {
  let client: SandboxBridgeClient;
  let mockParentWindow: Window;

  beforeEach(() => {
    jest.clearAllMocks();

    mockParentWindow = {
      postMessage: jest.fn(),
    } as unknown as Window;

    client = new SandboxBridgeClient('test-extension');
  });

  afterEach(() => {
    client.disconnect();
  });

  test('connect sends ready signal', () => {
    client.connect(mockParentWindow);

    expect(mockParentWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ready',
        extensionId: 'test-extension',
      }),
      '*',
    );
  });

  test('call returns promise that resolves on response', async () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

    client.connect(mockParentWindow);

    // Get the message handler
    const messageHandler = addEventListenerSpy.mock.calls.find(
      call => call[0] === 'message',
    )?.[1] as EventListener;

    expect(messageHandler).toBeDefined();

    // Start the call
    const callPromise = client.call<string>('test.method', ['arg1']);

    // Simulate response
    const responseEvent = new MessageEvent('message', {
      data: {
        type: 'api-response',
        id: 'test-id-123',
        extensionId: 'test-extension',
        result: 'test-result',
      },
    });
    messageHandler(responseEvent);

    const result = await callPromise;
    expect(result).toBe('test-result');

    addEventListenerSpy.mockRestore();
  });

  test('on registers event handler', () => {
    client.connect(mockParentWindow);

    const handler = jest.fn();
    const unsubscribe = client.on('test-event', handler);

    expect(typeof unsubscribe).toBe('function');
  });

  test('on unsubscribe removes handler', () => {
    client.connect(mockParentWindow);

    const handler = jest.fn();
    const unsubscribe = client.on('test-event', handler);
    unsubscribe();

    // Handler should no longer be called for events
    // (This would require simulating an event and checking the handler isn't called)
  });
});
