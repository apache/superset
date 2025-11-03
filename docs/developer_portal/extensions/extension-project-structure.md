---
title: Extension Project Structure
sidebar_position: 3
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

# Extension Project Structure

The `apache-superset-extensions-cli` package provides a command-line interface (CLI) that streamlines the extension development workflow. It offers the following commands:

```
superset-extensions init: Generates the initial folder structure and scaffolds a new extension project.

superset-extensions build: Builds extension assets.

superset-extensions bundle: Packages the extension into a .supx file.

superset-extensions dev: Automatically rebuilds the extension as files change.
```

When creating a new extension with `superset-extensions init <extension-name>`, the CLI generates a standardized folder structure:

```
dataset_references/
├── extension.json
├── frontend/
│   ├── src/
│   ├── webpack.config.js
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── src/
│        └── dataset_references/
│   ├── tests/
│   ├── pyproject.toml
│   └── requirements.txt
├── dist/
│   ├── manifest.json
│   ├── frontend
│        └── dist/
│             ├── remoteEntry.d7a9225d042e4ccb6354.js
│             └── 900.038b20cdff6d49cfa8d9.js
│   └── backend
│        └── dataset_references/
│             ├── __init__.py
│             ├── api.py
│             └── entrypoint.py
├── dataset_references-1.0.0.supx
└── README.md
```

The `extension.json` file serves as the declared metadata for the extension, containing the extension's name, version, author, description, and a list of capabilities. This file is essential for the host application to understand how to load and manage the extension.

The `frontend` directory contains the source code for the frontend components of the extension, including React components, styles, and assets. The `webpack.config.js` file is used to configure Webpack for building the frontend code, while the `tsconfig.json` file defines the TypeScript configuration for the project. The `package.json` file specifies the dependencies and scripts for building and testing the frontend code.

The `backend` directory contains the source code for the backend components of the extension, including Python modules, tests, and configuration files. The `pyproject.toml` file is used to define the Python package and its dependencies, while the r`equirements.txt` file lists the required Python packages for the extension. The `src` folder contains the functional backend source files, `tests` directory contains unit tests for the backend code, ensuring that the extension behaves as expected and meets the defined requirements.

The `dist` directory is built when running the `build` or `dev` command, and contains the files that will be included in the bundle. The `manifest.json` file contains critical metadata about the extension, including the majority of the contents of the `extension.json` file, but also other build-time information, like the name of the built Webpack Module Federation remote entry file. The files in the `dist` directory will be zipped into the final `.supx` file. Although this file is technically a zip archive, the `.supx` extension makes it clear that it is a Superset extension package and follows a specific file layout. This packaged file can be distributed and installed in Superset instances.

The `README.md` file provides documentation and instructions for using the extension, including how to install, configure, and use its functionality.
