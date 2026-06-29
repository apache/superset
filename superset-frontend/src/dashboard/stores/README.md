<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Dashboard client state

Dashboard-page client state lives in Zustand stores (one per former Redux
slice: `dashboardInfo`, `dashboardState`, `dashboardLayout`, `dashboardSlices`,
`nativeFilters`, plus `src/dataMask`). Server state goes through TanStack Query
hooks in `src/dashboard/queries`. `charts`, `datasources` and `dashboardFilters`
are shared with Explore and intentionally stay in Redux.

Each store has three layers:

- `hooks.ts`: reactive, single-field selectors for components
  (`useDashboardId()`, `useEditMode()`, `useDataMask()`). Selectors return
  stable references; add a hook instead of reading the raw store.
- `actions.ts`: imperative writes for event handlers, effects and thunks
  (`setEditMode(true)`, `updateDataMask(id, mask)`). They call
  `useXStore.getState().action()`, so middleware (devtools, undo history,
  subscriptions) always applies.
- `useXStore.ts`: the store itself. Only adapter layers import it directly:
  hydration (`actions/hydrate.ts`), `containers/SyncDashboardState`, the
  embedded SDK, tests. An oxlint `no-restricted-imports` rule enforces this for
  `src/dashboard/components/**`.

Mutations that change server data invalidate the affected query keys from
`queries/keys.ts` and update the stores in `onSuccess`, never in the mutation
function.
