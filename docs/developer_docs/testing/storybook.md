---
title: Storybook
sidebar_position: 5
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

# Storybook

Superset uses [Storybook](https://storybook.js.org/) for developing and testing UI components in isolation. Storybook provides a sandbox to build components independently, outside of the main application.

## Public Storybook

A public Storybook with components from the `master` branch is available at:

**[apache-superset.github.io/superset-ui](https://apache-superset.github.io/superset-ui/?path=/story/*)**

## Running Locally

### Main Superset Storybook

To run the main Superset Storybook locally:

```bash
cd superset-frontend

# Start Storybook (opens at http://localhost:6006)
npm run storybook

# Build static Storybook
npm run build-storybook
```

### @superset-ui Package Storybook

The `@superset-ui` packages have a separate Storybook for component library development:

```bash
cd superset-frontend

# Install dependencies and bootstrap packages
npm ci && npm run bootstrap

# Start the @superset-ui Storybook (opens at http://localhost:9001)
cd packages/superset-ui-demo
npm run storybook
```

## Adding Stories

### To an Existing Package

If stories already exist for the package, extend the `examples` array in the package's story file:

```
storybook/stories/<package>/index.js
```

### To a New Package

1. Add package dependencies:

   ```bash
   npm install <package>
   ```

2. Create a story folder matching the package name:

   ```bash
   mkdir storybook/stories/superset-ui-<package>/
   ```

3. Create an `index.js` file with the story configuration:

   ```javascript
   export default {
     examples: [
       {
         storyPath: '@superset-ui/package',
         storyName: 'My Story',
         renderStory: () => <MyComponent />,
       },
     ],
   };
   ```

   Use the `|` separator for nested stories:
   ```javascript
   storyPath: '@superset-ui/package|Category|Subcategory'
   ```

## Best Practices

- **Isolate components**: Stories should render components in isolation, without application context
- **Show variations**: Create stories for different states, sizes, and configurations
- **Document props**: Use Storybook's controls to expose configurable props
- **Test edge cases**: Include stories for loading states, error states, and empty states
