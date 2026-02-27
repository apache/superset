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
 * ============================================================================
 * PHILOSOPHY: STORIES ARE THE SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * When something doesn't render correctly in the docs, FIX THE STORY FIRST.
 * Do NOT add special cases or workarounds to this generator.
 *
 * This generator should be as lightweight as possible - it extracts data from
 * stories and passes it through to MDX. All configuration belongs in stories:
 *
 * - Use `export default { title: '...' }` (inline export, not variable)
 * - Name stories `Interactive${ComponentName}` for docs generation
 * - Define `args` and `argTypes` at the story level (not meta level)
 * - Use `parameters.docs.gallery` for variant grids
 * - Use `parameters.docs.sampleChildren` for components needing children
 * - Use `parameters.docs.liveExample` for custom code examples
 * - Use `parameters.docs.staticProps` for complex props
 *
 * If a story doesn't work with this generator, fix the story to match the
 * expected patterns rather than adding complexity here.
 * ============================================================================
 */

/**
 * This script scans for ALL Storybook stories and generates MDX documentation
 * pages for the "Superset Components" section of the developer portal.
 *
 * Supports multiple source directories with different import paths and categories.
 *
 * Usage: node scripts/generate-superset-components.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DOCS_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(DOCS_DIR, 'developer_docs/components');
const JSON_OUTPUT_PATH = path.join(DOCS_DIR, 'static/data/components.json');
const TYPES_OUTPUT_DIR = path.join(DOCS_DIR, 'src/types/apache-superset-core');
const TYPES_OUTPUT_PATH = path.join(TYPES_OUTPUT_DIR, 'index.d.ts');
const FRONTEND_DIR = path.join(ROOT_DIR, 'superset-frontend');

// Source configurations with import paths and categories
const SOURCES = [
  {
    name: 'UI Core Components',
    path: 'packages/superset-ui-core/src/components',
    importPrefix: '@superset/components',
    docImportPrefix: '@superset-ui/core/components',
    category: 'ui',
    enabled: true,
    // Components that require complex function props or aren't exported properly
    skipComponents: new Set([
      // Complex function props (require callbacks, async data, or render props)
      'AsyncSelect', 'ConfirmStatusChange', 'CronPicker', 'LabeledErrorBoundInput',
      'AsyncAceEditor', 'AsyncEsmComponent', 'TimezoneSelector',
      // Not exported from @superset/components index or have export mismatches
      'ActionCell', 'BooleanCell', 'ButtonCell', 'NullCell', 'NumericCell', 'TimeCell',
      'CertifiedBadgeWithTooltip', 'CodeSyntaxHighlighter', 'DynamicTooltip',
      'PopoverDropdown', 'PopoverSection', 'WarningIconWithTooltip', 'RefreshLabel',
      // Components with complex nested props (JSX children, overlay, items arrays)
      'Dropdown', 'DropdownButton',
    ]),
  },
  {
    name: 'App Components',
    path: 'src/components',
    importPrefix: 'src/components',
    docImportPrefix: 'src/components',
    category: 'app',
    enabled: false, // Requires app context (Redux, routing, etc.)
    skipComponents: new Set([]),
  },
  {
    name: 'Dashboard Components',
    path: 'src/dashboard/components',
    importPrefix: 'src/dashboard/components',
    docImportPrefix: 'src/dashboard/components',
    category: 'dashboard',
    enabled: false, // Requires app context
    skipComponents: new Set([]),
  },
  {
    name: 'Explore Components',
    path: 'src/explore/components',
    importPrefix: 'src/explore/components',
    docImportPrefix: 'src/explore/components',
    category: 'explore',
    enabled: false, // Requires app context
    skipComponents: new Set([]),
  },
  {
    name: 'Feature Components',
    path: 'src/features',
    importPrefix: 'src/features',
    docImportPrefix: 'src/features',
    category: 'features',
    enabled: false, // Requires app context
    skipComponents: new Set([]),
  },
  {
    name: 'Filter Components',
    path: 'src/filters/components',
    importPrefix: 'src/filters/components',
    docImportPrefix: 'src/filters/components',
    category: 'filters',
    enabled: false, // Requires app context
    skipComponents: new Set([]),
  },
  {
    name: 'Chart Plugins',
    path: 'packages/superset-ui-demo/storybook/stories/plugins',
    importPrefix: '@superset-ui/demo',
    docImportPrefix: '@superset-ui/demo',
    category: 'chart-plugins',
    enabled: false, // Requires chart infrastructure
    skipComponents: new Set([]),
  },
  {
    name: 'Core Packages',
    path: 'packages/superset-ui-demo/storybook/stories/superset-ui-chart',
    importPrefix: '@superset-ui/core',
    docImportPrefix: '@superset-ui/core',
    category: 'core-packages',
    enabled: false, // Requires specific setup
    skipComponents: new Set([]),
  },
  {
    name: 'Extension Components',
    path: 'packages/superset-core/src',
    importPrefix: '@apache-superset/core/ui',
    docImportPrefix: '@apache-superset/core/ui',
    category: 'extension',
    enabled: true,
    extensionCompatible: true,
    skipComponents: new Set([]),
  },
];

// Category mapping from story title prefixes to output directories
const CATEGORY_MAP = {
  'Components/': 'ui',
  'Design System/': 'design-system',
  'Chart Plugins/': 'chart-plugins',
  'Legacy Chart Plugins/': 'legacy-charts',
  'Core Packages/': 'core-packages',
  'Others/': 'utilities',
  'Extension Components/': 'extension',
  'Superset App/': 'app',
};

// Documentation-only stories to skip (not actual components)
const SKIP_STORIES = [
  'Introduction',      // Design System intro page
  'Overview',          // Category overview pages
  'Examples',          // Example collections
  'DesignSystem',      // Meta design system page
  'MetadataBarOverview', // Overview page
  'TableOverview',     // Overview page
  'Filter Plugins',    // Collection story, not a component
];


/**
 * Recursively find all story files in a directory
 */
function walkDir(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, files);
    } else if (entry.name.endsWith('.stories.tsx') || entry.name.endsWith('.stories.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Find all story files from enabled sources
 */
function findEnabledStoryFiles() {
  const files = [];
  for (const source of SOURCES.filter(s => s.enabled)) {
    const dir = path.join(FRONTEND_DIR, source.path);
    const sourceFiles = walkDir(dir, []);
    // Attach source config to each file
    for (const file of sourceFiles) {
      files.push({ file, source });
    }
  }
  return files;
}

/**
 * Find all story files from disabled sources (for tracking)
 */
function findDisabledStoryFiles() {
  const files = [];
  for (const source of SOURCES.filter(s => !s.enabled)) {
    const dir = path.join(FRONTEND_DIR, source.path);
    walkDir(dir, files);
  }
  return files;
}

/**
 * Parse a story file and extract metadata
 */
function parseStoryFile(filePath, sourceConfig) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Extract title from story meta (in export default block, not from data objects)
  // Look for title in the export default section, which typically starts with "export default {"
  const metaMatch = content.match(/export\s+default\s*\{[\s\S]*?title:\s*['"]([^'"]+)['"]/);
  const title = metaMatch ? metaMatch[1] : null;

  if (!title) return null;

  // Extract component name (last part of title path)
  const titleParts = title.split('/');
  const componentName = titleParts.pop();

  // Skip documentation-only stories
  if (SKIP_STORIES.includes(componentName)) {
    return null;
  }

  // Skip components in the source's skip list
  if (sourceConfig.skipComponents.has(componentName)) {
    return null;
  }

  // Determine category - use source's default category unless title has a specific prefix
  let category = sourceConfig.category;
  for (const [prefix, cat] of Object.entries(CATEGORY_MAP)) {
    if (title.startsWith(prefix)) {
      category = cat;
      break;
    }
  }

  // Extract description from parameters
  let description = '';
  const descBlockMatch = content.match(
    /description:\s*{\s*component:\s*([\s\S]*?)\s*},?\s*}/
  );
  if (descBlockMatch) {
    const descBlock = descBlockMatch[1];
    const stringParts = [];
    const stringMatches = descBlock.matchAll(/['"]([^'"]*)['"]/g);
    for (const match of stringMatches) {
      stringParts.push(match[1]);
    }
    description = stringParts.join('').trim();
  }

  // Extract story exports
  const storyExports = [];
  const exportMatches = content.matchAll(/export\s+(?:const|function)\s+(\w+)/g);
  for (const match of exportMatches) {
    if (match[1] !== 'default') {
      storyExports.push(match[1]);
    }
  }

  // Extract component import path from the story file
  // Look for: import ComponentName from './path' (default export)
  // or: import { ComponentName } from './path' (named export)
  let componentImportPath = null;
  let isDefaultExport = true;

  // Try to find default import matching the component name
  // Handles: import Component from 'path'
  // and:     import Component, { OtherExport } from 'path'
  const defaultImportMatch = content.match(
    new RegExp(`import\\s+${componentName}(?:\\s*,\\s*{[^}]*})?\\s+from\\s+['"]([^'"]+)['"]`)
  );
  if (defaultImportMatch) {
    componentImportPath = defaultImportMatch[1];
    isDefaultExport = true;
  } else {
    // Try named import
    const namedImportMatch = content.match(
      new RegExp(`import\\s*{[^}]*\\b${componentName}\\b[^}]*}\\s*from\\s+['"]([^'"]+)['"]`)
    );
    if (namedImportMatch) {
      componentImportPath = namedImportMatch[1];
      isDefaultExport = false;
    }
  }

  // Calculate full import path if we found a relative import
  // For UI core components with aliases, keep using the alias
  let resolvedImportPath = sourceConfig.importPrefix;
  const useAlias = sourceConfig.importPrefix.startsWith('@superset/');

  if (componentImportPath && componentImportPath.startsWith('.') && !useAlias) {
    const storyDir = path.dirname(filePath);
    const resolvedPath = path.resolve(storyDir, componentImportPath);
    // Get path relative to frontend root, then convert to import path
    const frontendRelative = path.relative(FRONTEND_DIR, resolvedPath);
    resolvedImportPath = frontendRelative.replace(/\\/g, '/');
  } else if (!componentImportPath && !useAlias) {
    // Fallback: assume component is in same dir as story, named same as component
    const storyDir = path.dirname(filePath);
    const possibleComponentPath = path.join(storyDir, componentName);
    const frontendRelative = path.relative(FRONTEND_DIR, possibleComponentPath);
    resolvedImportPath = frontendRelative.replace(/\\/g, '/');
  }

  return {
    filePath,
    title,
    titleParts,
    componentName,
    category,
    description,
    storyExports,
    relativePath: path.relative(ROOT_DIR, filePath),
    sourceConfig,
    resolvedImportPath,
    isDefaultExport,
    extensionCompatible: Boolean(sourceConfig.extensionCompatible),
  };
}

/**
 * Parse args content and extract key-value pairs
 * Handles strings with apostrophes correctly
 */
function parseArgsContent(argsContent, args) {
  // Split into lines and process each line for simple key-value pairs
  const lines = argsContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Match: key: value pattern at start of line
    const propMatch = trimmed.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*):\s*(.+?)[\s,]*$/);
    // Also match key with value on the next line (e.g., prettier wrapping long strings)
    const keyOnlyMatch = !propMatch && trimmed.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*):$/);
    if (!propMatch && !keyOnlyMatch) continue;

    let key, valueStr;
    if (propMatch) {
      key = propMatch[1];
      valueStr = propMatch[2];
    } else {
      // Value is on the next line
      key = keyOnlyMatch[1];
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim().replace(/,\s*$/, '') : '';
      if (!nextLine) continue;
      valueStr = nextLine;
      i++; // Skip the next line since we consumed it
    }

    // Parse the value
    // Double-quoted string (handles apostrophes inside)
    const doubleQuoteMatch = valueStr.match(/^"([^"]*)"$/);
    if (doubleQuoteMatch) {
      args[key] = doubleQuoteMatch[1];
      continue;
    }

    // Single-quoted string
    const singleQuoteMatch = valueStr.match(/^'([^']*)'$/);
    if (singleQuoteMatch) {
      args[key] = singleQuoteMatch[1];
      continue;
    }

    // Template literal
    const templateMatch = valueStr.match(/^`([^`]*)`$/);
    if (templateMatch) {
      args[key] = templateMatch[1].replace(/\s+/g, ' ').trim();
      continue;
    }

    // Boolean
    if (valueStr === 'true' || valueStr === 'true,') {
      args[key] = true;
      continue;
    }
    if (valueStr === 'false' || valueStr === 'false,') {
      args[key] = false;
      continue;
    }

    // Number (including decimals and negative)
    const numMatch = valueStr.match(/^(-?\d+\.?\d*),?$/);
    if (numMatch) {
      args[key] = Number(numMatch[1]);
      continue;
    }

    // Skip complex values (objects, arrays, function calls, expressions)
  }
}

/**
 * Extract variable arrays from file content (for options references)
 */
function extractVariableArrays(content) {
  const variableArrays = {};

  // Pattern 1: const varName = ['a', 'b', 'c'];
  // Also handles: export const varName: Type[] = ['a', 'b', 'c'];
  const varMatches = content.matchAll(/(?:export\s+)?(?:const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)(?::\s*[^=]+)?\s*=\s*\[([^\]]+)\]/g);
  for (const varMatch of varMatches) {
    const varName = varMatch[1];
    const arrayContent = varMatch[2];
    const values = [];
    const valMatches = arrayContent.matchAll(/['"]([^'"]+)['"]/g);
    for (const val of valMatches) {
      values.push(val[1]);
    }
    if (values.length > 0) {
      variableArrays[varName] = values;
    }
  }

  // Pattern 2: const VAR = { options: [...] } - for SIZES.options, COLORS.options patterns
  const objWithOptionsMatches = content.matchAll(/(?:const|let)\s+([A-Z][A-Z_0-9]*)\s*=\s*\{[^}]*options:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
  for (const match of objWithOptionsMatches) {
    const objName = match[1];
    const optionsVarName = match[2];
    // Link the object's options to the underlying array
    if (variableArrays[optionsVarName]) {
      variableArrays[objName] = variableArrays[optionsVarName];
    }
  }

  return variableArrays;
}

/**
 * Extract a string value from content, handling quotes properly
 */
function extractStringValue(content, startIndex) {
  const remaining = content.slice(startIndex).trim();

  // Single-quoted string
  if (remaining.startsWith("'")) {
    let i = 1;
    while (i < remaining.length) {
      if (remaining[i] === "'" && remaining[i - 1] !== '\\') {
        return remaining.slice(1, i);
      }
      i++;
    }
  }

  // Double-quoted string
  if (remaining.startsWith('"')) {
    let i = 1;
    while (i < remaining.length) {
      if (remaining[i] === '"' && remaining[i - 1] !== '\\') {
        return remaining.slice(1, i);
      }
      i++;
    }
  }

  // Template literal
  if (remaining.startsWith('`')) {
    let i = 1;
    while (i < remaining.length) {
      if (remaining[i] === '`' && remaining[i - 1] !== '\\') {
        return remaining.slice(1, i).replace(/\s+/g, ' ').trim();
      }
      i++;
    }
  }

  return null;
}

/**
 * Parse argTypes content and populate the argTypes object
 */
function parseArgTypes(argTypesContent, argTypes, fullContent) {
  const variableArrays = extractVariableArrays(fullContent);

  // Match argType definitions - find each property block
  // Use balanced brace extraction for each property
  const propPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*):\s*\{/g;
  let propMatch;

  while ((propMatch = propPattern.exec(argTypesContent)) !== null) {
    const propName = propMatch[1];
    const propStartIndex = propMatch.index + propMatch[0].length - 1;
    const propConfig = extractBalancedBraces(argTypesContent, propStartIndex);

    if (!propConfig) continue;

    // Initialize argTypes entry if not exists
    if (!argTypes[propName]) {
      argTypes[propName] = {};
    }

    // Extract description - find the position and extract properly
    const descIndex = propConfig.indexOf('description:');
    if (descIndex !== -1) {
      const descValue = extractStringValue(propConfig, descIndex + 'description:'.length);
      if (descValue) {
        argTypes[propName].description = descValue;
      }
    }

    // Check for inline options array
    const optionsMatch = propConfig.match(/options:\s*\[([^\]]+)\]/);
    if (optionsMatch) {
      const optionsStr = optionsMatch[1];
      const options = [];
      const optionMatches = optionsStr.matchAll(/['"]([^'"]+)['"]/g);
      for (const opt of optionMatches) {
        options.push(opt[1]);
      }
      if (options.length > 0) {
        argTypes[propName].type = 'select';
        argTypes[propName].options = options;
      }
    } else {
      // Check for variable reference: options: variableName or options: VAR.options
      const varRefMatch = propConfig.match(/options:\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)?)/);
      if (varRefMatch) {
        const varRef = varRefMatch[1];
        // Handle VAR.options pattern
        const dotMatch = varRef.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\.options$/);
        if (dotMatch && variableArrays[dotMatch[1]]) {
          argTypes[propName].type = 'select';
          argTypes[propName].options = variableArrays[dotMatch[1]];
        } else if (variableArrays[varRef]) {
          argTypes[propName].type = 'select';
          argTypes[propName].options = variableArrays[varRef];
        }
      } else {
        // Check for ES6 shorthand: options, (same as options: options)
        const shorthandMatch = propConfig.match(/(?:^|[,\s])options(?:[,\s]|$)/);
        if (shorthandMatch && variableArrays['options']) {
          argTypes[propName].type = 'select';
          argTypes[propName].options = variableArrays['options'];
        }
      }
    }

    // Check for control type (radio, select, boolean, etc.)
    // Supports both: control: 'boolean' (shorthand) and control: { type: 'boolean' } (object)
    const controlShorthandMatch = propConfig.match(/control:\s*['"]([^'"]+)['"]/);
    const controlObjectMatch = propConfig.match(/control:\s*\{[^}]*type:\s*['"]([^'"]+)['"]/);
    if (controlShorthandMatch) {
      argTypes[propName].type = controlShorthandMatch[1];
    } else if (controlObjectMatch) {
      argTypes[propName].type = controlObjectMatch[1];
    }

    // Clear options for non-select/radio types (the shorthand "options" detection
    // can false-positive when the word "options" appears in description text)
    const finalType = argTypes[propName].type;
    if (finalType && !['select', 'radio', 'inline-radio'].includes(finalType)) {
      delete argTypes[propName].options;
    }
  }
}

/**
 * Helper to find balanced braces content
 */
function extractBalancedBraces(content, startIndex) {
  let depth = 0;
  let start = -1;
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(start, i);
      }
    }
  }
  return null;
}

/**
 * Helper to find balanced brackets content (for arrays)
 */
function extractBalancedBrackets(content, startIndex) {
  let depth = 0;
  let start = -1;
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '[') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (content[i] === ']') {
      depth--;
      if (depth === 0) {
        return content.slice(start, i);
      }
    }
  }
  return null;
}

/**
 * Convert camelCase prop name to human-readable label
 * Handles acronyms properly: imgURL -> "Image URL", coverLeft -> "Cover Left"
 */
function propNameToLabel(name) {
  return name
    // Insert space before uppercase letters that follow lowercase (camelCase boundary)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Handle common acronyms - keep them together
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // Capitalize first letter
    .replace(/^./, s => s.toUpperCase())
    // Fix common acronyms display
    .replace(/\bUrl\b/g, 'URL')
    .replace(/\bImg\b/g, 'Image')
    .replace(/\bId\b/g, 'ID');
}

/**
 * Convert JS object literal syntax to JSON
 * Handles: single quotes, unquoted keys, trailing commas
 */
function jsToJson(jsStr) {
  try {
    // Remove comments
    let str = jsStr.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // Replace single quotes with double quotes (but not inside already double-quoted strings)
    str = str.replace(/'/g, '"');

    // Add quotes around unquoted keys: { foo: -> { "foo":
    str = str.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

    // Remove trailing commas before } or ]
    str = str.replace(/,(\s*[}\]])/g, '$1');

    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Extract docs config from story parameters
 * Looks for: StoryName.parameters = { docs: { sampleChildren, sampleChildrenStyle, gallery, staticProps, liveExample } }
 * Uses generic JSON parsing for inline data
 */
function extractDocsConfig(content, storyNames) {
  // Extract variable arrays for gallery config (sizes, styles)
  const variableArrays = extractVariableArrays(content);

  let sampleChildren = null;
  let sampleChildrenStyle = null;
  let gallery = null;
  let staticProps = null;
  let liveExample = null;
  let examples = null;
  let renderComponent = null;
  let triggerProp = null;
  let onHideProp = null;

  for (const storyName of storyNames) {
    // Look for parameters block
    const parametersPattern = new RegExp(`${storyName}\\.parameters\\s*=\\s*\\{`, 's');
    const parametersMatch = content.match(parametersPattern);

    if (parametersMatch) {
      const parametersContent = extractBalancedBraces(content, parametersMatch.index + parametersMatch[0].length - 1);
      if (parametersContent) {
        // Extract sampleChildren - inline array using generic JSON parser
        const sampleChildrenArrayMatch = parametersContent.match(/sampleChildren:\s*\[/);
        if (sampleChildrenArrayMatch) {
          const arrayStartIndex = sampleChildrenArrayMatch.index + sampleChildrenArrayMatch[0].length - 1;
          const arrayContent = extractBalancedBrackets(parametersContent, arrayStartIndex);
          if (arrayContent) {
            const parsed = jsToJson('[' + arrayContent + ']');
            if (parsed && parsed.length > 0) {
              sampleChildren = parsed;
            }
          }
        }

        // Extract sampleChildrenStyle - inline object using generic JSON parser
        const sampleChildrenStyleMatch = parametersContent.match(/sampleChildrenStyle:\s*\{/);
        if (sampleChildrenStyleMatch) {
          const styleContent = extractBalancedBraces(parametersContent, sampleChildrenStyleMatch.index + sampleChildrenStyleMatch[0].length - 1);
          if (styleContent) {
            const parsed = jsToJson('{' + styleContent + '}');
            if (parsed) {
              sampleChildrenStyle = parsed;
            }
          }
        }

        // Extract staticProps - generic JSON-like object extraction
        const staticPropsMatch = parametersContent.match(/staticProps:\s*\{/);
        if (staticPropsMatch) {
          const staticPropsContent = extractBalancedBraces(parametersContent, staticPropsMatch.index + staticPropsMatch[0].length - 1);
          if (staticPropsContent) {
            // Try to parse as JSON (handles inline data)
            const parsed = jsToJson('{' + staticPropsContent + '}');
            if (parsed) {
              staticProps = parsed;
            }
          }
        }

        // Extract gallery config
        const galleryMatch = parametersContent.match(/gallery:\s*\{/);
        if (galleryMatch) {
          const galleryContent = extractBalancedBraces(parametersContent, galleryMatch.index + galleryMatch[0].length - 1);
          if (galleryContent) {
            gallery = {};

            // Extract component name
            const compMatch = galleryContent.match(/component:\s*['"]([^'"]+)['"]/);
            if (compMatch) gallery.component = compMatch[1];

            // Extract sizes - variable reference
            const sizesVarMatch = galleryContent.match(/sizes:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/);
            if (sizesVarMatch && variableArrays[sizesVarMatch[1]]) {
              gallery.sizes = variableArrays[sizesVarMatch[1]];
            }

            // Extract styles - variable reference
            const stylesVarMatch = galleryContent.match(/styles:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/);
            if (stylesVarMatch && variableArrays[stylesVarMatch[1]]) {
              gallery.styles = variableArrays[stylesVarMatch[1]];
            }

            // Extract sizeProp
            const sizePropMatch = galleryContent.match(/sizeProp:\s*['"]([^'"]+)['"]/);
            if (sizePropMatch) gallery.sizeProp = sizePropMatch[1];

            // Extract styleProp
            const stylePropMatch = galleryContent.match(/styleProp:\s*['"]([^'"]+)['"]/);
            if (stylePropMatch) gallery.styleProp = stylePropMatch[1];
          }
        }

        // Extract liveExample - template literal for custom live code block
        const liveExampleMatch = parametersContent.match(/liveExample:\s*`/);
        if (liveExampleMatch) {
          // Find the closing backtick
          const startIndex = liveExampleMatch.index + liveExampleMatch[0].length;
          let endIndex = startIndex;
          while (endIndex < parametersContent.length && parametersContent[endIndex] !== '`') {
            // Handle escaped backticks
            if (parametersContent[endIndex] === '\\' && parametersContent[endIndex + 1] === '`') {
              endIndex += 2;
            } else {
              endIndex++;
            }
          }
          if (endIndex < parametersContent.length) {
            // Unescape template literal escapes (source text has \` and \$ for literal backticks/dollars)
            liveExample = parametersContent.slice(startIndex, endIndex).replace(/\\`/g, '`').replace(/\\\$/g, '$');
          }
        }

        // Extract renderComponent - allows overriding which component to render
        // Useful when the title-derived component (e.g., 'Icons') is a namespace, not a component
        const renderComponentMatch = parametersContent.match(/renderComponent:\s*['"]([^'"]+)['"]/);
        if (renderComponentMatch) {
          renderComponent = renderComponentMatch[1];
        }

        // Extract triggerProp/onHideProp - for components like Modal that need a trigger button
        const triggerPropMatch = parametersContent.match(/triggerProp:\s*['"]([^'"]+)['"]/);
        if (triggerPropMatch) {
          triggerProp = triggerPropMatch[1];
        }
        const onHidePropMatch = parametersContent.match(/onHideProp:\s*['"]([^'"]+)['"]/);
        if (onHidePropMatch) {
          onHideProp = onHidePropMatch[1];
        }

        // Extract examples array - for multiple code examples
        // Format: examples: [{ title: 'Title', code: `...` }, ...]
        const examplesMatch = parametersContent.match(/examples:\s*\[/);
        if (examplesMatch) {
          const examplesStartIndex = examplesMatch.index + examplesMatch[0].length - 1;
          const examplesArrayContent = extractBalancedBrackets(parametersContent, examplesStartIndex);
          if (examplesArrayContent) {
            examples = [];
            // Find each example object { title: '...', code: `...` }
            const exampleObjPattern = /\{\s*title:\s*['"]([^'"]+)['"]\s*,\s*code:\s*`/g;
            let exampleMatch;
            while ((exampleMatch = exampleObjPattern.exec(examplesArrayContent)) !== null) {
              const title = exampleMatch[1];
              const codeStartIndex = exampleMatch.index + exampleMatch[0].length;
              // Find closing backtick for code
              let codeEndIndex = codeStartIndex;
              while (codeEndIndex < examplesArrayContent.length && examplesArrayContent[codeEndIndex] !== '`') {
                if (examplesArrayContent[codeEndIndex] === '\\' && examplesArrayContent[codeEndIndex + 1] === '`') {
                  codeEndIndex += 2;
                } else {
                  codeEndIndex++;
                }
              }
              // Unescape template literal escapes (source text has \` and \$ for literal backticks/dollars)
              const code = examplesArrayContent.slice(codeStartIndex, codeEndIndex).replace(/\\`/g, '`').replace(/\\\$/g, '$');
              examples.push({ title, code });
            }
          }
        }
      }
    }

    if (sampleChildren || gallery || staticProps || liveExample || examples || renderComponent || triggerProp) break;
  }

  return { sampleChildren, sampleChildrenStyle, gallery, staticProps, liveExample, examples, renderComponent, triggerProp, onHideProp };
}

/**
 * Extract args and controls from story content
 */
function extractArgsAndControls(content, componentName) {
  const args = {};
  const argTypes = {};

  // First, extract argTypes from the default export meta (shared across all stories)
  // Pattern: export default { argTypes: {...} }
  const defaultExportMatch = content.match(/export\s+default\s*\{/);
  if (defaultExportMatch) {
    const metaContent = extractBalancedBraces(content, defaultExportMatch.index + defaultExportMatch[0].length - 1);
    if (metaContent) {
      const metaArgTypesMatch = metaContent.match(/\bargTypes:\s*\{/);
      if (metaArgTypesMatch) {
        const metaArgTypesContent = extractBalancedBraces(metaContent, metaArgTypesMatch.index + metaArgTypesMatch[0].length - 1);
        if (metaArgTypesContent) {
          parseArgTypes(metaArgTypesContent, argTypes, content);
        }
      }
    }
  }

  // Then, try to find the Interactive story block (CSF 3.0 or CSF 2.0)
  // Support multiple naming conventions:
  // - InteractiveComponentName (CSF 2.0 convention)
  // - ComponentNameStory (CSF 3.0 convention)
  // - ComponentName (fallback)
  const storyNames = [`Interactive${componentName}`, `${componentName}Story`, componentName];

  // Extract docs config (sampleChildren, sampleChildrenStyle, gallery, staticProps, liveExample) from parameters.docs
  const { sampleChildren, sampleChildrenStyle, gallery, staticProps, liveExample, examples, renderComponent, triggerProp, onHideProp } = extractDocsConfig(content, storyNames);

  for (const storyName of storyNames) {
    // Try CSF 3.0 format: export const StoryName: StoryObj = { args: {...}, argTypes: {...} }
    const csf3Pattern = new RegExp(`export\\s+const\\s+${storyName}[^=]*=[^{]*\\{`, 's');
    const csf3Match = content.match(csf3Pattern);

    if (csf3Match) {
      const storyStartIndex = csf3Match.index + csf3Match[0].length - 1;
      const storyContent = extractBalancedBraces(content, storyStartIndex);

      if (storyContent) {
        // Extract args from story content
        const argsMatch = storyContent.match(/\bargs:\s*\{/);
        if (argsMatch) {
          const argsContent = extractBalancedBraces(storyContent, argsMatch.index + argsMatch[0].length - 1);
          if (argsContent) {
            parseArgsContent(argsContent, args);
          }
        }

        // Extract argTypes from story content
        const argTypesMatch = storyContent.match(/\bargTypes:\s*\{/);
        if (argTypesMatch) {
          const argTypesContent = extractBalancedBraces(storyContent, argTypesMatch.index + argTypesMatch[0].length - 1);
          if (argTypesContent) {
            parseArgTypes(argTypesContent, argTypes, content);
          }
        }

        if (Object.keys(args).length > 0 || Object.keys(argTypes).length > 0) {
          break; // Found a matching story
        }
      }
    }

    // Try CSF 2.0 format: StoryName.args = {...}
    const csf2ArgsPattern = new RegExp(`${storyName}\\.args\\s*=\\s*\\{`, 's');
    const csf2ArgsMatch = content.match(csf2ArgsPattern);
    if (csf2ArgsMatch) {
      const argsContent = extractBalancedBraces(content, csf2ArgsMatch.index + csf2ArgsMatch[0].length - 1);
      if (argsContent) {
        parseArgsContent(argsContent, args);
      }
    }

    // Try CSF 2.0 argTypes: StoryName.argTypes = {...}
    const csf2ArgTypesPattern = new RegExp(`${storyName}\\.argTypes\\s*=\\s*\\{`, 's');
    const csf2ArgTypesMatch = content.match(csf2ArgTypesPattern);
    if (csf2ArgTypesMatch) {
      const argTypesContent = extractBalancedBraces(content, csf2ArgTypesMatch.index + csf2ArgTypesMatch[0].length - 1);
      if (argTypesContent) {
        parseArgTypes(argTypesContent, argTypes, content);
      }
    }

    if (Object.keys(args).length > 0 || Object.keys(argTypes).length > 0) {
      break; // Found a matching story
    }
  }

  // Generate controls from args first, then add any argTypes-only props
  const controls = [];
  const processedProps = new Set();

  // First pass: props that have default values in args
  for (const [key, value] of Object.entries(args)) {
    processedProps.add(key);
    const label = propNameToLabel(key);
    const argType = argTypes[key] || {};

    if (argType.type) {
      // Use argTypes override (select, radio with options)
      controls.push({
        name: key,
        label,
        type: argType.type,
        options: argType.options,
        description: argType.description
      });
    } else if (typeof value === 'boolean') {
      controls.push({ name: key, label, type: 'boolean', description: argType.description });
    } else if (typeof value === 'string') {
      controls.push({ name: key, label, type: 'text', description: argType.description });
    } else if (typeof value === 'number') {
      controls.push({ name: key, label, type: 'number', description: argType.description });
    }
  }

  // Second pass: props defined only in argTypes (no explicit value in args)
  // Add controls for these, but don't set default values on the component
  // (setting defaults like open: false or status: 'error' breaks component behavior)
  for (const [key, argType] of Object.entries(argTypes)) {
    if (processedProps.has(key)) continue;
    if (!argType.type) continue; // Skip if no control type defined

    const label = propNameToLabel(key);

    // Don't add to args - let the component use its own defaults

    controls.push({
      name: key,
      label,
      type: argType.type,
      options: argType.options,
      description: argType.description
    });
  }

  return { args, argTypes, controls, sampleChildren, sampleChildrenStyle, gallery, staticProps, liveExample, examples, renderComponent, triggerProp, onHideProp };
}

/**
 * Generate MDX content for a component
 */
function generateMDX(component, storyContent) {
  const { componentName, description, relativePath, category, sourceConfig, resolvedImportPath, isDefaultExport } = component;

  const { args, argTypes, controls, sampleChildren, sampleChildrenStyle, gallery, staticProps, liveExample, examples, renderComponent, triggerProp, onHideProp } = extractArgsAndControls(storyContent, componentName);

  // Merge staticProps into args for complex values (arrays, objects) that can't be parsed from inline args
  const mergedArgs = { ...args, ...staticProps };

  // Format JSON: unquote property names but keep double quotes for string values
  // This avoids issues with single quotes in strings breaking MDX parsing
  const controlsJson = JSON.stringify(controls, null, 2)
    .replace(/"(\w+)":/g, '$1:');

  const propsJson = JSON.stringify(mergedArgs, null, 2)
    .replace(/"(\w+)":/g, '$1:');

  // Format sampleChildren if present (from story's parameters.docs.sampleChildren)
  const sampleChildrenJson = sampleChildren
    ? JSON.stringify(sampleChildren)
    : null;

  // Format sampleChildrenStyle if present (from story's parameters.docs.sampleChildrenStyle)
  const sampleChildrenStyleJson = sampleChildrenStyle
    ? JSON.stringify(sampleChildrenStyle).replace(/"(\w+)":/g, '$1:')
    : null;

  // Format gallery config if present
  const hasGallery = gallery && gallery.sizes && gallery.styles;

  // Extract children for proper JSX rendering
  const childrenValue = mergedArgs.children;

  const liveExampleProps = Object.entries(mergedArgs)
    .filter(([key]) => key !== 'children')
    .map(([key, value]) => {
      if (typeof value === 'string') return `${key}="${value}"`;
      if (typeof value === 'boolean') return value ? key : null;
      return `${key}={${JSON.stringify(value)}}`;
    })
    .filter(Boolean)
    .join('\n      ');

  // Generate props table with descriptions from argTypes
  const propsTable = Object.entries(mergedArgs).map(([key, value]) => {
    const type = typeof value === 'boolean' ? 'boolean' : typeof value === 'string' ? 'string' : typeof value === 'number' ? 'number' : 'any';
    const desc = argTypes[key]?.description || '-';
    return `| \`${key}\` | \`${type}\` | \`${JSON.stringify(value)}\` | ${desc} |`;
  }).join('\n');

  // Calculate relative import path based on category depth
  const importDepth = category.includes('/') ? 4 : 3;
  const wrapperImportPrefix = '../'.repeat(importDepth);

  // Use resolved import path if available, otherwise fall back to source config
  const componentImportPath = resolvedImportPath || sourceConfig.importPrefix;

  // Determine component description based on source
  const defaultDesc = sourceConfig.category === 'ui'
    ? `The ${componentName} component from Superset's UI library.`
    : `The ${componentName} component from Superset.`;

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

import { StoryWithControls${hasGallery ? ', ComponentGallery' : ''} } from '${wrapperImportPrefix}src/components/StorybookWrapper';

# ${componentName}

${description || defaultDesc}
${hasGallery ? `
## All Variants

<ComponentGallery
  component="${gallery.component || componentName}"
  sizes={${JSON.stringify(gallery.sizes)}}
  styles={${JSON.stringify(gallery.styles)}}
  sizeProp="${gallery.sizeProp || 'size'}"
  styleProp="${gallery.styleProp || 'variant'}"
/>
` : ''}
## Live Example

<StoryWithControls
  component="${componentName}"${renderComponent ? `
  renderComponent="${renderComponent}"` : ''}
  props={${propsJson}}
  controls={${controlsJson}}${sampleChildrenJson ? `
  sampleChildren={${sampleChildrenJson}}` : ''}${sampleChildrenStyleJson ? `
  sampleChildrenStyle={${sampleChildrenStyleJson}}` : ''}${triggerProp ? `
  triggerProp="${triggerProp}"` : ''}${onHideProp ? `
  onHideProp="${onHideProp}"` : ''}
/>

## Try It

Edit the code below to experiment with the component:

\`\`\`tsx live
${liveExample || `function Demo() {
  return (
    <${componentName}
      ${liveExampleProps || '// Add props here'}
    ${childrenValue ? `>
      ${childrenValue}
    </${componentName}>` : '/>'}
  );
}`}
\`\`\`
${examples && examples.length > 0 ? examples.map(ex => `
## ${ex.title}

\`\`\`tsx live
${ex.code}
\`\`\`
`).join('') : ''}
${Object.keys(args).length > 0 ? `## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
${propsTable}` : ''}

## Import

\`\`\`tsx
${isDefaultExport ? `import ${componentName} from '${componentImportPath}';` : `import { ${componentName} } from '${componentImportPath}';`}
\`\`\`

---

:::tip[Improve this page]
This documentation is auto-generated from the component's Storybook story.
Help improve it by [editing the story file](https://github.com/apache/superset/edit/master/${relativePath}).
:::
`;
}

/**
 * Category display names for sidebar
 */
const CATEGORY_LABELS = {
  ui: { title: 'Core Components', sidebarLabel: 'Core Components', description: 'Buttons, inputs, modals, selects, and other fundamental UI elements.' },
  'design-system': { title: 'Layout Components', sidebarLabel: 'Layout Components', description: 'Grid, Layout, Table, Flex, Space, and container components for page structure.' },
  extension: { title: 'Extension Components', sidebarLabel: 'Extension Components', description: 'Components available to extension developers via @apache-superset/core/ui.' },
};

/**
 * Generate category index page
 */
function generateCategoryIndex(category, components) {
  const labels = CATEGORY_LABELS[category] || {
    title: category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' '),
    sidebarLabel: category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' '),
  };
  const componentList = components
    .sort((a, b) => a.componentName.localeCompare(b.componentName))
    .map(c => `- [${c.componentName}](./${c.componentName.toLowerCase()})`)
    .join('\n');

  return `---
title: ${labels.title}
sidebar_label: ${labels.sidebarLabel}
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

# ${labels.title}

${components.length} components available in this category.

## Components

${componentList}
`;
}

/**
 * Generate main overview page
 */
function generateOverviewIndex() {
  return `---
title: UI Components Overview
sidebar_label: Overview
sidebar_position: 0
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

import { ComponentIndex } from '@site/src/components/ui-components';
import componentData from '@site/static/data/components.json';

# UI Components

<ComponentIndex data={componentData} />

---

## Design System

A design system is a complete set of standards intended to manage design at scale using reusable components and patterns.

The Superset Design System uses [Atomic Design](https://bradfrost.com/blog/post/atomic-web-design/) principles with adapted terminology:

| Atomic Design | Atoms | Molecules | Organisms | Templates | Pages / Screens |
|---|:---:|:---:|:---:|:---:|:---:|
| **Superset Design** | Foundations | Components | Patterns | Templates | Features |

<img src="/img/atomic-design.png" alt="Atoms = Foundations, Molecules = Components, Organisms = Patterns, Templates = Templates, Pages / Screens = Features" style={{maxWidth: '100%'}} />

## Usage

All components are exported from \`@superset-ui/core/components\`:

\`\`\`tsx
import { Button, Modal, Select } from '@superset-ui/core/components';
\`\`\`

## Contributing

This documentation is auto-generated from Storybook stories. To add or update component documentation:

1. Create or update the component's \`.stories.tsx\` file
2. Add a descriptive \`title\` and \`description\` in the story meta
3. Export an interactive story with \`args\` for configurable props
4. Run \`yarn generate:superset-components\` in the \`docs/\` directory

:::info Work in Progress
This component library is actively being documented. See the [Components TODO](./TODO) page for a list of components awaiting documentation.
:::

---

*Auto-generated from Storybook stories in the [Design System/Introduction](https://github.com/apache/superset/blob/master/superset-frontend/packages/superset-ui-core/src/components/DesignSystem.stories.tsx) story.*
`;
}

/**
 * Generate TODO.md tracking skipped components
 */
function generateTodoMd(skippedFiles) {
  const disabledSources = SOURCES.filter(s => !s.enabled);
  const grouped = {};
  for (const file of skippedFiles) {
    const source = disabledSources.find(s => file.includes(s.path));
    const sourceName = source ? source.name : 'unknown';
    if (!grouped[sourceName]) grouped[sourceName] = [];
    grouped[sourceName].push(file);
  }

  const sections = Object.entries(grouped)
    .map(([source, files]) => {
      const fileList = files.map(f => `- [ ] \`${path.relative(ROOT_DIR, f)}\``).join('\n');
      return `### ${source}\n\n${files.length} components\n\n${fileList}`;
    })
    .join('\n\n');

  return `---
title: Components TODO
sidebar_class_name: hidden
---

# Components TODO

These components were found but not yet supported for documentation generation.
Future phases will add support for these sources.

## Summary

- **Total skipped:** ${skippedFiles.length} story files
- **Reason:** Import path resolution not yet implemented

## Skipped by Source

${sections}

## How to Add Support

1. Determine the correct import path for the source
2. Update \`generate-superset-components.mjs\` to handle the source
3. Add source to \`SUPPORTED_SOURCES\` array
4. Re-run the generator

---

*Auto-generated by generate-superset-components.mjs*
`;
}

/**
 * Build metadata for a component (for JSON output)
 */
function buildComponentMetadata(component, storyContent) {
  const { componentName, description, category, sourceConfig, resolvedImportPath, extensionCompatible } = component;
  const { args, controls, gallery, liveExample } = extractArgsAndControls(storyContent, componentName);
  const labels = CATEGORY_LABELS[category] || {
    title: category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' '),
  };

  return {
    name: componentName,
    category,
    categoryLabel: labels.title || category,
    description: description || '',
    importPath: resolvedImportPath || sourceConfig.importPrefix,
    package: sourceConfig.docImportPrefix,
    extensionCompatible: Boolean(extensionCompatible),
    propsCount: Object.keys(args).length,
    controlsCount: controls.length,
    hasGallery: Boolean(gallery && gallery.sizes && gallery.styles),
    hasLiveExample: Boolean(liveExample),
    docPath: `developer-docs/components/${category}/${componentName.toLowerCase()}`,
    storyFile: component.relativePath,
  };
}

/**
 * Extract type and component export declarations from a component source file.
 * Used to generate .d.ts type declarations for extension-compatible components.
 */
function extractComponentTypes(componentPath) {
  if (!fs.existsSync(componentPath)) return null;
  const content = fs.readFileSync(componentPath, 'utf-8');

  const types = [];
  // Match "export type Name = <definition>;" handling nested braces
  // so object types like { a: string; b: number } are captured fully.
  const typeRegex = /export\s+type\s+(\w+)\s*=\s*/g;
  let typeMatch;
  while ((typeMatch = typeRegex.exec(content)) !== null) {
    const start = typeMatch.index + typeMatch[0].length;
    let depth = 0;
    let end = start;
    for (let i = start; i < content.length; i++) {
      const ch = content[i];
      if (ch === '{' || ch === '<' || ch === '(') depth++;
      else if (ch === '}' || ch === '>' || ch === ')') depth--;
      else if (ch === ';' && depth === 0) {
        end = i;
        break;
      }
    }
    const definition = content.slice(start, end).trim();
    if (definition) {
      types.push({ name: typeMatch[1], definition });
    }
  }

  const components = [];
  for (const match of content.matchAll(/export\s+const\s+(\w+)\s*[=:]/g)) {
    components.push(match[1]);
  }

  return { types, components };
}

/**
 * Generate TypeScript type declarations for extension-compatible components.
 * Produces a .d.ts file that downstream consumers can reference.
 */
function generateExtensionTypeDeclarations(extensionComponents) {
  const imports = new Set();
  const typeDeclarations = [];
  const componentDeclarations = [];

  for (const comp of extensionComponents) {
    const componentDir = path.dirname(comp.filePath);
    const componentFile = path.join(componentDir, 'index.tsx');
    const extracted = extractComponentTypes(componentFile);
    if (!extracted) continue;

    for (const type of extracted.types) {
      if (type.definition.includes('AntdAlertProps') || type.definition.includes('AlertProps')) {
        imports.add("import type { AlertProps as AntdAlertProps } from 'antd/es/alert';");
      }
      if (type.definition.includes('PropsWithChildren') || type.definition.includes('FC')) {
        imports.add("import type { PropsWithChildren, FC } from 'react';");
      }
      typeDeclarations.push(`export type ${type.name} = ${type.definition};`);
    }

    for (const name of extracted.components) {
      const propsType = `${name}Props`;
      const hasPropsType = extracted.types.some(t => t.name === propsType);
      componentDeclarations.push(
        hasPropsType
          ? `export const ${name}: FC<${propsType}>;`
          : `export const ${name}: FC<Record<string, unknown>>;`
      );
    }
  }

  // Always import FC when we have component declarations that reference it
  if (componentDeclarations.length > 0) {
    imports.add("import type { PropsWithChildren, FC } from 'react';");
  }

  return `/**
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
 * Type declarations for @apache-superset/core/ui
 *
 * AUTO-GENERATED by scripts/generate-superset-components.mjs
 * Do not edit manually - regenerate by running: yarn generate:superset-components
 */
${Array.from(imports).join('\n')}

${typeDeclarations.join('\n')}

${componentDeclarations.join('\n')}
`;
}

/**
 * Main function
 */
async function main() {
  console.log('Generating Superset Components documentation...\n');

  // Find enabled story files
  const enabledFiles = findEnabledStoryFiles();
  console.log(`Found ${enabledFiles.length} story files from enabled sources\n`);

  // Find disabled story files (for tracking)
  const disabledFiles = findDisabledStoryFiles();
  console.log(`Found ${disabledFiles.length} story files from disabled sources (tracking only)\n`);

  // Parse enabled files
  const components = [];
  for (const { file, source } of enabledFiles) {
    const parsed = parseStoryFile(file, source);
    if (parsed && parsed.componentName) {
      components.push(parsed);
    }
  }

  console.log(`Parsed ${components.length} components\n`);

  // Group by category
  const categories = {};
  for (const component of components) {
    if (!categories[component.category]) {
      categories[component.category] = [];
    }
    categories[component.category].push(component);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Generate MDX files by category
  let generatedCount = 0;
  for (const [category, categoryComponents] of Object.entries(categories)) {
    const categoryDir = path.join(OUTPUT_DIR, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    // Generate component pages
    for (const component of categoryComponents) {
      const storyContent = fs.readFileSync(component.filePath, 'utf-8');
      const mdxContent = generateMDX(component, storyContent);
      const outputPath = path.join(categoryDir, `${component.componentName.toLowerCase()}.mdx`);
      fs.writeFileSync(outputPath, mdxContent);
      console.log(`  ✓ ${category}/${component.componentName}`);
      generatedCount++;
    }

    // Generate category index
    const indexContent = generateCategoryIndex(category, categoryComponents);
    const indexPath = path.join(categoryDir, 'index.mdx');
    fs.writeFileSync(indexPath, indexContent);
    console.log(`  ✓ ${category}/index`);
  }

  // Build JSON metadata for all components
  console.log('\nBuilding component metadata JSON...');
  const componentMetadata = [];
  for (const component of components) {
    const storyContent = fs.readFileSync(component.filePath, 'utf-8');
    componentMetadata.push(buildComponentMetadata(component, storyContent));
  }

  // Build statistics
  const byCategory = {};
  for (const comp of componentMetadata) {
    if (!byCategory[comp.category]) byCategory[comp.category] = 0;
    byCategory[comp.category]++;
  }
  const jsonData = {
    generated: new Date().toISOString(),
    statistics: {
      totalComponents: componentMetadata.length,
      byCategory,
      extensionCompatible: componentMetadata.filter(c => c.extensionCompatible).length,
      withGallery: componentMetadata.filter(c => c.hasGallery).length,
      withLiveExample: componentMetadata.filter(c => c.hasLiveExample).length,
    },
    components: componentMetadata,
  };

  // Ensure data directory exists and write JSON
  const jsonDir = path.dirname(JSON_OUTPUT_PATH);
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
  }
  fs.writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(jsonData, null, 2));
  console.log(`  ✓ components.json (${componentMetadata.length} components)`);

  // Generate type declarations for extension-compatible components
  const extensionComponents = components.filter(c => c.extensionCompatible);
  if (extensionComponents.length > 0) {
    if (!fs.existsSync(TYPES_OUTPUT_DIR)) {
      fs.mkdirSync(TYPES_OUTPUT_DIR, { recursive: true });
    }
    const typesContent = generateExtensionTypeDeclarations(extensionComponents);
    fs.writeFileSync(TYPES_OUTPUT_PATH, typesContent);
    console.log(`  ✓ extension types (${extensionComponents.length} components)`);
  }

  // Generate main overview
  const overviewContent = generateOverviewIndex();
  const overviewPath = path.join(OUTPUT_DIR, 'index.mdx');
  fs.writeFileSync(overviewPath, overviewContent);
  console.log(`  ✓ index (overview)`);

  // Generate TODO.md
  const todoContent = generateTodoMd(disabledFiles);
  const todoPath = path.join(OUTPUT_DIR, 'TODO.md');
  fs.writeFileSync(todoPath, todoContent);
  console.log(`  ✓ TODO.md`);

  console.log(`\nDone! Generated ${generatedCount} component pages.`);
  console.log(`Tracked ${disabledFiles.length} components for future implementation.`);
}

main().catch(console.error);
