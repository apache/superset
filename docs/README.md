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

To create a new version for any section, use the Docusaurus version command with the appropriate plugin ID or use our automated scripts:

#### Using Automated Scripts (Recommended)
```bash
# Main Documentation
yarn version:add:docs 1.2.0

# Developer Portal
yarn version:add:developer_portal 1.2.0

# Component Playground (when enabled)
yarn version:add:components 1.2.0
```

#### Manual Commands
```bash
# Main Documentation
yarn docusaurus docs:version 1.2.0

# Developer Portal
yarn docusaurus docs:version:developer_portal 1.2.0

# Component Playground (when enabled)
yarn docusaurus docs:version:components 1.2.0
```

### Managing Versions

#### With Automated Scripts
The automated scripts handle all configuration updates automatically. No manual editing required!

#### Manual Configuration
If creating versions manually, you'll need to:

1. **Update `versions-config.json`** (or `docusaurus.config.ts` if not using dynamic config):
   - Add version to `onlyIncludeVersions` array
   - Add version metadata to `versions` object
   - Update `lastVersion` if needed

2. **Files Created by Versioning**:
   When a new version is created, Docusaurus generates:
   - **Versioned docs folder**: `[section]_versioned_docs/version-X.X.X/`
   - **Versioned sidebars**: `[section]_versioned_sidebars/version-X.X.X-sidebars.json`
   - **Versions list**: `[section]_versions.json`

   Note: For main docs, the prefix is omitted (e.g., `versioned_docs/` instead of `docs_versioned_docs/`)

3. **Important**: After adding a version, restart the development server to see changes:
   ```bash
   yarn stop
   yarn start
   ```

### Removing a Version

#### Using Automated Scripts (Recommended)
```bash
# Main Documentation
yarn version:remove:docs 1.0.0

# Developer Portal
yarn version:remove:developer_portal 1.0.0

# Component Playground
yarn version:remove:components 1.0.0
```

#### Manual Removal
To manually remove a version:

1. **Delete the version folder** from the appropriate location:
   - Main docs: `versioned_docs/version-X.X.X/` (no prefix for main)
   - Developer Portal: `developer_portal_versioned_docs/version-X.X.X/`
   - Components: `components_versioned_docs/version-X.X.X/`

2. **Delete the version metadata file**:
   - Main docs: `versioned_sidebars/version-X.X.X-sidebars.json` (no prefix)
   - Developer Portal: `developer_portal_versioned_sidebars/version-X.X.X-sidebars.json`
   - Components: `components_versioned_sidebars/version-X.X.X-sidebars.json`

3. **Update the versions list file**:
   - Main docs: `versions.json`
   - Developer Portal: `developer_portal_versions.json`
   - Components: `components_versions.json`

4. **Update configuration**:
   - If using dynamic config: Update `versions-config.json`
   - If using static config: Update `docusaurus.config.ts`

5. **Restart the server** to see changes

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

### Troubleshooting

#### Version Not Showing After Creation
- **Restart the server**: Changes to version configuration require a server restart
- **Check config file**: Ensure `versions-config.json` includes the new version
- **Verify files exist**: Check that versioned docs folder was created

#### Broken Links in Versioned Documentation
When creating a new version, links in the documentation are preserved as-is. Common issues:
- **Cross-section links**: Links between sections (e.g., from developer_portal to docs) need to be version-aware
- **Absolute vs relative paths**: Use relative paths within the same section
- **Version-specific URLs**: Update hardcoded URLs to use version variables

To fix broken links:
1. Use `type: 'doc'` with `docId` for version-aware navigation in navbar
2. Use relative paths within the same documentation section
3. Test all versions after creation to identify broken links
