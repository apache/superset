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
 * Convert the generated TypeScript API sidebar to CommonJS format.
 * This allows the sidebar to be imported by sidebars.js.
 * Also adds unique keys to duplicate labels to avoid translation conflicts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sidebarTsPath = path.join(__dirname, '..', 'developer_docs', 'api', 'sidebar.ts');
const sidebarJsPath = path.join(__dirname, '..', 'developer_docs', 'api', 'sidebar.js');

if (!fs.existsSync(sidebarTsPath)) {
  console.log('No sidebar.ts found, skipping conversion');
  process.exit(0);
}

let content = fs.readFileSync(sidebarTsPath, 'utf8');

// Remove TypeScript import
content = content.replace(/import type.*\n/g, '');

// Remove type annotation
content = content.replace(/: SidebarsConfig/g, '');

// Change export default to module.exports
content = content.replace(
  /export default sidebar\.apisidebar;/,
  'module.exports = sidebar.apisidebar;'
);

// Parse the sidebar to add unique keys for duplicate labels
// This avoids translation key conflicts when the same label appears multiple times
try {
  // Extract the sidebar object
  const sidebarMatch = content.match(/const sidebar = (\{[\s\S]*\});/);
  if (sidebarMatch) {
    // Use Function constructor instead of eval for safer evaluation
    const sidebarObj = new Function(`return ${sidebarMatch[1]}`)();

    // First pass: count labels
    const countLabels = (items) => {
      const counts = {};
      const count = (item) => {
        if (item.type === 'doc' && item.label) {
          counts[item.label] = (counts[item.label] || 0) + 1;
        }
        if (item.items) {
          item.items.forEach(count);
        }
      };
      items.forEach(count);
      return counts;
    };

    const counts = countLabels(sidebarObj.apisidebar);

    // Second pass: add keys to items with duplicate labels
    const addKeys = (items, prefix = 'api') => {
      for (const item of items) {
        if (item.type === 'doc' && item.label && counts[item.label] > 1) {
          item.key = item.id;
        }
        // Also add keys to categories to avoid conflicts with main sidebar categories
        if (item.type === 'category' && item.label) {
          item.key = `${prefix}-category-${item.label.toLowerCase().replace(/\s+/g, '-')}`;
        }
        if (item.items) {
          addKeys(item.items, prefix);
        }
      }
    };

    addKeys(sidebarObj.apisidebar);

    // Regenerate the content with the updated sidebar
    content = `const sidebar = ${JSON.stringify(sidebarObj, null, 2)};

module.exports = sidebar.apisidebar;
`;
  }
} catch (e) {
  console.warn('Could not add unique keys to sidebar:', e.message);
  // Fall back to simple conversion
  content = content.replace(
    /export default sidebar\.apisidebar;/,
    'module.exports = sidebar.apisidebar;'
  );
}

// Add header with eslint-disable to allow @ts-nocheck
const header = `/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Auto-generated CommonJS sidebar from sidebar.ts
 * Do not edit directly - run 'yarn generate:api-docs' to regenerate
 */

`;

fs.writeFileSync(sidebarJsPath, header + content);
console.log('Converted sidebar.ts to sidebar.js');
