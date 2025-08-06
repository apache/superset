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
import { Event } from './core';

export interface Clipboard {
  /**
   * Read the current clipboard contents as text.
   * @returns A promise that resolves to a string.
   */
  readText(): Promise<string>;

  /**
   * Writes text into the clipboard.
   * @returns A promise that resolves when writing happened.
   */
  writeText(value: string): Promise<void>;
}

/**
 * Log levels
 */
export enum LogLevel {
  /**
   * No messages are logged with this level.
   */
  Off = 0,

  /**
   * All messages are logged with this level.
   */
  Trace = 1,

  /**
   * Messages with debug and higher log level are logged with this level.
   */
  Debug = 2,

  /**
   * Messages with info and higher log level are logged with this level.
   */
  Info = 3,

  /**
   * Messages with warning and higher log level are logged with this level.
   */
  Warning = 4,

  /**
   * Only error messages are logged with this level.
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

export declare function openExternal(target: URL): Promise<boolean>; // TODO: URL or URI?

/**
 * Gets an environment variable value.
 * @param name The name of the environment variable
 * @returns The value of the environment variable or undefined if not found
 */
export declare function getEnvironmentVariable(
  name: string,
): string | undefined;
