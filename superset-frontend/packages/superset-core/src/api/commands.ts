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

/**
 * @fileoverview Command system API for Superset extensions.
 *
 * This module provides a command registry and execution system that allows extensions
 * to register custom commands and invoke them programmatically. Commands can be triggered
 * via keyboard shortcuts, menu items, programmatic calls, or other user interactions.
 */

import { Disposable } from './core';

/**
 * Registers a command that can be invoked via a keyboard shortcut,
 * a menu item, an action, or directly.
 *
 * Registering a command with an existing command identifier twice
 * will cause an error.
 *
 * @param command A unique identifier for the command.
 * @param callback A command handler function.
 * @param thisArg The `this` context used when invoking the handler function.
 * @returns Disposable which unregisters this command on disposal.
 */
export declare function registerCommand(
  command: string,
  callback: (...args: any[]) => any,
  thisArg?: any,
): Disposable;

/**
 * Executes the command denoted by the given command identifier.
 *
 * @param command Identifier of the command to execute.
 * @param rest Parameters passed to the command function.
 * @returns A promise that resolves to the returned value of the given command. Returns `undefined` when
 * the command handler function doesn't return anything.
 */
export declare function executeCommand<T = unknown>(
  command: string,
  ...rest: any[]
): Promise<T>;

/**
 * Retrieve the list of all available commands. Commands starting with an underscore are
 * treated as internal commands.
 *
 * @param filterInternal Set `true` to not see internal commands (starting with an underscore)
 * @returns Promise that resolves to a list of command ids.
 */
export declare function getCommands(
  filterInternal?: boolean,
): Promise<string[]>;
