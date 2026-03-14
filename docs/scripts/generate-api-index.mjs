/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Generates a comprehensive API index MDX file from the OpenAPI spec.
 * This creates the api.mdx landing page with all endpoints organized by category.
 *
 * Uses the generated sidebar to get correct endpoint slugs (the plugin's
 * slug algorithm differs from a simple slugify, e.g. handling apostrophes
 * and camelCase differently).
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SPEC_PATH = path.join(__dirname, '..', 'static', 'resources', 'openapi.json');
const SIDEBAR_PATH = path.join(__dirname, '..', 'developer_docs', 'api', 'sidebar.js');
const OUTPUT_PATH = path.join(__dirname, '..', 'developer_docs', 'api.mdx');

// Category groupings for better organization
const CATEGORY_GROUPS = {
  'Authentication': ['Security'],
  'Core Resources': ['Dashboards', 'Charts', 'Datasets', 'Database'],
  'Data Exploration': ['Explore', 'SQL Lab', 'Queries', 'Datasources', 'Advanced Data Type'],
  'Organization & Customization': ['Tags', 'Annotation Layers', 'CSS Templates'],
  'Sharing & Embedding': [
    'Dashboard Permanent Link', 'Explore Permanent Link', 'SQL Lab Permanent Link',
    'Embedded Dashboard', 'Dashboard Filter State', 'Explore Form Data'
  ],
  'Scheduling & Alerts': ['Report Schedules'],
  'Security & Access Control': [
    'Security Roles', 'Security Users', 'Security Permissions',
    'Security Resources (View Menus)', 'Security Permissions on Resources (View Menus)',
    'Row Level Security'
  ],
  'Import/Export & Administration': ['Import/export', 'CacheRestApi', 'LogRestApi'],
  'User & System': ['Current User', 'User', 'Menu', 'Available Domains', 'AsyncEventsRestApi', 'OpenApi'],
};

/**
 * Build a map from sidebar label → doc slug by reading the generated sidebar.
 * This ensures we use the exact same slugs that docusaurus-openapi-docs generated.
 */
function buildSlugMap() {
  const labelToSlug = {};

  try {
    const sidebar = require(SIDEBAR_PATH);

    const extractDocs = (items) => {
      for (const item of items) {
        if (item.type === 'doc' && item.label && item.id) {
          // id is like "api/create-security-login" → slug "create-security-login"
          const slug = item.id.replace(/^api\//, '');
          labelToSlug[item.label] = slug;
        }
        if (item.items) extractDocs(item.items);
      }
    };

    extractDocs(sidebar);
    console.log(`Loaded ${Object.keys(labelToSlug).length} slug mappings from sidebar`);
  } catch {
    console.warn('Could not read sidebar, will use computed slugs');
  }

  return labelToSlug;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function main() {
  console.log(`Reading OpenAPI spec from ${SPEC_PATH}`);
  const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf-8'));

  // Build slug map from the generated sidebar
  const labelToSlug = buildSlugMap();

  // Build a map of tag -> endpoints
  const tagEndpoints = {};
  const tagDescriptions = {};

  // Get tag descriptions
  for (const tag of spec.tags || []) {
    tagDescriptions[tag.name] = tag.description || '';
  }

  // Collect endpoints by tag
  for (const [pathUrl, methods] of Object.entries(spec.paths || {})) {
    for (const [method, details] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

      const tags = details.tags || ['Untagged'];
      const summary = details.summary || `${method.toUpperCase()} ${pathUrl}`;

      // Use sidebar slug if available, fall back to computed slug
      const slug = labelToSlug[summary] || slugify(summary);

      for (const tag of tags) {
        if (!tagEndpoints[tag]) {
          tagEndpoints[tag] = [];
        }
        tagEndpoints[tag].push({
          method: method.toUpperCase(),
          path: pathUrl,
          summary,
          slug,
        });
      }
    }
  }

  // Sort endpoints within each tag by path
  for (const tag of Object.keys(tagEndpoints)) {
    tagEndpoints[tag].sort((a, b) => a.path.localeCompare(b.path));
  }

  // Generate MDX content
  let mdx = `---
title: API Reference
hide_title: true
sidebar_position: 10
---

import { Alert } from 'antd';

## REST API Reference

Superset exposes a comprehensive **REST API** that follows the [OpenAPI specification](https://swagger.io/specification/).
You can use this API to programmatically interact with Superset for automation, integrations, and custom applications.

<Alert
  type="info"
  showIcon
  message="Code Samples & Schema Documentation"
  description={
    <span>
      Each endpoint includes ready-to-use code samples in <strong>cURL</strong>, <strong>Python</strong>, and <strong>JavaScript</strong>.
      The sidebar includes <strong>Schema definitions</strong> for detailed data model documentation.
    </span>
  }
  style={{ marginBottom: '24px' }}
/>

---

`;

  // Track which tags we've rendered
  const renderedTags = new Set();

  // Render Authentication first (it's critical for using the API)
  mdx += `### Authentication

Most API endpoints require authentication via JWT tokens.

#### Quick Start

\`\`\`bash
# 1. Get a JWT token
curl -X POST http://localhost:8088/api/v1/security/login \\
  -H "Content-Type: application/json" \\
  -d '{"username": "admin", "password": "admin", "provider": "db"}'

# 2. Use the access_token from the response
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  http://localhost:8088/api/v1/dashboard/
\`\`\`

#### Security Endpoints

`;

  // Render Security tag endpoints
  if (tagEndpoints['Security']) {
    mdx += `| Method | Endpoint | Description |\n`;
    mdx += `|--------|----------|-------------|\n`;
    for (const ep of tagEndpoints['Security']) {
      mdx += `| \`${ep.method}\` | [${ep.summary}](./api/${ep.slug}) | \`${ep.path}\` |\n`;
    }
    mdx += '\n';
    renderedTags.add('Security');
  }

  mdx += `---\n\n### API Endpoints\n\n`;

  // Render each category group
  for (const [groupName, groupTags] of Object.entries(CATEGORY_GROUPS)) {
    if (groupName === 'Authentication') continue; // Already rendered

    const tagsInGroup = groupTags.filter(tag => tagEndpoints[tag] && !renderedTags.has(tag));
    if (tagsInGroup.length === 0) continue;

    mdx += `#### ${groupName}\n\n`;

    for (const tag of tagsInGroup) {
      const description = tagDescriptions[tag] || '';
      const endpoints = tagEndpoints[tag];

      mdx += `<details>\n`;
      mdx += `<summary><strong>${tag}</strong> (${endpoints.length} endpoints) — ${description}</summary>\n\n`;
      mdx += `| Method | Endpoint | Description |\n`;
      mdx += `|--------|----------|-------------|\n`;

      for (const ep of endpoints) {
        mdx += `| \`${ep.method}\` | [${ep.summary}](./api/${ep.slug}) | \`${ep.path}\` |\n`;
      }

      mdx += `\n</details>\n\n`;
      renderedTags.add(tag);
    }
  }

  // Render any remaining tags not in a group
  const remainingTags = Object.keys(tagEndpoints).filter(tag => !renderedTags.has(tag));
  if (remainingTags.length > 0) {
    mdx += `#### Other\n\n`;

    for (const tag of remainingTags.sort()) {
      const description = tagDescriptions[tag] || '';
      const endpoints = tagEndpoints[tag];

      mdx += `<details>\n`;
      mdx += `<summary><strong>${tag}</strong> (${endpoints.length} endpoints) — ${description}</summary>\n\n`;
      mdx += `| Method | Endpoint | Description |\n`;
      mdx += `|--------|----------|-------------|\n`;

      for (const ep of endpoints) {
        mdx += `| \`${ep.method}\` | [${ep.summary}](./api/${ep.slug}) | \`${ep.path}\` |\n`;
      }

      mdx += `\n</details>\n\n`;
    }
  }

  mdx += `---

### Additional Resources

- [Superset REST API Blog Post](https://preset.io/blog/2020-10-01-superset-api/)
- [Accessing APIs with Superset](https://preset.io/blog/accessing-apis-with-superset/)
`;

  // Write output
  fs.writeFileSync(OUTPUT_PATH, mdx);
  console.log(`Generated API index at ${OUTPUT_PATH}`);
  console.log(`Total tags: ${Object.keys(tagEndpoints).length}`);
  console.log(`Total endpoints: ${Object.values(tagEndpoints).flat().length}`);
}

main();
