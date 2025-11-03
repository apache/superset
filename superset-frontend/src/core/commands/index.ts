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
import { logging } from '@superset-ui/core';
import type { commands as commandsType } from '@apache-superset/core';
import { Disposable } from '../models';

const commandRegistry: Map<string, (...args: any[]) => any> = new Map();

const registerCommand: typeof commandsType.registerCommand = (
  command,
  callback,
  thisArg,
) => {
  if (commandRegistry.has(command)) {
    logging.warn(
      `Command "${command}" is already registered. Overwriting the existing command.`,
    );
  }
  const boundCallback = thisArg ? callback.bind(thisArg) : callback;
  commandRegistry.set(command, boundCallback);
  return new Disposable(() => {
    commandRegistry.delete(command);
  });
};

const executeCommand: typeof commandsType.executeCommand = async <T>(
  command: string,
  ...args: any[]
): Promise<T> => {
  const callback = commandRegistry.get(command);
  if (!callback) {
    throw new Error(`Command "${command}" not found.`);
  }
  return callback(...args) as T;
};

const getCommands: typeof commandsType.getCommands = filterInternal => {
  const commands = Array.from(commandRegistry.keys());
  return Promise.resolve(
    filterInternal ? commands.filter(cmd => !cmd.startsWith('_')) : commands,
  );
};

export const commands: typeof commandsType = {
  registerCommand,
  executeCommand,
  getCommands,
};
