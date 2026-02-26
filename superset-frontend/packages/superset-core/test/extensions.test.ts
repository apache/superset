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

import * as React from 'react';
import {
  defineCommand,
  defineView,
  defineEditor,
  defineMenu,
  setExtensionContext,
  _clearContributionRegistry,
} from '../src/extensions';

// Mock extension context for testing
const mockContext = {
  registerCommand: jest.fn(() => jest.fn()),
  registerViewProvider: jest.fn(() => jest.fn()),
  registerEditor: jest.fn(() => jest.fn()),
  registerMenu: jest.fn(() => jest.fn()),
};

describe('Extension Contributions', () => {
  beforeEach(() => {
    _clearContributionRegistry();
    jest.clearAllMocks();
  });

  describe('defineCommand', () => {
    test('should create command contribution with metadata', () => {
      const command = defineCommand({
        id: 'test-command',
        title: 'Test Command',
        icon: 'TestIcon',
        execute: async () => console.log('executed'),
      });

      expect(command.config.id).toBe('test-command');
      expect(command.config.title).toBe('Test Command');
      expect(command.config.icon).toBe('TestIcon');
      expect(command.__contributionMeta__).toBeDefined();
      expect(command.__contributionMeta__.type).toBe('command');
      expect(command.__contributionMeta__.id).toBe('test-command');
    });

    test('should auto-register when context is available', () => {
      setExtensionContext(mockContext);

      const command = defineCommand({
        id: 'auto-command',
        title: 'Auto Command',
        execute: async () => {},
      });

      expect(mockContext.registerCommand).toHaveBeenCalledWith(command.config);
    });

    test('should call lifecycle callbacks', () => {
      const onActivate = jest.fn();
      const onDeactivate = jest.fn();

      setExtensionContext(mockContext);

      const command = defineCommand({
        id: 'lifecycle-command',
        title: 'Lifecycle Command',
        execute: async () => {},
        onActivate,
        onDeactivate,
      });

      expect(onActivate).toHaveBeenCalled();

      // Test disposal
      command.dispose();
      expect(onDeactivate).toHaveBeenCalled();
    });
  });

  describe('defineView', () => {
    test('should create view contribution with metadata', () => {
      const TestComponent = () => React.createElement('div', null, 'Test');

      const view = defineView({
        id: 'test-view',
        title: 'Test View',
        location: 'sqllab.panels',
        component: TestComponent,
      });

      expect(view.config.id).toBe('test-view');
      expect(view.config.title).toBe('Test View');
      expect(view.config.location).toBe('sqllab.panels');
      expect(view.config.component).toBe(TestComponent);
      expect(view.__contributionMeta__).toBeDefined();
      expect(view.__contributionMeta__.type).toBe('view');
    });

    test('should auto-register when context is available', () => {
      const TestComponent = () => React.createElement('div', null, 'Test');

      setExtensionContext(mockContext);

      defineView({
        id: 'auto-view',
        title: 'Auto View',
        location: 'dashboard.tabs',
        component: TestComponent,
      });

      expect(mockContext.registerViewProvider).toHaveBeenCalledWith(
        'auto-view',
        TestComponent
      );
    });
  });

  describe('defineEditor', () => {
    test('should create editor contribution with metadata', () => {
      const EditorComponent = () => React.createElement('textarea');

      const editor = defineEditor({
        id: 'test-editor',
        name: 'Test Editor',
        mimeTypes: ['text/x-sql'],
        component: EditorComponent,
      });

      expect(editor.config.id).toBe('test-editor');
      expect(editor.config.name).toBe('Test Editor');
      expect(editor.config.mimeTypes).toEqual(['text/x-sql']);
      expect(editor.__contributionMeta__).toBeDefined();
      expect(editor.__contributionMeta__.type).toBe('editor');
    });

    test('should auto-register when context is available', () => {
      const EditorComponent = () => React.createElement('textarea');

      setExtensionContext(mockContext);

      const editor = defineEditor({
        id: 'auto-editor',
        name: 'Auto Editor',
        mimeTypes: ['text/plain'],
        component: EditorComponent,
      });

      expect(mockContext.registerEditor).toHaveBeenCalledWith(editor.config);
    });
  });

  describe('defineMenu', () => {
    test('should create menu contribution with metadata', () => {
      const menu = defineMenu({
        id: 'test-menu',
        title: 'Test Menu',
        location: 'navbar.items',
        action: () => console.log('clicked'),
      });

      expect(menu.config.id).toBe('test-menu');
      expect(menu.config.title).toBe('Test Menu');
      expect(menu.config.location).toBe('navbar.items');
      expect(menu.__contributionMeta__).toBeDefined();
      expect(menu.__contributionMeta__.type).toBe('menu');
    });

    test('should auto-register when context is available', () => {
      setExtensionContext(mockContext);

      const menu = defineMenu({
        id: 'auto-menu',
        title: 'Auto Menu',
        location: 'context.menus',
        action: () => {},
      });

      expect(mockContext.registerMenu).toHaveBeenCalledWith(menu.config);
    });
  });

  describe('Auto-registration system', () => {
    test('should queue contributions when no context is set', () => {
      const command = defineCommand({
        id: 'queued-command',
        title: 'Queued Command',
        execute: async () => {},
      });

      // Should not be registered yet
      expect(mockContext.registerCommand).not.toHaveBeenCalled();

      // Set context - should register queued contributions
      setExtensionContext(mockContext);
      expect(mockContext.registerCommand).toHaveBeenCalledWith(command.config);
    });

    test('should handle disposal correctly', () => {
      const mockDispose = jest.fn();
      mockContext.registerCommand.mockReturnValue(mockDispose);

      setExtensionContext(mockContext);

      const command = defineCommand({
        id: 'dispose-command',
        title: 'Dispose Command',
        execute: async () => {},
      });

      // Dispose should call the returned cleanup function
      command.dispose();
      expect(mockDispose).toHaveBeenCalled();
    });

    test('should handle mixed contribution types', () => {
      setExtensionContext(mockContext);

      const command = defineCommand({
        id: 'mixed-command',
        title: 'Mixed Command',
        execute: async () => {},
      });

      const view = defineView({
        id: 'mixed-view',
        title: 'Mixed View',
        location: 'explore.panels',
        component: () => React.createElement('div', null, 'Mixed'),
      });

      expect(mockContext.registerCommand).toHaveBeenCalledWith(command.config);
      expect(mockContext.registerViewProvider).toHaveBeenCalledWith(
        'mixed-view',
        view.config.component
      );
    });
  });
});
