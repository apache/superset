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
import { useSyncExternalStore } from 'react';
import { logging } from '@apache-superset/core/utils';
import { commands as commandsApi } from '@apache-superset/core';
import { Disposable } from '../models';

type Command = commandsApi.Command;

const commandsMap: Map<string, Command> = new Map();

const commandRegistry: Map<string, (...args: any[]) => any> = new Map();

/**
 * Lets a renderer re-read the registry when it changes.
 *
 * A menu item can point at a command that is not registered yet -- the host
 * renders the navbar long before an extension's bundle arrives, and the two
 * registrations land in whatever order the bundle happens to make them. A
 * reader that looked the command up once would show nothing for it for ever,
 * because the menu registration it does watch had already fired.
 *
 * A version counter rather than the map itself: `useSyncExternalStore`
 * compares snapshots by identity, and a `Map` mutated in place is identical
 * to itself on every read.
 */
const syncListeners = new Set<() => void>();
let registryVersion = 0;
const subscribe = (listener: () => void) => {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
};
const notifyChanged = () => {
  registryVersion += 1;
  syncListeners.forEach(listener => listener());
};

/** Re-renders the caller whenever a command is registered or disposed. */
export const useCommandRegistry = (): number =>
  useSyncExternalStore(
    subscribe,
    () => registryVersion,
    () => 0,
  );

export const registerCommand: typeof commandsApi.registerCommand = (
  command: Command,
  callback: (...args: any[]) => any,
  thisArg?: any,
): Disposable => {
  const { id } = command;

  if (commandRegistry.has(id)) {
    logging.warn(
      `Command "${id}" is already registered. Overwriting the existing command.`,
    );
  }

  commandsMap.set(id, command);
  const boundCallback = thisArg ? callback.bind(thisArg) : callback;
  commandRegistry.set(id, boundCallback);
  notifyChanged();

  return new Disposable(() => {
    commandsMap.delete(id);
    commandRegistry.delete(id);
    notifyChanged();
  });
};

const executeCommand: typeof commandsApi.executeCommand = async <T>(
  command: string,
  ...args: any[]
): Promise<T> => {
  const callback = commandRegistry.get(command);
  if (!callback) {
    throw new Error(`Command "${command}" not found.`);
  }
  return callback(...args) as T;
};

const getCommands: typeof commandsApi.getCommands = (): Command[] =>
  Array.from(commandsMap.values());

const getCommand: typeof commandsApi.getCommand = (
  id: string,
): Command | undefined => commandsMap.get(id);

export const resetContributions = (): void => {
  commandsMap.clear();
  commandRegistry.clear();
  notifyChanged();
};

export const commands: typeof commandsApi = {
  registerCommand,
  executeCommand,
  getCommands,
  getCommand,
};
