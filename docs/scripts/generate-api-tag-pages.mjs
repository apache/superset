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
 * Replaces auto-generated tag pages (DocCardList cards) with endpoint tables
 * showing HTTP method, endpoint name, and URI path for each endpoint in the tag.
 *
 * Runs after `docusaurus gen-api-docs` and `convert-api-sidebar.mjs`.
 * Uses the generated sidebar to get correct endpoint slugs.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SPEC_PATH = path.join(__dirname, '..', 'static', 'resources', 'openapi.json');
const API_DOCS_DIR = path.join(__dirname, '..', 'developer_docs', 'api');
const SIDEBAR_PATH = path.join(API_DOCS_DIR, 'sidebar.js');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Build a map from sidebar label → doc slug by reading the generated sidebar.
 */
function buildSlugMap() {
  const labelToSlug = {};

  try {
    const sidebar = require(SIDEBAR_PATH);

    const extractDocs = (items) => {
      for (const item of items) {
        if (item.type === 'doc' && item.label && item.id) {
          const slug = item.id.replace(/^api\//, '');
          labelToSlug[item.label] = slug;
        }
        if (item.items) extractDocs(item.items);
      }
    };

    extractDocs(sidebar);
  } catch {
    console.warn('Could not read sidebar, will use computed slugs');
  }

  return labelToSlug;
}

function main() {
  console.log('Generating API tag pages with endpoint tables...');

  const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf-8'));
  const labelToSlug = buildSlugMap();

  // Build tag descriptions from the spec
  const tagDescriptions = {};
  for (const tag of spec.tags || []) {
    tagDescriptions[tag.name] = tag.description || '';
  }

  // Build tag → endpoints map
  const tagEndpoints = {};
  for (const [pathUrl, methods] of Object.entries(spec.paths || {})) {
    for (const [method, details] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

      const tags = details.tags || ['Untagged'];
      const summary = details.summary || `${method.toUpperCase()} ${pathUrl}`;
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

  // Sort endpoints within each tag by path then method
  for (const tag of Object.keys(tagEndpoints)) {
    tagEndpoints[tag].sort((a, b) =>
      a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
    );
  }

  // Scan existing .tag.mdx files and match by frontmatter title
  const tagFiles = fs.readdirSync(API_DOCS_DIR)
    .filter(f => f.endsWith('.tag.mdx'));

  let updated = 0;
  for (const tagFile of tagFiles) {
    const tagFilePath = path.join(API_DOCS_DIR, tagFile);
    const existing = fs.readFileSync(tagFilePath, 'utf-8');

    // Extract frontmatter
    const frontmatterMatch = existing.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      console.warn(`  No frontmatter in ${tagFile}, skipping`);
      continue;
    }

    const frontmatter = frontmatterMatch[1];

    // Extract the title from frontmatter (this matches the spec tag name)
    const titleMatch = frontmatter.match(/title:\s*"([^"]+)"/);
    if (!titleMatch) {
      console.warn(`  No title in ${tagFile}, skipping`);
      continue;
    }

    const tagName = titleMatch[1];
    const endpoints = tagEndpoints[tagName];

    if (!endpoints || endpoints.length === 0) {
      console.warn(`  No endpoints found for tag "${tagName}" (${tagFile})`);
      continue;
    }

    const description = tagDescriptions[tagName] || '';

    // Build the endpoint table
    let table = '| Method | Endpoint | Path |\n';
    table += '|--------|----------|------|\n';
    for (const ep of endpoints) {
      table += `| \`${ep.method}\` | [${ep.summary}](./${ep.slug}) | \`${ep.path}\` |\n`;
    }

    // Generate the new MDX content
    const mdx = `---
${frontmatter}
---

${description}

${table}
`;

    fs.writeFileSync(tagFilePath, mdx);
    updated++;
  }

  console.log(`Updated ${updated} tag pages with endpoint tables`);
}

main();
