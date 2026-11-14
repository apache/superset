---
title: Version history footer
---

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

The optional `versionHistory.panel.footer` UI override adds content at the bottom
of the chart and dashboard version history panel, after its history, empty state,
pagination, and truncation notice. Without a registered component the panel is
unchanged. The component receives `entityType: 'chart' | 'dashboard'` and may
return `null` when it has nothing to display. The slot's padding is still
rendered whenever a component is registered, even if it returns `null`.

Register the component through `getExtensionsRegistry()` from `@superset-ui/core`
in the deployment's own frontend build, for example in
`src/setup/setupCodeOverrides.ts`, before the panel renders. This is a build-time
UI override, not a registration API for separately loaded `.supx` extensions. The
registry is module-local, and `@superset-ui/core` is not shared through module
federation; importing it in a `.supx` extension does not reach the host registry.

The slot does not change access to history or retention settings. Deployments
are responsible for deciding when their footer content is suitable,
including embedded contexts. It is available only in builds containing this slot
and the version history panel; it is not present in the 6.1 release branch.
