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

This is the public documentation site for Superset, built using
[Docusaurus 3](https://docusaurus.io/). See
[CONTRIBUTING.md](../CONTRIBUTING.md#documentation) for documentation on
contributing to documentation.

## Version Management

The Superset documentation site uses Docusaurus versioning with three independent versioned sections:

- **Main Documentation** (`/docs/`) - Core Superset documentation
- **Developer Portal** (`/developer_portal/`) - Developer guides and tutorials  
- **Component Playground** (`/components/`) - Interactive component examples (currently disabled)

Each section maintains its own version history and can be versioned independently.

### Creating a New Version

To create a new version for any section, use the Docusaurus version command with the appropriate plugin ID:

#### Main Documentation
```bash
# Create a new version from the current docs
yarn docusaurus docs:version 1.2.0
```

#### Developer Portal
```bash
# Create a new version from the current developer_portal docs
yarn docusaurus docs:version:developer_portal 1.2.0
```

#### Component Playground (when enabled)
```bash
# Create a new version from the current components docs
yarn docusaurus docs:version:components 1.2.0
```

### Managing Versions

After creating a new version, update the configuration in `docusaurus.config.ts`:

1. **Update the `onlyIncludeVersions` array** to include your new version:
   ```typescript
   onlyIncludeVersions: ['current', '1.2.0', '1.1.0', '1.0.0'],
   ```

2. **Add version metadata** in the `versions` object:
   ```typescript
   versions: {
     current: {
       label: 'Next',
       path: '',  // For main docs to show at /docs/
       banner: 'unreleased',
     },
     '1.2.0': {
       label: '1.2.0',
       path: '1.2.0',
       banner: 'none',
     },
     // ... other versions
   }
   ```

3. **Set the default version** (optional):
   - For main docs: Set `lastVersion: 'current'` to make Next the default
   - For other sections: Set `lastVersion: '1.2.0'` to make a specific version the default

### Removing a Version

To remove a version from any section:

1. **Delete the version folder** from the appropriate location:
   - Main docs: `docs_versioned_docs/version-X.X.X/`
   - Developer Portal: `developer_portal_versioned_docs/version-X.X.X/`
   - Components: `components_versioned_docs/version-X.X.X/`

2. **Delete the version metadata file**:
   - Main docs: `docs_versioned_sidebars/version-X.X.X-sidebars.json`
   - Developer Portal: `developer_portal_versioned_sidebars/version-X.X.X-sidebars.json`
   - Components: `components_versioned_sidebars/version-X.X.X-sidebars.json`

3. **Update `versions.json`** in the root directory for the appropriate section

4. **Update `docusaurus.config.ts`**:
   - Remove the version from the `onlyIncludeVersions` array
   - Remove the version configuration from the `versions` object
   - Update `lastVersion` if needed

### Version Configuration Examples

#### Main Documentation (default plugin)
```typescript
docs: {
  includeCurrentVersion: true,
  lastVersion: 'current',  // Makes /docs/ show Next version
  onlyIncludeVersions: ['current', '1.1.0', '1.0.0'],
  versions: {
    current: {
      label: 'Next',
      path: '',  // Empty path for default routing
      banner: 'unreleased',
    },
    '1.1.0': {
      label: '1.1.0',
      path: '1.1.0',
      banner: 'none',
    },
  },
}
```

#### Developer Portal & Components (custom plugins)
```typescript
{
  id: 'developer_portal',
  path: 'developer_portal',
  routeBasePath: 'developer_portal',
  includeCurrentVersion: true,
  lastVersion: '1.1.0',  // Default version
  onlyIncludeVersions: ['current', '1.1.0', '1.0.0'],
  versions: {
    current: {
      label: 'Next',
      path: 'next',
      banner: 'unreleased',
    },
    '1.1.0': {
      label: '1.1.0',
      path: '1.1.0',
      banner: 'none',
    },
  },
}
```

### Best Practices

1. **Version naming**: Use semantic versioning (e.g., 1.0.0, 1.1.0, 2.0.0)
2. **Version banners**: Use `'unreleased'` for development versions, `'none'` for stable releases
3. **Limit displayed versions**: Use `onlyIncludeVersions` to show only relevant versions
4. **Test locally**: Always test version changes locally before deploying
5. **Independent versioning**: Each section can have different version numbers and release cycles
