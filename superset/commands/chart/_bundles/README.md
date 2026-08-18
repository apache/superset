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

# `query_context_bundle.js` — generated build artifact

This directory holds the bundled frontend `buildQuery` code that the backend
runs in V8 (`py_mini_racer`) to synthesize a faithful `query_context` for
imported charts (Apache Superset #33615).

**`query_context_bundle.js` is generated, not committed.** Build it with:

```bash
cd superset-frontend
npm run build:backend-querycontext
```

Source entry: `superset-frontend/src/backend-querycontext/entry.ts`.
Consumer: `superset/commands/chart/query_context_generator.py`.

When the bundle is absent the generator degrades gracefully and the importer
falls back to the pure-Python generic derivation in
`superset/commands/chart/query_context_builder.py` — nothing breaks; parity just
isn't available until the bundle is built (a packaging/CI step).
