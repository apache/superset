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
import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { migrateControlPanel } from './controlPanelMigration';
import { ControlPanelConfig } from '../types';

/**
 * Template for the migrated control panel file
 */
const MIGRATION_TEMPLATE = `/**
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
import { JsonSchema, UISchemaElement } from '@jsonforms/core';
import { JsonFormsControlPanelConfig } from '@superset-ui/chart-controls';

// AUTO-GENERATED: This file was automatically migrated from the legacy control panel format
// Please review and adjust as needed

{{IMPORTS}}

/**
 * JSON Schema for the chart
 */
export const schema: JsonSchema = {{SCHEMA}};

/**
 * UI Schema for the chart layout
 */
export const uischema: UISchemaElement = {{UISCHEMA}};

/**
 * Control panel configuration
 */
const controlPanel: JsonFormsControlPanelConfig = {
  schema,
  uischema,
  {{OVERRIDES}}
};

export default controlPanel;
`;

/**
 * Process a single control panel file
 */
export function processControlPanelFile(
  inputPath: string,
  outputPath?: string,
): { success: boolean; error?: string } {
  try {
    // Read the file
    const content = readFileSync(inputPath, 'utf-8');

    // Extract the control panel config
    // This is simplified - in reality we'd need to parse the TypeScript/JavaScript
    const configMatch = content.match(
      /const\s+controlPanel\s*:\s*ControlPanelConfig\s*=\s*({[\s\S]*?});/,
    );

    if (!configMatch) {
      return {
        success: false,
        error: 'Could not find control panel configuration',
      };
    }

    // Parse the config (simplified - would need proper AST parsing)
    const configStr = configMatch[1];
    const config = eval(`(${configStr})`) as ControlPanelConfig;

    // Migrate the config
    const { schema, uischema } = migrateControlPanel(config);

    // Generate the new file content
    const newContent = MIGRATION_TEMPLATE.replace(
      '{{IMPORTS}}',
      extractImports(content),
    )
      .replace('{{SCHEMA}}', JSON.stringify(schema, null, 2))
      .replace('{{UISCHEMA}}', JSON.stringify(uischema, null, 2))
      .replace('{{OVERRIDES}}', extractOverrides(config));

    // Write the new file
    const finalPath =
      outputPath || inputPath.replace(/\.tsx?$/, '.jsonforms.tsx');
    writeFileSync(finalPath, newContent);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract imports from the original file
 */
function extractImports(content: string): string {
  const imports: string[] = [];

  // Extract t import
  if (content.includes('import { t }')) {
    imports.push("import { t } from '@superset-ui/core';");
  }

  // Extract validation imports
  if (content.includes('validateNonEmpty')) {
    imports.push("import { validateNonEmpty } from '@superset-ui/core';");
  }

  return imports.join('\n');
}

/**
 * Extract overrides from the config
 */
function extractOverrides(config: ControlPanelConfig): string {
  const parts: string[] = [];

  if (config.controlOverrides) {
    parts.push(
      `controlOverrides: ${JSON.stringify(config.controlOverrides, null, 2)}`,
    );
  }

  if (config.onInit) {
    parts.push(`onInit: ${config.onInit.toString()}`);
  }

  if (config.formDataOverrides) {
    parts.push(`formDataOverrides: ${config.formDataOverrides.toString()}`);
  }

  return parts.join(',\n  ');
}

/**
 * Batch process multiple control panel files
 */
export function migrateAllControlPanels(
  files: string[],
  options: {
    dryRun?: boolean;
    outputDir?: string;
  } = {},
): {
  total: number;
  success: number;
  failed: string[];
} {
  const results = {
    total: files.length,
    success: 0,
    failed: [] as string[],
  };

  for (const file of files) {
    const outputPath = options.outputDir
      ? resolve(
          options.outputDir,
          file
            .split('/')
            .pop()!
            .replace(/\.tsx?$/, '.jsonforms.tsx'),
        )
      : undefined;

    if (options.dryRun) {
      console.log(
        `Would migrate: ${file} -> ${outputPath || file.replace(/\.tsx?$/, '.jsonforms.tsx')}`,
      );
      results.success++;
    } else {
      const result = processControlPanelFile(file, outputPath);
      if (result.success) {
        results.success++;
        console.log(`✅ Migrated: ${file}`);
      } else {
        results.failed.push(file);
        console.error(`❌ Failed: ${file} - ${result.error}`);
      }
    }
  }

  return results;
}
