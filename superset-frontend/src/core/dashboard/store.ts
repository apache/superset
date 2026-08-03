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
 * @fileoverview Leaf module wrapping the `DashboardProvider` singleton.
 *
 * Building block components (built-in or extension-contributed) read from
 * `provider` and subscribe via `useDashboardRevision` directly — importing
 * from here rather than from `./index` avoids a cycle, since `./index` is
 * what registers the built-in blocks (which import the provider) in the
 * first place.
 */

import { useSyncExternalStore } from 'react';
import DashboardProvider from './DashboardProvider';

export const provider = DashboardProvider.getInstance();

/** Ticks on every dashboard.* mutation so a subscribed component re-reads the tree. */
export const useDashboardRevision = () =>
  useSyncExternalStore(provider.subscribe, provider.getRevision);
