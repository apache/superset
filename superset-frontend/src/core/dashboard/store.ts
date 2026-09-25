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
 * @fileoverview Leaf module wrapping the `DashboardProvider` the current
 * tree lives in.
 *
 * The builder (and the public `dashboard.*` API extensions call) works on
 * the singleton `provider`. Widget components read theirs through
 * `useDashboardStore` instead, which resolves to the singleton unless a
 * `DashboardStoreContext` above them says otherwise — how an embedding
 * runtime renders several independent trees on one page. Importing from
 * here rather than from `./index` avoids a cycle, since `./index` is what
 * registers the built-in widgets (which import the store) in the first
 * place.
 */

import { createContext, useContext, useSyncExternalStore } from 'react';
import DashboardProvider from './DashboardProvider';

export const provider = DashboardProvider.getInstance();

export const DashboardStoreContext = createContext<
  DashboardProvider | undefined
>(undefined);

/** The store the nearest `DashboardStoreContext` names, else the builder's singleton. */
export const useDashboardStore = (): DashboardProvider =>
  useContext(DashboardStoreContext) ?? provider;

/** Ticks on every dashboard.* mutation so a subscribed component re-reads the tree. */
export const useDashboardRevision = (
  store: DashboardProvider = useDashboardStore(),
): number => useSyncExternalStore(store.subscribe, store.getRevision);
