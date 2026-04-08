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
import { extensions as extensionsApi } from '@apache-superset/core';
import ExtensionsLoader from 'src/extensions/ExtensionsLoader';

type ExtensionContext = extensionsApi.ExtensionContext;

/**
 * Current extension context for ambient context pattern.
 * Set before executing extension code, restored after.
 */
let currentContext: ExtensionContext | null = null;

/**
 * Get the current extension context.
 * @internal
 */
export function getCurrentContext(): ExtensionContext | null {
  return currentContext;
}

/**
 * Execute a callback with the given extension context.
 * Saves the previous context and restores it after execution,
 * supporting nested context switches.
 *
 * @param ctx The extension context to use during execution
 * @param fn The callback to execute
 * @returns The result of the callback
 * @internal
 */
export function useContext<T>(ctx: ExtensionContext, fn: () => T): T {
  const previousContext = currentContext;
  currentContext = ctx;
  try {
    return fn();
  } finally {
    currentContext = previousContext;
  }
}

/**
 * Async version of useContext for async callbacks.
 * @internal
 */
export async function useContextAsync<T>(
  ctx: ExtensionContext,
  fn: () => Promise<T>,
): Promise<T> {
  const previousContext = currentContext;
  currentContext = ctx;
  try {
    return await fn();
  } finally {
    currentContext = previousContext;
  }
}

const getContext: typeof extensionsApi.getContext = () => {
  if (!currentContext) {
    throw new Error(
      'getContext() must be called within an extension context. ' +
        'Ensure this code is being executed during extension loading or ' +
        'within an extension callback.',
    );
  }
  return currentContext;
};

const getExtension: typeof extensionsApi.getExtension = id =>
  ExtensionsLoader.getInstance().getExtension(id);

const getAllExtensions: typeof extensionsApi.getAllExtensions = () =>
  ExtensionsLoader.getInstance().getExtensions();

export const extensions: typeof extensionsApi = {
  getContext,
  getExtension,
  getAllExtensions,
};
