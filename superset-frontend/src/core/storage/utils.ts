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
 * Shared utilities for extension storage implementations.
 */

import getBootstrapData from 'src/utils/getBootstrapData';
import { getCurrentContext } from 'src/core/extensions';

// Key prefix for extension storage
export const KEY_PREFIX = 'superset-ext';

// Default TTL for ephemeral state: 1 hour
export const DEFAULT_TTL = 3600;

/**
 * Get the current extension ID from ambient context.
 * The context is set by ExtensionsLoader when executing extension code.
 */
export function getCurrentExtensionId(): string {
  const context = getCurrentContext();
  if (!context) {
    throw new Error(
      'Storage APIs can only be used within an extension context. ' +
        'Ensure this code is being executed by an extension.',
    );
  }
  return context.extension.id;
}

/**
 * Get the current user ID from bootstrap data.
 */
export function getCurrentUserId(): number {
  const bootstrapData = getBootstrapData();
  const userId = bootstrapData?.user?.userId;
  if (userId === undefined) {
    throw new Error(
      'Storage APIs require an authenticated user. ' +
        'Ensure the user is logged in.',
    );
  }
  return userId;
}

/**
 * Build a storage key with the standard prefix.
 */
export function buildKey(
  extensionId: string,
  ...parts: (string | number)[]
): string {
  return [KEY_PREFIX, extensionId, ...parts].join(':');
}
