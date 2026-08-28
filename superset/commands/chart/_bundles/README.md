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

**`query_context_bundle.js` is a generated build artifact, not committed.** It is
produced automatically as part of the standard frontend build:

```bash
cd superset-frontend
npm run build            # runs build:backend-querycontext via the postbuild hook
```

or on its own with `npm run build:backend-querycontext`.

Because the supported build produces it and `MANIFEST.in` ships
`superset/commands/chart/_bundles/*.js`, packaged Superset distributions carry the
bundle by default (it is `.gitignore`d in the working tree but included at build
time).

Source entry: `superset-frontend/src/backend-querycontext/entry.ts`.
Consumer: `superset/commands/chart/query_context_generator.py`.

To enable exact parity at runtime, install the V8 runtime extra:

```bash
pip install "apache-superset[querycontext]"   # pulls py-mini-racer
```

When the bundle or `py_mini_racer` is absent the generator degrades gracefully and
the importer falls back to the pure-Python generic derivation in
`superset/commands/chart/query_context_builder.py` — nothing breaks; parity just
isn't available until both are present.
