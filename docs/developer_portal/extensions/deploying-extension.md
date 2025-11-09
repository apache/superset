---
title: Deploying an Extension
sidebar_position: 8
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

# Deploying an Extension

Once an extension has been developed, the deployment process involves packaging and uploading it to the host application.

Packaging is handled by the `superset-extensions bundle` command, which:

1. Builds frontend assets using Webpack (with Module Federation configuration).
2. Collects backend Python source files and all necessary resources.
3. Generates a `manifest.json` with build-time metadata, including the contents of `extension.json` and references to built assets.
4. Packages everything into a `.supx` file (a zip archive with a specific structure required by Superset).

Uploading is accomplished through Superset's REST API at `/api/v1/extensions/import/`. The endpoint accepts the `.supx` file as form data and processes it by:

1. Extracting and validating the extension metadata and manifest.
2. Storing extension assets in the metadata database for dynamic loading.
3. Registering the extension in the metadata database, including its name, version, author, and capabilities.
4. Automatically activating the extension, making it immediately available for use and management via the Superset UI or API.

This API-driven approach enables automated deployment workflows and simplifies extension management for administrators. Extensions can be uploaded through the Swagger UI, programmatically via scripts, or through the management interface:

https://github.com/user-attachments/assets/98b16cdd-8ec5-4812-9d5e-9915badd8f0d
