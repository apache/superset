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
 *
 * All stories in superset-core are considered extension-compatible
 * by virtue of their location - no tag needed.
 */
function parseStoryFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

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

  // Try to extract props interface from component file (for future use)
  if (hasComponentFile) {
    // Read component file - props extraction reserved for future enhancement
    // const componentContent = fs.readFileSync(componentFile, 'utf-8');
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
 * Extract argTypes/args from story content for generating controls
 */
function extractArgsAndControls(content, componentName, storyContent) {
  // Look for InteractiveX.args pattern
  const argsMatch = content.match(
    new RegExp(`Interactive${componentName}\\.args\\s*=\\s*{([^}]+)}`, 's')
  );

  // Look for argTypes
  const argTypesMatch = content.match(
    new RegExp(`Interactive${componentName}\\.argTypes\\s*=\\s*{([\\s\\S]*?)};`, 's')
  );

  const args = {};
  const controls = [];

  if (argsMatch) {
    // Parse simple args like: closable: true, type: 'info'
    const argsContent = argsMatch[1];
    const argLines = argsContent.matchAll(/(\w+):\s*(['"]([^'"]+)['"]|true|false|\d+)/g);
    for (const match of argLines) {
      const key = match[1];
      let value = match[2];
      // Convert string booleans
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (match[3]) value = match[3]; // Use captured string content
      args[key] = value;
    }
  }

  if (argTypesMatch) {
    const argTypesContent = argTypesMatch[1];

    // Match each top-level property in argTypes
    // Pattern: propertyName: { ... }, (with balanced braces)
    const propPattern = /(\w+):\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let propMatch;

    while ((propMatch = propPattern.exec(argTypesContent)) !== null) {
      const name = propMatch[1];
      const propContent = propMatch[2];

      // Skip if it's an action (not a control)
      if (propContent.includes('action:')) continue;

      // Check for select control
      if (propContent.includes("type: 'select'") || propContent.includes('type: "select"')) {
        // Look for options - could be inline array or variable reference
        const inlineOptionsMatch = propContent.match(/options:\s*\[([^\]]+)\]/);
        const varOptionsMatch = propContent.match(/options:\s*(\w+)/);

        let options = [];
        if (inlineOptionsMatch) {
          options = [...inlineOptionsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
        } else if (varOptionsMatch && storyContent) {
          // Look up the variable
          const varName = varOptionsMatch[1];
          const varDefMatch = storyContent.match(
            new RegExp(`const\\s+${varName}[^=]*=\\s*\\[([^\\]]+)\\]`)
          );
          if (varDefMatch) {
            options = [...varDefMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
          }
        }

        if (options.length > 0) {
          controls.push({
            name,
            label: name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1'),
            type: 'select',
            options,
          });
        }
      }
      // Check for boolean control
      else if (propContent.includes("type: 'boolean'") || propContent.includes('type: "boolean"')) {
        controls.push({
          name,
          label: name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1'),
          type: 'boolean',
        });
      }
    }
  }

  return { args, controls };
}

/**
 * Generate MDX content for a component
 */
function generateMDX(component, storyContent) {
  const { componentName, description, importPath, packageName, relativePath } =
    component;

  // Extract args and controls from the story
  const { args, controls } = extractArgsAndControls(storyContent, componentName, storyContent);

  // Generate the controls array for StoryWithControls
  const controlsJson = JSON.stringify(controls, null, 2)
    .replace(/"(\w+)":/g, '$1:')  // Remove quotes from keys
    .replace(/"/g, "'");  // Use single quotes for strings

  // Generate default props
  const propsJson = JSON.stringify(args, null, 2)
    .replace(/"(\w+)":/g, '$1:')
    .replace(/"/g, "'");

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

import { StoryWithControls } from '../../../src/components/StorybookWrapper';
import { ${componentName} } from '@apache-superset/core';

# ${componentName}

${description || `The ${componentName} component from the Superset extension API.`}

## Live Example

<StoryWithControls
  component={({ ${Object.keys(args).join(', ')} }) => (
    <${componentName}
      ${Object.keys(args).map(k => `${k}={${k}}`).join('\n      ')}
    >
      Sample alert message
    </${componentName}>
  )}
  props={${propsJson}}
  controls={${controlsJson}}
/>

## Try It

Edit the code below to experiment with the component:

\`\`\`tsx live
function Demo() {
  return (
    <${componentName} type="info">
      Edit me! Try changing the type to "success", "warning", or "error".
    </${componentName}>
  );
}
\`\`\`

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
${Object.entries(args).map(([key, value]) => {
  const type = typeof value === 'boolean' ? 'boolean' : typeof value === 'string' ? 'string' : 'any';
  return `| \`${key}\` | \`${type}\` | \`${JSON.stringify(value)}\` | ${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')} |`;
}).join('\n')}

## Usage in Extensions

This component is available in the \`${packageName}\` package, which is automatically available to Superset extensions.

\`\`\`tsx
${importPath}

function MyExtension() {
  return (
    <${componentName} type="info">
      Your message here
    </${componentName}>
  );
}
\`\`\`

## Source Links

- [Story file](https://github.com/apache/superset/blob/master/${relativePath})
- [Component source](https://github.com/apache/superset/blob/master/${relativePath.replace(/\/[^/]+\.stories\.tsx$/, '/index.tsx')})

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
sidebar_label: Overview
sidebar_position: 1
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

Components in \`@apache-superset/core\` are automatically documented here. To add a new extension component:

1. Add the component to \`superset-frontend/packages/superset-core/src/ui/components/\`
2. Export it from \`superset-frontend/packages/superset-core/src/ui/components/index.ts\`
3. Create a Storybook story with an \`Interactive\` export:

\`\`\`tsx
export default {
  title: 'Extension Components/MyComponent',
  component: MyComponent,
  parameters: {
    docs: {
      description: {
        component: 'Description of the component...',
      },
    },
  },
};

export const InteractiveMyComponent = (args) => <MyComponent {...args} />;

InteractiveMyComponent.args = {
  variant: 'primary',
  disabled: false,
};

InteractiveMyComponent.argTypes = {
  variant: {
    control: { type: 'select' },
    options: ['primary', 'secondary'],
  },
  disabled: {
    control: { type: 'boolean' },
  },
};
\`\`\`

4. Run \`yarn start\` in \`docs/\` - the page generates automatically!

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
    // Read the story content for extracting args/controls
    const storyContent = fs.readFileSync(component.filePath, 'utf-8');
    const mdxContent = generateMDX(component, storyContent);
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
