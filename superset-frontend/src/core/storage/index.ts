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
 * Host implementation for extension storage APIs.
 *
 * This module provides the concrete implementations that are exposed to
 * extensions via Module Federation. Extensions import from @apache-superset/core
 * and the host provides these implementations at runtime.
 *
 * All tiers follow the same pattern:
 * - User-scoped by default (private to current user)
 * - shared() accessor for data visible to all users
 */

import { storage as storageApi } from '@apache-superset/core';
import { localState } from './localState';
import { sessionState } from './sessionState';
import { ephemeralState } from './ephemeralState';

export const storage: typeof storageApi = {
  localState,
  sessionState,
  ephemeralState,
};
