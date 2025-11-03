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
 * @fileoverview Environment API for Superset extensions.
 *
 * This module provides access to the execution environment, including system
 * clipboard operations, logging capabilities, internationalization features,
 * and environment variables. It allows extensions to interact with the host
 * system and platform in a controlled manner.
 */

import { Event } from './core';

/**
 * Interface for system clipboard operations.
 * Provides methods to read from and write to the system clipboard.
 */
export interface Clipboard {
  /**
   * Read the current clipboard contents as text.
   *
   * @returns A promise that resolves to the clipboard text content.
   *
   * @example
   * ```typescript
   * const clipboardText = await clipboard.readText();
   * console.log('Clipboard contains:', clipboardText);
   * ```
   */
  readText(): Promise<string>;

  /**
   * Writes text into the clipboard, replacing any existing content.
   *
   * @param value The text to write to the clipboard.
   * @returns A promise that resolves when the write operation completes.
   *
   * @example
   * ```typescript
   * await clipboard.writeText('Hello, world!');
   * console.log('Text copied to clipboard');
   * ```
   */
  writeText(value: string): Promise<void>;
}

/**
 * Logging levels for controlling the verbosity of log output.
 * Higher numeric values indicate more restrictive logging levels.
 */
export enum LogLevel {
  /**
   * No messages are logged with this level.
   * Use this to completely disable logging.
   */
  Off = 0,

  /**
   * All messages are logged with this level.
   * Most verbose logging level, includes all types of messages.
   */
  Trace = 1,

  /**
   * Messages with debug and higher log level are logged with this level.
   * Useful for development and troubleshooting.
   */
  Debug = 2,

  /**
   * Messages with info and higher log level are logged with this level.
   * General informational messages about application flow.
   */
  Info = 3,

  /**
   * Messages with warning and higher log level are logged with this level.
   * Indicates potential issues that don't prevent operation.
   */
  Warning = 4,

  /**
   * Only error messages are logged with this level.
   * Most restrictive level, shows only critical failures.
   */
  Error = 5,
}

/**
 * Represents the preferred user-language, like `de-CH`, `fr`, or `en-US`.
 */
export declare const language: string;

/**
 * The system clipboard.
 */
export declare const clipboard: Clipboard;

/**
 * The current log level of the editor.
 */
export declare const logLevel: LogLevel;

/**
 * An {@link Event} which fires when the log level of the editor changes.
 */
export declare const onDidChangeLogLevel: Event<LogLevel>;

/**
 * Opens an external URL in the default system browser or application.
 * This function provides a secure way to open external resources while
 * respecting user security preferences.
 *
 * @param target The URL to open externally.
 * @returns A promise that resolves to true if the URL was successfully opened, false otherwise.
 *
 * @example
 * ```typescript
 * const success = await openExternal(new URL('https://superset.apache.org'));
 * if (success) {
 *   console.log('URL opened successfully');
 * } else {
 *   console.log('Failed to open URL');
 * }
 * ```
 */
export declare function openExternal(target: URL): Promise<boolean>;

/**
 * Gets an environment variable value.
 * @param name The name of the environment variable
 * @returns The value of the environment variable or undefined if not found
 */
export declare function getEnvironmentVariable(
  name: string,
): string | undefined;
