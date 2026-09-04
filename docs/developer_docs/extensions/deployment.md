---
title: Deployment
sidebar_position: 7
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

# Deployment

Once an extension has been developed, the deployment process involves packaging and uploading it to the host application.

Packaging is handled by the `superset-extensions bundle` command, which:

1. Builds frontend assets using Webpack (with Module Federation configuration).
2. Collects backend Python source files and all necessary resources.
3. Generates a `manifest.json` with build-time metadata, including the contents of `extension.json` and references to built assets.
4. Packages everything into a `.supx` file (a zip archive with a specific structure required by Superset).

To deploy an extension, place the `.supx` file in the extensions directory configured via `EXTENSIONS_PATH` in your `superset_config.py`:

``` python
EXTENSIONS_PATH = "/path/to/extensions"
```

During application startup, Superset automatically discovers and loads all `.supx` files from this directory:

1. Scans the configured directory for `.supx` files.
2. Validates each file is a properly formatted zip archive.
3. Extracts and validates the extension manifest and metadata.
4. Loads the extension, making it available for use.

This file-based approach simplifies deployment in containerized environments and enables version control of extensions alongside infrastructure configuration.
