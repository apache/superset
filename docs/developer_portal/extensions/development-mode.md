---
title: Development Mode
sidebar_position: 10
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

# Development Mode

Development mode accelerates extension development by letting developers see changes in Superset quickly, without the need for repeated packaging and uploading. To enable development mode, set the `LOCAL_EXTENSIONS` configuration in your `superset_config.py`:

``` python
LOCAL_EXTENSIONS = [
    "/path/to/your/extension1",
    "/path/to/your/extension2",
]
```

This instructs Superset to load and serve extensions directly from disk, so you can iterate quickly. Running `superset-extensions dev` watches for file changes and rebuilds assets automatically, while the Webpack development server (started separately with `npm run dev-server`) serves updated files as soon as they're modified. This enables immediate feedback for React components, styles, and other frontend code. Changes to backend files are also detected automatically and immediately synced, ensuring that both frontend and backend updates are reflected in your development environment.

Example output when running in development mode:

```
superset-extensions dev

⚙️  Building frontend assets…
✅ Frontend rebuilt
✅ Backend files synced
✅ Manifest updated
👀 Watching for changes in: /dataset_references/frontend, /dataset_references/backend
```
