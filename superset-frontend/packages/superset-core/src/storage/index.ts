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
 * @fileoverview Storage API for Superset extensions.
 *
 * This module provides storage tiers for extensions:
 *
 * - **localState** (Tier 1): Browser localStorage - persists across sessions
 * - **sessionState** (Tier 1): Browser sessionStorage - cleared on tab close
 * - **ephemeralState** (Tier 2): Server-side cache with TTL - short-lived
 * - **persistentState** (Tier 3): Database storage - durable [future]
 *
 * All tiers follow the same API pattern:
 * - User-scoped by default (private to current user)
 * - `shared` accessor for data visible to all users
 *
 * @example
 * ```typescript
 * import { localState, sessionState, ephemeralState } from '@apache-superset/core/storage';
 *
 * // Tier 1 - localStorage (persists across browser sessions)
 * await localState.set('sidebar_collapsed', true);
 * const isCollapsed = await localState.get('sidebar_collapsed');
 *
 * // Tier 1 - sessionStorage (cleared on tab close)
 * await sessionState.set('wizard_step', 3);
 * const step = await sessionState.get('wizard_step');
 *
 * // Tier 2 - Server cache (short-lived, with TTL)
 * await ephemeralState.set('job_progress', { pct: 42 }, { ttl: 300 });
 * const progress = await ephemeralState.get('job_progress');
 *
 * // Shared state (visible to all users)
 * await localState.shared.set('device_id', 'abc-123');
 * await ephemeralState.shared.set('shared_result', { data: [1, 2, 3] });
 * ```
 */

export * as localState from './localState';
export * as sessionState from './sessionState';
export * as ephemeralState from './ephemeralState';
export * as persistentState from './persistentState';
export * from './types';
