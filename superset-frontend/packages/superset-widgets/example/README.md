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

# Widgets host example

A Vite + React app that renders `@apache-superset/widgets` in its own layout:

- inline widgets (filter, metric tile, bar chart, pie) that cross-filter each
  other, on whichever dataset `.env` names — the defaults describe Superset's
  own `birth_names` example;
- saved widgets by id;
- a host-owned filter on `FILTER_COLUMN`;
- a log of filter and cross-filter events coming out of widgets.

By default the app has **no backend**: widgets call Superset with the viewer's
own Superset login (session cookie), so their permissions and RLS apply. Log in
to Superset in the same browser first.

`EMBED_AUTH=guest` switches to guest tokens from `server.mjs`, a local-only
token broker for apps that do have a backend. It skips what a real broker must
do: authenticate your app's user and add RLS rules.

## Setup

1. Superset config:
   ```python
   ENABLE_CORS = True
   CORS_OPTIONS = {
       "origins": ["http://localhost:5173"],
       "resources": [r"/api/*"],
       "supports_credentials": True,  # session mode sends the login cookie
       "allow_headers": ["Content-Type", "X-GuestToken"],
   }
   # guest mode only:
   FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}
   GUEST_ROLE_NAME = "Gamma"
   ```
   Session mode relies on the Superset session cookie reaching Superset from
   the app. `localhost:5173` and `localhost:8088` are the same site, so this
   works locally; an app on a different site needs a token flow instead.
2. Superset frontend dependencies installed (`cd superset-frontend && npm install`):
   this app resolves `react`, `antd`, emotion and echarts from there.
3. Saved widget ids: `GET /api/v1/widget/`, or "Embed widget" on a widget in the
   Dashboard v2 builder.
4. `cp .env.example .env` and fill it in. In session mode the dataset and its
   columns are a preference: the app resolves `FILTER_DATASET_TABLE` by name
   and replaces anything the dataset turns out not to have, so it keeps
   working when example dataset ids shift. Guest mode cannot read the dataset
   API, so there the values are used as written.
   An extension's widget needs `EMBEDDED_EXTENSION_ASSETS_PUBLIC = True` on
   the Superset side as well, since its bundle loads as a plain `<script>`.

## Run

```bash
cd superset-frontend/packages/superset-widgets/example
npm install
npm run dev      # then open http://localhost:5173 (log in to Superset first)

# guest-token mode instead (EMBED_AUTH=guest in .env):
npm run broker   # terminal 1
npm run dev      # terminal 2
```

`npm run build` type-checks and bundles without starting a server.
