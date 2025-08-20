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

# Docusaurus Multi-Instance Versioning Guide

This documentation site uses Docusaurus with multiple independently versioned documentation sections:

- **Main Documentation** (`/docs/`) - Core Superset documentation
- **Developer Portal** (`/developer_portal/`) - Developer guides and tutorials  
- **Components** (`/components/`) - Component library documentation

Each section maintains its own version history and can be versioned independently.

## Current Version Structure

All sections support these versions:
- **Next** (current/unreleased) - Latest changes from the repository
- **1.1.0** - Current stable release (default)
- **1.0.0** - Previous stable release

## Creating New Versions

### Main Documentation (`/docs/`)

```bash
# Create a new version (e.g., 1.2.0)
yarn docusaurus docs:version 1.2.0

# This creates:
# - versioned_docs/version-1.2.0/ (snapshot of current docs/)
# - versioned_sidebars/version-1.2.0-sidebars.json (snapshot of sidebars.js)
# - Updates versions.json
```

### Developer Portal (`/developer_portal/`)

```bash
# Create a new version for developer portal
yarn docusaurus docs:version:developer_portal 1.2.0

# This creates:
# - developer_portal_versioned_docs/version-1.2.0/
# - developer_portal_versioned_sidebars/version-1.2.0-sidebars.json  
# - Updates developer_portal_versions.json
```

### Components (`/components/`)

```bash
# Create a new version for components
yarn docusaurus docs:version:components 1.2.0

# This creates:
# - components_versioned_docs/version-1.2.0/
# - components_versioned_sidebars/version-1.2.0-sidebars.json
# - Updates components_versions.json
```

## Adding New Versions to Dropdowns

After creating a new version, you must update the docusaurus configuration to include it in the version dropdown:

### 1. Update Main Documentation

Edit `docusaurus.config.ts` in the main docs section:

```typescript
docs: {
  // ...
  lastVersion: '1.2.0', // Set as default version
  onlyIncludeVersions: ['current', '1.2.0', '1.1.0', '1.0.0'], // Add new version
  versions: {
    current: {
      label: 'Next',
      path: 'next',
      banner: 'unreleased',
    },
    '1.2.0': {         // Add new version config
      label: '1.2.0',
      path: '1.2.0',
      banner: 'none',
    },
    // ... existing versions
  },
}
```

### 2. Update Developer Portal

Edit the `developer_portal` plugin configuration:

```typescript
{
  id: 'developer_portal',
  // ...
  lastVersion: '1.2.0',
  onlyIncludeVersions: ['current', '1.2.0', '1.1.0', '1.0.0'],
  versions: {
    current: {
      label: 'Next',
      path: 'next',
      banner: 'unreleased',
    },
    '1.2.0': {
      label: '1.2.0',
      path: '1.2.0',
      banner: 'none',
    },
    // ... existing versions
  },
}
```

### 3. Update Components

Edit the `components` plugin configuration:

```typescript
{
  id: 'components',
  // ...
  lastVersion: '1.2.0',
  onlyIncludeVersions: ['current', '1.2.0', '1.1.0', '1.0.0'],
  versions: {
    current: {
      label: 'Next',
      path: 'next',
      banner: 'unreleased',
    },
    '1.2.0': {
      label: '1.2.0',
      path: '1.2.0',
      banner: 'none',
    },
    // ... existing versions
  },
}
```

## Version Behavior

### "Next" vs "Current"
- **Next** (`current` in config) represents unreleased changes in the main repository
- Users see "Next" in the dropdown, but internally Docusaurus uses `current`
- This is the working directory content (e.g., `docs/`, `developer_portal/`, `components/`)

### Default Version
- `lastVersion` determines which version users see when visiting without a specific version
- Example: `/docs/` redirects to `/docs/1.1.0/` if `lastVersion: '1.1.0'`

### Version Paths
- **Next**: `/docs/next/`, `/developer_portal/next/`, `/components/next/`
- **1.1.0**: `/docs/1.1.0/`, `/developer_portal/1.1.0/`, `/components/1.1.0/`
- **1.0.0**: `/docs/1.0.0/`, `/developer_portal/1.0.0/`, `/components/1.0.0/`

## Important Notes

### Import Path Fixes
When creating versioned docs, relative import paths may break. For versioned docs in subdirectories, update import paths:

```javascript
// In docs/ (works)
import data from '../data/file.json';

// In versioned_docs/version-1.2.0/ (broken)
import data from '../data/file.json';  

// In versioned_docs/version-1.2.0/ (fixed)
import data from '../../data/file.json';
```

### Cleanup After Versioning
1. Clear Docusaurus cache: `yarn clear`
2. Restart development server: `yarn start`
3. Test all version dropdowns work correctly
4. Verify all routes load without errors

## File Structure

```
docs/
├── docs/                           # Main documentation (Next)
├── versioned_docs/
│   ├── version-1.1.0/             # Main docs v1.1.0
│   └── version-1.0.0/             # Main docs v1.0.0
├── versioned_sidebars/
│   ├── version-1.1.0-sidebars.json
│   └── version-1.0.0-sidebars.json
├── versions.json                   # Main docs versions
├── developer_portal/               # Developer portal (Next)  
├── developer_portal_versioned_docs/
│   ├── version-1.1.0/
│   └── version-1.0.0/
├── developer_portal_versioned_sidebars/
├── developer_portal_versions.json
├── components/                     # Components (Next)
├── components_versioned_docs/
│   ├── version-1.1.0/
│   └── version-1.0.0/
├── components_versioned_sidebars/
├── components_versions.json
└── docusaurus.config.ts           # All version configurations
```

## Troubleshooting

### Blank Pages
- Check version configuration in `docusaurus.config.ts`
- Ensure `onlyIncludeVersions` includes the version
- Verify versioned content exists

### Import Errors  
- Fix relative paths in versioned docs
- Check webpack aliases in `src/webpack.extend.ts`

### Version Dropdown Missing
- Verify version is in `onlyIncludeVersions` array
- Check version object in `versions` configuration
- Clear cache and restart server
