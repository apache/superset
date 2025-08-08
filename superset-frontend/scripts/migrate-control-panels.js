#!/usr/bin/env node
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

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Migration template for control panels
 */
const TEMPLATE = `/**
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
import { t } from '@superset-ui/core';
import { JsonSchema, UISchemaElement } from '@jsonforms/core';
import {
  JsonFormsControlPanelConfig,
  createVerticalLayout,
  createCollapsibleGroup,
  createControl,
  createHorizontalLayout,
} from '@superset-ui/chart-controls';

// AUTO-MIGRATED: Please review and adjust the control types and layout

{{CONTENT}}

const controlPanel: JsonFormsControlPanelConfig = {
  schema,
  uischema,
  {{EXTRAS}}
};

export default controlPanel;
`;

/**
 * Extract control information from AST-like analysis
 */
function extractControls(content) {
  const controls = [];

  // Find control references like [MetricControl()], [GroupByControl()], etc.
  const controlMatches = content.matchAll(/\[(\w+Control)\(\)\]/g);
  for (const match of controlMatches) {
    const controlName = match[1];
    controls.push({
      type: controlName,
      name: controlName.replace('Control', '').toLowerCase(),
    });
  }

  // Find custom control items
  const customMatches = content.matchAll(/name:\s*['"](\w+)['"]/g);
  for (const match of customMatches) {
    controls.push({
      type: 'CustomControl',
      name: match[1],
    });
  }

  return controls;
}

/**
 * Extract sections from content
 */
function extractSections(content) {
  const sections = [];

  // Find section labels
  const sectionMatches = content.matchAll(/label:\s*t\(['"]([^'"]+)['"]\)/g);
  for (const match of sectionMatches) {
    sections.push({
      label: match[1],
      expanded: content.includes(`label: t('${match[1]}')`),
    });
  }

  return sections;
}

/**
 * Generate schema from controls
 */
function generateSchema(controls) {
  const properties = {};

  const typeMap = {
    metric: { type: 'string', title: 'Metric' },
    metrics: { type: 'array', title: 'Metrics' },
    groupby: { type: 'array', title: 'Group By' },
    columns: { type: 'array', title: 'Columns' },
    adhoc_filters: { type: 'array', title: 'Filters' },
    row_limit: { type: 'integer', title: 'Row Limit', default: 10000 },
    sort_by_metric: { type: 'boolean', title: 'Sort by Metric' },
    color_scheme: { type: 'string', title: 'Color Scheme' },
    y_axis_format: { type: 'string', title: 'Number Format' },
  };

  controls.forEach(control => {
    const { name } = control;
    properties[name] = typeMap[name] || { type: 'string', title: name };
  });

  return {
    type: 'object',
    properties,
  };
}

/**
 * Generate UI schema from sections and controls
 */
function generateUISchema(sections, controls) {
  const elements = sections.map(section => {
    const sectionControls = controls.map(control => ({
      type: 'Control',
      scope: `#/properties/${control.name}`,
      options: {
        controlType: control.type,
      },
    }));

    return `createCollapsibleGroup(
    t('${section.label}'),
    [
      ${sectionControls
        .map(
          c =>
            `createControl('${c.scope}', { controlType: '${c.options.controlType}' })`,
        )
        .join(',\n      ')}
    ],
    ${section.expanded}
  )`;
  });

  return `createVerticalLayout([
  ${elements.join(',\n  ')}
])`;
}

/**
 * Migrate a single control panel file
 */
function migrateFile(filePath) {
  console.log(`Migrating: ${filePath}`);

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Skip if already migrated
    if (content.includes('JsonFormsControlPanelConfig')) {
      console.log(`  ✓ Already migrated`);
      return true;
    }

    // Skip JsonForms files
    if (filePath.includes('JsonForms') || filePath.includes('jsonForms')) {
      console.log(`  ✓ Skipping JSON Forms file`);
      return true;
    }

    // Extract information
    const controls = extractControls(content);
    const sections = extractSections(content);

    if (controls.length === 0) {
      console.log(`  ⚠ No controls found`);
      return false;
    }

    // Generate new content
    const schema = generateSchema(controls);
    const uischema = generateUISchema(sections, controls);

    const schemaStr = `export const schema: JsonSchema = ${JSON.stringify(schema, null, 2)};`;
    const uischemaStr = `export const uischema: UISchemaElement = ${uischema};`;

    // Check for extras
    const extras = [];
    if (content.includes('controlOverrides')) {
      extras.push('// TODO: Migrate controlOverrides');
    }
    if (content.includes('formDataOverrides')) {
      extras.push('// TODO: Migrate formDataOverrides');
    }

    const newContent = TEMPLATE.replace(
      '{{CONTENT}}',
      `${schemaStr}\n\n${uischemaStr}`,
    ).replace('{{EXTRAS}}', extras.join(',\n  '));

    // Write new file
    const newPath = filePath.replace('.ts', '.ts').replace('.tsx', '.tsx');
    fs.writeFileSync(newPath, newContent);

    console.log(`  ✓ Migrated successfully`);
    return true;
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    return false;
  }
}

/**
 * Main migration function
 */
function main() {
  const pattern = process.argv[2] || 'plugins/**/controlPanel*.{ts,tsx}';
  const dryRun = process.argv.includes('--dry-run');

  console.log('Control Panel Migration to JSON Forms');
  console.log('=====================================');
  console.log(`Pattern: ${pattern}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  const files = glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/*.test.*', '**/*JsonForms*'],
  });

  console.log(`Found ${files.length} control panel files`);
  console.log('');

  let successCount = 0;
  let failedCount = 0;

  files.forEach(file => {
    if (dryRun) {
      console.log(`Would migrate: ${file}`);
      successCount++;
    } else if (migrateFile(file)) {
      successCount++;
    } else {
      failedCount++;
    }
  });

  console.log('');
  console.log('Summary:');
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log(`  Total: ${files.length}`);
}

// Run the migration
main();
