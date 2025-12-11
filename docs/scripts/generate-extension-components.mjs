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
 * This script scans for Storybook stories tagged with 'extension-compatible'
 * and generates MDX documentation pages for the developer portal.
 *
 * Usage: node scripts/generate-extension-components.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DOCS_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(
  DOCS_DIR,
  'developer_portal/extensions/components'
);
const SUPERSET_CORE_DIR = path.join(
  ROOT_DIR,
  'superset-frontend/packages/superset-core'
);

/**
 * Find all story files in the superset-core package
 */
async function findStoryFiles() {
  const pattern = path.join(SUPERSET_CORE_DIR, 'src/**/*.stories.tsx');
  const files = [];

  // Use fs to recursively find files since glob might not be available
  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.stories.tsx')) {
        files.push(fullPath);
      }
    }
  }

  walkDir(path.join(SUPERSET_CORE_DIR, 'src'));
  return files;
}

/**
 * Parse a story file and extract metadata
 */
function parseStoryFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if this story has the extension-compatible tag
  const hasExtensionTag = content.includes("'extension-compatible'");
  if (!hasExtensionTag) {
    return null;
  }

  // Extract component name from title
  const titleMatch = content.match(/title:\s*['"]([^'"]+)['"]/);
  const title = titleMatch ? titleMatch[1] : null;

  // Extract component name (last part of title path)
  const componentName = title ? title.split('/').pop() : null;

  // Extract description from parameters
  // Handle concatenated strings like: 'part1 ' + 'part2'
  let description = '';

  // First try to find the description block
  const descBlockMatch = content.match(
    /description:\s*{\s*component:\s*([\s\S]*?)\s*},?\s*}/
  );

  if (descBlockMatch) {
    const descBlock = descBlockMatch[1];
    // Extract all string literals and concatenate them
    const stringParts = [];
    const stringMatches = descBlock.matchAll(/['"]([^'"]*)['"]/g);
    for (const match of stringMatches) {
      stringParts.push(match[1]);
    }
    description = stringParts.join('').trim();
  }

  // Extract package info
  const packageMatch = content.match(/package:\s*['"]([^'"]+)['"]/);
  const packageName = packageMatch ? packageMatch[1] : '@apache-superset/core';

  // Extract import path - handle double-quoted strings containing single quotes
  // Match: importPath: "import { Alert } from '@apache-superset/core';"
  const importMatchDouble = content.match(/importPath:\s*"([^"]+)"/);
  const importMatchSingle = content.match(/importPath:\s*'([^']+)'/);
  let importPath = `import { ${componentName} } from '${packageName}';`;
  if (importMatchDouble) {
    importPath = importMatchDouble[1];
  } else if (importMatchSingle) {
    importPath = importMatchSingle[1];
  }

  // Get the directory containing the story to find the component
  const storyDir = path.dirname(filePath);
  const componentFile = path.join(storyDir, 'index.tsx');
  const hasComponentFile = fs.existsSync(componentFile);

  // Try to extract props interface from component file
  let propsInterface = null;
  if (hasComponentFile) {
    const componentContent = fs.readFileSync(componentFile, 'utf-8');
    // Look for exported type/interface with Props in the name
    const propsMatch = componentContent.match(
      /export\s+(?:type|interface)\s+(\w*Props\w*)\s*=?\s*{([^}]+)}/s
    );
    if (propsMatch) {
      propsInterface = {
        name: propsMatch[1],
        // Parse props (simplified)
        raw: propsMatch[0],
      };
    }
  }

  // Extract story exports (named exports that aren't the default)
  const storyExports = [];
  const exportMatches = content.matchAll(
    /export\s+(?:const|function)\s+(\w+)/g
  );
  for (const match of exportMatches) {
    if (match[1] !== 'default') {
      storyExports.push(match[1]);
    }
  }

  return {
    filePath,
    title,
    componentName,
    description,
    packageName,
    importPath,
    storyExports,
    hasComponentFile,
    relativePath: path.relative(ROOT_DIR, filePath),
  };
}

/**
 * Generate MDX content for a component
 */
function generateMDX(component) {
  const { componentName, description, importPath, packageName, relativePath } =
    component;

  const slug = componentName.toLowerCase();

  return `---
title: ${componentName}
sidebar_label: ${componentName}
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

# ${componentName}

${description || `The ${componentName} component from the Superset extension API.`}

## Installation

This component is available in the \`${packageName}\` package, which is automatically available to Superset extensions.

## Usage

\`\`\`tsx
${importPath}

function MyExtension() {
  return (
    <${componentName}>
      {/* Your content here */}
    </${componentName}>
  );
}
\`\`\`

## Storybook

View the interactive Storybook documentation for this component:

- [View in Storybook](/storybook/?path=/docs/extension-components-${slug}--docs)

:::tip
The Storybook contains interactive examples with controls to experiment with different prop combinations.
:::

## Source

- [Story file](https://github.com/apache/superset/blob/master/${relativePath})

---

*This page was auto-generated from the component's Storybook story.*
`;
}

/**
 * Generate index page for extension components
 */
function generateIndexMDX(components) {
  const componentList = components
    .map(c => `- [${c.componentName}](./${c.componentName.toLowerCase()})`)
    .join('\n');

  return `---
title: Extension Components
sidebar_label: Components
sidebar_position: 10
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

# Extension Components

These UI components are available to Superset extension developers through the \`@apache-superset/core\` package. They provide a consistent look and feel with the rest of Superset and are designed to be used in extension panels, views, and other UI elements.

## Available Components

${componentList}

## Usage

All components are exported from the \`@apache-superset/core\` package:

\`\`\`tsx
import { Alert } from '@apache-superset/core';

export function MyExtensionPanel() {
  return (
    <Alert type="info">
      Welcome to my extension!
    </Alert>
  );
}
\`\`\`

## Adding New Components

If you're contributing to Superset and want to make a component available to extension developers:

1. Add the component to \`superset-frontend/packages/superset-core/src/ui/components/\`
2. Export it from \`superset-frontend/packages/superset-core/src/ui/components/index.ts\`
3. Create a Storybook story with the \`extension-compatible\` tag:

\`\`\`tsx
export default {
  title: 'Extension Components/MyComponent',
  component: MyComponent,
  tags: ['extension-compatible'],
  parameters: {
    extensionMeta: {
      package: '@apache-superset/core',
      importPath: "import { MyComponent } from '@apache-superset/core';",
    },
  },
};
\`\`\`

4. Run \`npm run generate:extension-components\` in the \`docs\` directory to regenerate documentation.

## Interactive Documentation

For interactive examples with controls, visit the [Storybook](/storybook/?path=/docs/extension-components--docs).
`;
}

/**
 * Main function
 */
async function main() {
  console.log('Scanning for extension-compatible stories...\n');

  // Find all story files
  const storyFiles = await findStoryFiles();
  console.log(`Found ${storyFiles.length} story files in superset-core\n`);

  // Parse each story file
  const components = [];
  for (const file of storyFiles) {
    const parsed = parseStoryFile(file);
    if (parsed) {
      components.push(parsed);
      console.log(`  ✓ ${parsed.componentName} (${parsed.relativePath})`);
    }
  }

  if (components.length === 0) {
    console.log(
      '\nNo extension-compatible components found. Make sure stories have:'
    );
    console.log("  tags: ['extension-compatible']");
    return;
  }

  console.log(`\nFound ${components.length} extension-compatible components\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}\n`);
  }

  // Generate MDX files
  for (const component of components) {
    const mdxContent = generateMDX(component);
    const outputPath = path.join(
      OUTPUT_DIR,
      `${component.componentName.toLowerCase()}.mdx`
    );
    fs.writeFileSync(outputPath, mdxContent);
    console.log(`  Generated: ${path.relative(DOCS_DIR, outputPath)}`);
  }

  // Generate index page
  const indexContent = generateIndexMDX(components);
  const indexPath = path.join(OUTPUT_DIR, 'index.mdx');
  fs.writeFileSync(indexPath, indexContent);
  console.log(`  Generated: ${path.relative(DOCS_DIR, indexPath)}`);

  console.log('\nDone! Extension component documentation generated.');
  console.log(
    `\nGenerated ${components.length + 1} files in developer_portal/extensions/components/`
  );
}

main().catch(console.error);
