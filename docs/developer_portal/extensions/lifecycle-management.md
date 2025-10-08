---
title: Lifecycle and Management
sidebar_position: 9
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

# Lifecycle and Management

Superset will manage the full lifecycle of extensions, including activation, deactivation, and cleanup. The lifecycle is designed to ensure that extensions can safely register resources and reliably clean them up when no longer needed.

## Frontend lifecycle

- When an extension is activated, its `activate(context)` function is called. The extension should register all event listeners, commands, views, and other contributions using the provided context, and add any disposables to `context.disposables`.
- When the extension is deactivated (e.g., disabled or uninstalled), Superset automatically calls `dispose()` on all items in `context.disposables`, ensuring that event listeners, commands, and UI contributions are removed and memory leaks are avoided.

## Backend lifecycle

- Backend entry points, which can add REST API endpoints or execute arbitrary backend code, are eagerly evaluated during startup. Other backend code is lazily loaded when needed, ensuring minimal startup latency.
- In the future, we plan to leverage mechanisms like Redis pub/sub (already an optional dependency of Superset) to dynamically manage the lifecycle of extensions' backend functionality. This will ensure that all running instances of the Superset backend have the same available extensions without requiring a restart. This will be addressed in a follow-up SIP.

The proof-of-concept (POC) code for this SIP already implements a management module where administrators can upload, delete, enable/disable, and inspect the manifest for installed extensions via the Superset UI, making extension operations straightforward. These operations are currently supported dynamically for frontend extensions. For backend extensions, dynamic upload, deletion, and enable/disable are planned for a future iteration; at present, changes to backend extensions (such as uploading, deleting, or enabling/disabling) still require a server restart.

https://github.com/user-attachments/assets/4eb7064b-3290-4e4c-b88b-52d8d1c11245
