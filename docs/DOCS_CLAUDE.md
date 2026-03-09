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

# LLM Context Guide for Apache Superset Documentation

This guide helps LLMs work with the Apache Superset documentation site built with Docusaurus 3.

## 📍 Current Directory Context

You are currently in the `/docs` subdirectory of the Apache Superset repository. When referencing files from the main codebase, use `../` to access the parent directory.

```
/Users/evan_1/GitHub/superset/     # Main repository root
├── superset/                      # Python backend code
├── superset-frontend/             # React/TypeScript frontend
└── docs/                         # Documentation site (YOU ARE HERE)
    ├── docs/                     # Main documentation content
    ├── developer_portal/         # Developer guides (currently disabled)
    ├── components/               # Component playground (currently disabled)
    └── docusaurus.config.ts      # Site configuration
```

## 🚀 Quick Commands

```bash
# Development
yarn start                 # Start dev server on http://localhost:3000
yarn stop                 # Stop running dev server
yarn build                # Build production site
yarn serve                # Serve built site locally

# Version Management (USE THESE, NOT docusaurus commands)
yarn version:add:docs <version>              # Add new docs version
yarn version:add:developer_portal <version>  # Add developer portal version  
yarn version:add:components <version>        # Add components version
yarn version:remove:docs <version>           # Remove docs version
yarn version:remove:developer_portal <version> # Remove developer portal version
yarn version:remove:components <version>      # Remove components version

# Quality Checks
yarn typecheck            # TypeScript validation
yarn eslint              # Lint TypeScript/JavaScript files
```

## 📁 Documentation Structure

### Main Documentation (`/docs`)
The primary documentation lives in `/docs` with this structure:

```
docs/
├── intro.md                # Auto-generated from ../README.md
├── quickstart.mdx          # Getting started guide
├── api.mdx                 # API reference with Swagger UI
├── faq.mdx                 # Frequently asked questions
├── installation/           # Installation guides
│   ├── installation-methods.mdx
│   ├── docker-compose.mdx
│   ├── docker-builds.mdx
│   ├── kubernetes.mdx
│   ├── pypi.mdx
│   └── architecture.mdx
├── configuration/          # Configuration guides
│   ├── configuring-superset.mdx
│   ├── alerts-reports.mdx
│   ├── caching.mdx
│   ├── databases.mdx
│   └── [more config docs]
├── using-superset/         # User guides
│   ├── creating-your-first-dashboard.md
│   ├── exploring-data.mdx
│   └── [more user docs]
├── contributing/           # Contributor guides
│   ├── development.mdx
│   ├── testing-locally.mdx
│   └── [more contributor docs]
└── security/              # Security documentation
    ├── security.mdx
    └── [security guides]
```

### Developer Portal (`/developer_portal`) - Currently Disabled
When enabled, contains developer-focused content:
- API documentation
- Architecture guides
- CLI tools
- Code examples

### Component Playground (`/components`) - Currently Disabled
When enabled, provides interactive component examples for UI development.

## 📝 Documentation Standards

### File Types
- **`.md` files**: Basic Markdown documents
- **`.mdx` files**: Markdown with JSX - can include React components
- **`.tsx` files in `/src`**: Custom React components and pages

### Frontmatter Structure
Every documentation page should have frontmatter:

```yaml
---
title: Page Title
description: Brief description for SEO
sidebar_position: 1  # Optional: controls order in sidebar
---
```

### MDX Component Usage
MDX files can import and use React components:

```mdx
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="npm" label="npm" default>
    ```bash
    npm install superset
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash
    yarn add superset
    ```
  </TabItem>
</Tabs>
```

### Code Blocks
Use triple backticks with language identifiers:

````markdown
```python
def hello_world():
    print("Hello, Superset!")
```

```sql title="Example Query"
SELECT * FROM users WHERE active = true;
```

```bash
# Installation command
pip install apache-superset
```
````

### Admonitions
Docusaurus supports various admonition types:

```markdown
:::note
This is a note
:::

:::tip
This is a tip
:::

:::warning
This is a warning
:::

:::danger
This is a danger warning
:::

:::info
This is an info box
:::
```

## 🔄 Version Management

### Version Configuration
Versions are managed through `versions-config.json`:

```json
{
  "docs": {
    "disabled": false,
    "lastVersion": "6.0.0",        // Default version shown
    "includeCurrentVersion": true,  // Show "Next" version
    "onlyIncludeVersions": ["current", "6.0.0"],
    "versions": {
      "current": {
        "label": "Next",
        "path": "",
        "banner": "unreleased"     // Shows warning banner
      },
      "6.0.0": {
        "label": "6.0.0",
        "path": "6.0.0",
        "banner": "none"
      }
    }
  }
}
```

### Creating New Versions
**IMPORTANT**: Always use the custom scripts, NOT native Docusaurus commands:

```bash
# ✅ CORRECT - Updates both Docusaurus and versions-config.json
yarn version:add:docs 6.1.0

# ❌ WRONG - Only updates Docusaurus, breaks version dropdown
yarn docusaurus docs:version 6.1.0
```

### Version Files Created
When versioning, these files are created:
- `versioned_docs/version-X.X.X/` - Snapshot of current docs
- `versioned_sidebars/version-X.X.X-sidebars.json` - Sidebar config
- `versions.json` - List of all versions

## 🎨 Styling and Theming

### Custom CSS
Add custom styles in `/src/css/custom.css`:

```css
:root {
  --ifm-color-primary: #20a7c9;
  --ifm-code-font-size: 95%;
}
```

### Custom Components
Create React components in `/src/components/`:

```tsx
// src/components/FeatureCard.tsx
import React from 'react';

export default function FeatureCard({title, description}) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
```

Use in MDX:

```mdx
import FeatureCard from '@site/src/components/FeatureCard';

<FeatureCard
  title="Fast"
  description="Lightning fast queries"
/>
```

## 📦 Key Dependencies

- **Docusaurus 3.8.1**: Static site generator
- **React 18.3**: UI framework
- **Ant Design 5.26**: Component library
- **@superset-ui/core**: Superset UI components
- **Swagger UI React**: API documentation
- **Prism**: Syntax highlighting

## 🔗 Linking Strategies

### Internal Links
Use relative paths for internal documentation:

```markdown
[Installation Guide](./installation/docker-compose)
[Configuration](../configuration/configuring-superset)
```

### External Links
Always use full URLs:

```markdown
[Apache Superset GitHub](https://github.com/apache/superset)
```

### Linking to Code
Reference code in the main repository:

```markdown
See the [main configuration file](https://github.com/apache/superset/blob/master/superset/config.py)
```

## 🛠️ Common Documentation Tasks

### Adding a New Guide
1. Create the `.mdx` file in the appropriate directory
2. Add frontmatter with title and description
3. Update sidebar if needed (for manual sidebar configs)

### Adding API Documentation
The API docs use Swagger UI embedded in `/docs/api.mdx`:

```mdx
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

<SwaggerUI url="/api/v1/openapi.json" />
```

### Adding Interactive Examples
Use MDX to create interactive documentation:

```mdx
import CodeBlock from '@theme/CodeBlock';
import MyComponentExample from '!!raw-loader!../examples/MyComponent.tsx';

<CodeBlock language="tsx">{MyComponentExample}</CodeBlock>
```

## 📋 Documentation Checklist

When creating or updating documentation:

- [ ] Clear, descriptive title in frontmatter
- [ ] Description for SEO in frontmatter
- [ ] Proper heading hierarchy (h1 -> h2 -> h3)
- [ ] Code examples with language identifiers
- [ ] Links verified (internal and external)
- [ ] Images have alt text
- [ ] Admonitions used for important notes
- [ ] Tested locally with `yarn start`
- [ ] No broken links (check with `yarn build`)

## 🔍 Searching and Navigation

### Sidebar Configuration
Sidebars are configured in `/sidebars.js`:

```javascript
module.exports = {
  CustomSidebar: [
    {
      type: 'doc',
      label: 'Introduction',
      id: 'intro',
    },
    {
      type: 'category',
      label: 'Installation',
      items: [
        {
          type: 'autogenerated',
          dirName: 'installation',
        },
      ],
    },
  ],
};
```

### Search
Docusaurus includes Algolia DocSearch integration configured in `docusaurus.config.ts`.

## 🚫 Common Pitfalls to Avoid

1. **Never use `yarn docusaurus docs:version`** - Use `yarn version:add:docs` instead
2. **Don't edit versioned docs directly** - Edit current docs and create new version
3. **Avoid absolute paths in links** - Use relative paths for maintainability
4. **Don't forget frontmatter** - Every doc needs title and description
5. **Test builds locally** - Run `yarn build` before committing

## 🔧 Troubleshooting

### Dev Server Issues
```bash
yarn stop     # Kill any running servers
yarn clear    # Clear cache
yarn start    # Restart
```

### Build Failures
```bash
# Check for broken links
yarn build

# TypeScript issues
yarn typecheck

# Linting issues
yarn eslint
```

### Version Issues
If versions don't appear in dropdown:
1. Check `versions-config.json` includes the version
2. Verify version files exist in `versioned_docs/`
3. Restart dev server

## 📚 Resources

- [Docusaurus Documentation](https://docusaurus.io/docs)
- [MDX Documentation](https://mdxjs.com/)
- [Superset Developer Docs](https://superset.apache.org/developer-docs/)
- [Main Superset Documentation](https://superset.apache.org/docs/intro)

## 📖 Real Examples and Patterns

### Example: Configuration Documentation Pattern
From `docs/configuration/configuring-superset.mdx`:

```mdx
---
title: Configuring Superset
hide_title: true
sidebar_position: 1
version: 1
---

# Configuring Superset

## superset_config.py

Superset exposes hundreds of configurable parameters through its
[config.py module](https://github.com/apache/superset/blob/master/superset/config.py).

```bash
export SUPERSET_CONFIG_PATH=/app/superset_config.py
```
```

**Key patterns:**
- Links to source code for reference
- Code blocks with bash/python examples
- Environment variable documentation
- Step-by-step configuration instructions

### Example: Tutorial Documentation Pattern
From `docs/using-superset/creating-your-first-dashboard.mdx`:

```mdx
import useBaseUrl from "@docusaurus/useBaseUrl";

## Creating Your First Dashboard

:::tip
In addition to this site, [Preset.io](http://preset.io/) maintains an updated set of end-user
documentation at [docs.preset.io](https://docs.preset.io/).
:::

### Connecting to a new database

<img src={useBaseUrl("/img/tutorial/tutorial_01_add_database_connection.png")} width="600" />
```

**Key patterns:**
- Import Docusaurus hooks for dynamic URLs
- Use of admonitions (:::tip) for helpful information
- Screenshots with useBaseUrl for proper path resolution
- Clear section hierarchy with ### subheadings
- Step-by-step visual guides

### Example: API Documentation Pattern
From `docs/api.mdx`:

```mdx
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

## API Documentation

<SwaggerUI url="/api/v1/openapi.json" />
```

**Key patterns:**
- Embedding interactive Swagger UI
- Importing necessary CSS
- Direct API spec integration

### Common Image Patterns

```mdx
// For images in static folder
import useBaseUrl from "@docusaurus/useBaseUrl";

<img src={useBaseUrl("/img/feature-screenshot.png")} width="600" />

// With caption
<figure>
  <img src={useBaseUrl("/img/dashboard.png")} alt="Dashboard view" />
  <figcaption>Superset Dashboard Interface</figcaption>
</figure>
```

### Multi-Tab Code Examples

```mdx
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs
  defaultValue="docker"
  values={[
    {label: 'Docker', value: 'docker'},
    {label: 'Kubernetes', value: 'k8s'},
    {label: 'PyPI', value: 'pypi'},
  ]}>
  <TabItem value="docker">
    ```bash
    docker-compose up
    ```
  </TabItem>
  <TabItem value="k8s">
    ```bash
    kubectl apply -f superset.yaml
    ```
  </TabItem>
  <TabItem value="pypi">
    ```bash
    pip install apache-superset
    ```
  </TabItem>
</Tabs>
```

### Configuration File Examples

```mdx
```python title="superset_config.py"
# Database connection example
SQLALCHEMY_DATABASE_URI = 'postgresql://user:password@localhost/superset'

# Security configuration
SECRET_KEY = 'YOUR_SECRET_KEY_HERE'
WTF_CSRF_ENABLED = True

# Feature flags
FEATURE_FLAGS = {
    'ENABLE_TEMPLATE_PROCESSING': True,
    'DASHBOARD_NATIVE_FILTERS': True,
}
```
```

### Cross-Referencing Pattern

```mdx
For detailed configuration options, see:
- [Configuring Superset](./configuration/configuring-superset)
- [Database Connections](./configuration/databases)
- [Security Settings](./security/security)

External resources:
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Flask Configuration](https://flask.palletsprojects.com/config/)
```

### Writing Installation Guides

```mdx
## Prerequisites

:::warning
Ensure you have Python 3.9+ and Node.js 16+ installed before proceeding.
:::

## Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/apache/superset.git
   cd superset
   ```

2. **Install Python dependencies**
   ```bash
   pip install -e .
   ```

3. **Initialize the database**
   ```bash
   superset db upgrade
   superset init
   ```

:::tip Success Check
Navigate to http://localhost:8088 and login with admin/admin
:::
```

### Documenting API Endpoints

```mdx
## Chart API

### GET /api/v1/chart/

Returns a list of charts.

**Parameters:**
- `page` (optional): Page number
- `page_size` (optional): Number of items per page

**Example Request:**
```bash
curl -X GET "http://localhost:8088/api/v1/chart/" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Example Response:**
```json
{
  "count": 42,
  "result": [
    {
      "id": 1,
      "slice_name": "Sales Dashboard",
      "viz_type": "line"
    }
  ]
}
```
```

---

**Note**: This documentation site serves as the primary resource for Superset users, administrators, and contributors. Always prioritize clarity, accuracy, and completeness when creating or updating documentation.
