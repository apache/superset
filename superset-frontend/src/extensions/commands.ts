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
import { commands as commandsType } from '@apache-superset/types';
import { Disposable } from '@apache-superset/primitives';

const registerCommand: typeof commandsType.registerCommand = (
  command,
  callback,
  thisArg,
) => {
  console.log('registering command', command);
  return new Disposable(() => {
    console.log('disposing command', command);
  });
};

const executeCommand: typeof commandsType.executeCommand = <T>(
  command: string,
  ...args: any[]
): Promise<T> => {
  console.log('executing command', command, args);
  // Replace with actual implementation if needed
  return Promise.resolve(undefined as T);
};

const getCommands: typeof commandsType.getCommands = filterInternal => {
  console.log('getting commands');
  return Promise.resolve([]);
};

export const commands: typeof commandsType = {
  registerCommand,
  executeCommand,
  getCommands,
};
