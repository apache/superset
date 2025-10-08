---
title: Dynamic Module Loading
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

# Dynamic Module Loading

The extension architecture leverages Webpack's Module Federation to enable dynamic loading of frontend assets at runtime. This sophisticated mechanism involves several key concepts:

**Module Federation** allows extensions to be built and deployed independently while sharing dependencies with the host application. Extensions expose their entry points through the federation configuration:

``` typescript
new ModuleFederationPlugin({
  name: 'my_extension',
  filename: 'remoteEntry.[contenthash].js',
  exposes: {
    './index': './src/index.tsx',
  },
  externalsType: 'window',
  externals: {
    '@apache-superset/core': 'superset',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
    'antd-v5': { singleton: true }
  }
})
```

`externals` and `externalsType` ensure that extensions use the host's implementation of shared packages rather than bundling their own copies.

`shared` dependencies prevent duplication of common libraries like React and Ant Design avoiding version conflicts and reducing bundle size.

This configuration tells Webpack that when the extension imports from `@apache-superset/core`, it should resolve to `window.superset` at runtime, where the host application provides the actual implementation. The following diagram illustrates how this works in practice:

<img width="913" height="558" alt="Image" src="https://github.com/user-attachments/assets/e5e4d2ae-e8b5-4d17-a2a1-3667c65f25ca" />

During extension registration, the host application fetches the remote entry file and dynamically loads the extension's modules without requiring a rebuild or restart of Superset.

On the host application side, the `@apache-superset/core` package will be mapped to the corresponding implementations during bootstrap in the `setupExtensionsAPI` function.

``` typescript
import * as supersetCore from '@apache-superset/core';
import {
  authentication,
  core,
  commands,
  environment,
  extensions,
  sqlLab,
} from 'src/extensions';

export default function setupExtensionsAPI() {
  window.superset = {
    ...supersetCore,
    authentication,
    core,
    commands,
    environment,
    extensions,
    sqlLab,
  };
}
```
