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
import { createElement } from 'react';
import { logging } from '@apache-superset/core/utils';
import ChatProvider, { ClientToolsFormat } from './ChatProvider';

const trigger = () => createElement('button', null, 'Bubble');
const panel = () => createElement('div', null, 'Panel');

beforeEach(() => {
  ChatProvider.getInstance().reset();
});

test('returns the singleton instance', () => {
  expect(ChatProvider.getInstance()).toBe(ChatProvider.getInstance());
});

test('getChat returns undefined when no chat is registered', () => {
  expect(ChatProvider.getInstance().getChat()).toBeUndefined();
});

test('registerChat sets the registration and returns the descriptor copy', () => {
  const provider = ChatProvider.getInstance();
  const descriptor = { id: 'acme.chat', name: 'Acme Chat' };
  const disposable = provider.registerChat(descriptor, trigger, panel);

  expect(provider.getChat()).toEqual(descriptor);
  disposable.dispose();
});

test('the last-registered chat wins and logs a warning', () => {
  const provider = ChatProvider.getInstance();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

  provider.registerChat({ id: 'first.chat', name: 'First' }, trigger, panel);
  provider.registerChat({ id: 'second.chat', name: 'Second' }, trigger, panel);

  expect(provider.getChat()?.id).toBe('second.chat');
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0][0]).toContain('second.chat');
  expect(warn.mock.calls[0][0]).toContain('first.chat');
  warn.mockRestore();
});

test('re-registering with a different id replaces the active chat', () => {
  const provider = ChatProvider.getInstance();
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  provider.registerChat({ id: 'first.chat', name: 'First' }, trigger, panel);
  expect(provider.getChat()?.id).toBe('first.chat');

  provider.registerChat({ id: 'second.chat', name: 'Second' }, trigger, panel);
  expect(provider.getChat()?.id).toBe('second.chat');

  jest.restoreAllMocks();
});

test('disposing the registration clears it', () => {
  const provider = ChatProvider.getInstance();
  const disposable = provider.registerChat(
    { id: 'acme.chat', name: 'Acme' },
    trigger,
    panel,
  );

  disposable.dispose();

  expect(provider.getChat()).toBeUndefined();
});

test('disposing twice fires unregister only once', () => {
  const provider = ChatProvider.getInstance();
  const unregistered = jest.fn();
  provider.onDidUnregisterChat(unregistered);

  const disposable = provider.registerChat(
    { id: 'acme.chat', name: 'Acme' },
    trigger,
    panel,
  );
  disposable.dispose();
  disposable.dispose();

  expect(unregistered).toHaveBeenCalledTimes(1);
});

test('onDidRegisterChat and onDidUnregisterChat fire with the descriptor', () => {
  const provider = ChatProvider.getInstance();
  const registered = jest.fn();
  const unregistered = jest.fn();
  provider.onDidRegisterChat(registered);
  provider.onDidUnregisterChat(unregistered);

  const descriptor = { id: 'acme.chat', name: 'Acme' };
  const disposable = provider.registerChat(descriptor, trigger, panel);

  expect(registered).toHaveBeenCalledWith(descriptor);
  expect(unregistered).not.toHaveBeenCalled();

  disposable.dispose();

  expect(unregistered).toHaveBeenCalledWith(descriptor);
});

test('open and close toggle the panel state', () => {
  const provider = ChatProvider.getInstance();
  provider.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel);

  expect(provider.isOpen()).toBe(false);

  provider.open();
  expect(provider.isOpen()).toBe(true);

  provider.close();
  expect(provider.isOpen()).toBe(false);
});

test('open fires once; duplicate open is a no-op', () => {
  const provider = ChatProvider.getInstance();
  const opened = jest.fn();
  provider.onDidOpen(opened);
  provider.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel);

  provider.open();
  provider.open();

  expect(opened).toHaveBeenCalledTimes(1);
});

test('close fires once; duplicate close is a no-op', () => {
  const provider = ChatProvider.getInstance();
  const closed = jest.fn();
  provider.onDidClose(closed);
  provider.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel);

  provider.open();
  provider.close();
  provider.close();

  expect(closed).toHaveBeenCalledTimes(1);
});

test('open is a no-op when no chat is registered', () => {
  const provider = ChatProvider.getInstance();
  const opened = jest.fn();
  provider.onDidOpen(opened);

  provider.open();

  expect(provider.isOpen()).toBe(false);
  expect(opened).not.toHaveBeenCalled();
});

test('registering a second chat while open closes the panel', () => {
  const provider = ChatProvider.getInstance();
  const closed = jest.fn();
  provider.onDidClose(closed);
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  provider.registerChat({ id: 'first.chat', name: 'First' }, trigger, panel);
  provider.open();
  provider.registerChat({ id: 'second.chat', name: 'Second' }, trigger, panel);

  expect(provider.isOpen()).toBe(false);
  expect(closed).toHaveBeenCalledTimes(1);
  jest.restoreAllMocks();
});

test('disposing the active chat while open closes the panel', () => {
  const provider = ChatProvider.getInstance();
  const closed = jest.fn();
  provider.onDidClose(closed);

  const disposable = provider.registerChat(
    { id: 'acme.chat', name: 'Acme' },
    trigger,
    panel,
  );
  provider.open();
  disposable.dispose();

  expect(provider.isOpen()).toBe(false);
  expect(closed).toHaveBeenCalledTimes(1);
});

test('a late registration does not inherit a stale open state', () => {
  const provider = ChatProvider.getInstance();
  const disposable = provider.registerChat(
    { id: 'acme.chat', name: 'Acme' },
    trigger,
    panel,
  );
  provider.open();
  disposable.dispose();

  provider.registerChat({ id: 'late.chat', name: 'Late' }, trigger, panel);

  expect(provider.isOpen()).toBe(false);
});

test('getDisplayMode defaults to floating', () => {
  expect(ChatProvider.getInstance().getDisplayMode()).toBe('floating');
});

test('setDisplayMode updates mode and fires event only on change', () => {
  const provider = ChatProvider.getInstance();
  const modeChanged = jest.fn();
  provider.onDidChangeDisplayMode(modeChanged);

  provider.setDisplayMode('floating');
  expect(modeChanged).not.toHaveBeenCalled();

  provider.setDisplayMode('panel');
  expect(provider.getDisplayMode()).toBe('panel');
  expect(modeChanged).toHaveBeenCalledWith('panel');
});

test('state reflects changes after registration and open', () => {
  const provider = ChatProvider.getInstance();

  expect(provider.getChat()).toBeUndefined();
  expect(provider.isOpen()).toBe(false);

  provider.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel);
  provider.open();

  expect(provider.isOpen()).toBe(true);
  expect(provider.getChat()?.id).toBe('acme.chat');
});

test('reset clears all state', () => {
  const provider = ChatProvider.getInstance();
  provider.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel);
  provider.open();
  provider.setDisplayMode('panel');

  provider.reset();

  expect(provider.getChat()).toBeUndefined();
  expect(provider.isOpen()).toBe(false);
  expect(provider.getDisplayMode()).toBe('floating');
});

const noopTool = {
  description: 'test tool',
  inputSchema: { type: 'object', properties: {} },
  handler: () => ({ success: true }),
};

test('registerClientTool registers a tool under its own full name', () => {
  const provider = ChatProvider.getInstance();
  provider.registerClientTool({
    ...noopTool,
    name: 'core.dashboard__get_root',
  });

  expect(provider.getTools().map(tool => tool.name)).toEqual([
    'core.dashboard__get_root',
  ]);
});

test('registerClientTools registers every tool in the list', () => {
  const provider = ChatProvider.getInstance();
  provider.registerClientTools([
    { ...noopTool, name: 'core.dashboard__get_root' },
    { ...noopTool, name: 'core.chart__do_thing' },
  ]);

  expect(
    provider
      .getTools()
      .map(tool => tool.name)
      .sort(),
  ).toEqual(['core.chart__do_thing', 'core.dashboard__get_root']);
});

test('disposing a registerClientTools() call removes every tool it registered', () => {
  const provider = ChatProvider.getInstance();
  provider.registerClientTool({
    ...noopTool,
    name: 'acme.widgets.dashboard__unrelated',
  });
  const disposable = provider.registerClientTools([
    { ...noopTool, name: 'core.dashboard__get_root' },
    { ...noopTool, name: 'core.chart__do_thing' },
  ]);

  disposable.dispose();

  expect(provider.getTools().map(tool => tool.name)).toEqual([
    'acme.widgets.dashboard__unrelated',
  ]);
});

test('registerClientTool warns and overwrites on a duplicate name', () => {
  const provider = ChatProvider.getInstance();
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});

  provider.registerClientTool({
    ...noopTool,
    name: 'acme.dashboard__get_root',
    description: 'first',
  });
  provider.registerClientTool({
    ...noopTool,
    name: 'acme.dashboard__get_root',
    description: 'second',
  });

  expect(warn).toHaveBeenCalledTimes(1);
  const tools = provider.getTools();
  expect(tools).toHaveLength(1);
  expect(tools[0].description).toBe('second');
  warn.mockRestore();
});

test('registerClientTool warns when called after registerChat', () => {
  const provider = ChatProvider.getInstance();
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});

  provider.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel);
  provider.registerClientTool({
    ...noopTool,
    name: 'acme.dashboard__get_root',
  });

  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0][0]).toContain('chat.registerClientTool(s)');
  expect(warn.mock.calls[0][0]).toContain('registerChat()');
  warn.mockRestore();
});

test('registerClientTool does not warn when called before registerChat', () => {
  const provider = ChatProvider.getInstance();
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});

  provider.registerClientTool({
    ...noopTool,
    name: 'acme.dashboard__get_root',
  });
  provider.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel);

  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test('registerClientTool only warns once per late-registration, even across many tools', () => {
  const provider = ChatProvider.getInstance();
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});

  provider.registerChat({ id: 'acme.chat', name: 'Acme' }, trigger, panel);
  provider.registerClientTools([
    { ...noopTool, name: 'acme.dashboard__one' },
    { ...noopTool, name: 'acme.dashboard__two' },
  ]);

  expect(warn).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});

test('getTools aggregates every registered tool', () => {
  const provider = ChatProvider.getInstance();

  provider.registerClientTool({
    ...noopTool,
    name: 'core.dashboard__get_root',
  });
  provider.registerClientTool({
    ...noopTool,
    name: 'acme.widgets.chart__do_thing',
  });

  expect(
    provider
      .getTools()
      .map(tool => tool.name)
      .sort(),
  ).toEqual(['acme.widgets.chart__do_thing', 'core.dashboard__get_root']);
});

test('disposing a registerClientTool() call removes that tool', () => {
  const provider = ChatProvider.getInstance();
  const disposable = provider.registerClientTool({
    ...noopTool,
    name: 'acme.widgets.dashboard__get_root',
  });

  disposable.dispose();

  expect(provider.getTools()).toEqual([]);
});

test('reset clears registered tools', () => {
  const provider = ChatProvider.getInstance();
  provider.registerClientTool({
    ...noopTool,
    name: 'core.dashboard__get_root',
  });

  provider.reset();

  expect(provider.getTools()).toEqual([]);
});

test('getTools(Claude) converts inputSchema to input_schema and drops handler', () => {
  const provider = ChatProvider.getInstance();
  provider.registerClientTool({
    ...noopTool,
    name: 'acme.widgets.dashboard__get_root',
    description: 'gets the root',
    inputSchema: { type: 'object', properties: { x: { type: 'string' } } },
  });

  const [tool] = provider.getTools(ClientToolsFormat.Claude);

  expect(tool).toEqual({
    name: 'acme.widgets.dashboard__get_root',
    description: 'gets the root',
    input_schema: { type: 'object', properties: { x: { type: 'string' } } },
  });
  expect(tool).not.toHaveProperty('handler');
  expect(tool).not.toHaveProperty('inputSchema');
});

test('getTools() and getTools(Claude) reflect the same underlying registry', () => {
  const provider = ChatProvider.getInstance();
  provider.registerClientTool({
    ...noopTool,
    name: 'core.dashboard__get_root',
  });
  provider.registerClientTool({
    ...noopTool,
    name: 'acme.widgets.chart__do_thing',
  });

  const nativeNames = provider.getTools().map(tool => tool.name);
  const claudeNames = provider
    .getTools(ClientToolsFormat.Claude)
    .map(tool => tool.name);

  expect(claudeNames.sort()).toEqual(nativeNames.sort());
});

test.each([
  ['AgUi', ClientToolsFormat.AgUi],
  ['CopilotKit', ClientToolsFormat.CopilotKit],
  ['Codex', ClientToolsFormat.Codex],
])(
  'getTools(%s) throws — placeholder with no verified target shape yet',
  (name, format) => {
    const provider = ChatProvider.getInstance();
    provider.registerClientTool({
      ...noopTool,
      name: 'core.dashboard__get_root',
    });

    expect(() => provider.getTools(format)).toThrow(
      `chat.ClientToolsFormat.${name}`,
    );
  },
);

test('getTools() throws a named error for an unknown format instead of an opaque TypeError', () => {
  const provider = ChatProvider.getInstance();
  provider.registerClientTool({
    ...noopTool,
    name: 'core.dashboard__get_root',
  });

  expect(() =>
    provider.getTools(
      'not-a-real-format' as unknown as typeof ClientToolsFormat.Claude,
    ),
  ).toThrow('unknown format "not-a-real-format"');
});
