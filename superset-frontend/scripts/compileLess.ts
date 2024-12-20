/*
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
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { themeObject } from 'packages/superset-ui-core/src/theme';

// eslint-disable no-console
Handlebars.escapeExpression = (value: string) => value;
const { theme } = themeObject;

// Function to apply a template and generate the output
function applyTemplate(filePath: string): void {
  try {
    // Read the .less.hbs template
    const templateContent = fs.readFileSync(filePath, 'utf-8');

    // Compile the template
    const template = Handlebars.compile(templateContent, { noEscape: true });

    // Generate the final .less file
    const result = template({ theme });

    // Write the output to a .less file
    const outputFilePath = filePath.replace('.hbs', ''); // Remove .hbs for output
    fs.writeFileSync(outputFilePath, result, 'utf-8');
    console.log(`Themed .less file generated: ${outputFilePath}`);
  } catch (error) {
    console.error(`Failed to process template: ${filePath}`, error);
  }
}

function findHbsFiles(dir: string): string[] {
  const files = fs.readdirSync(dir);
  return files
    .map((file: string) => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        return findHbsFiles(fullPath);
      }
      if (fullPath.endsWith('.less.hbs')) {
        return fullPath;
      }
      return null;
    })
    .flat()
    .filter((filePath: string | null): filePath is string => filePath !== null);
}

// Find all `.less.hbs` files in the directory
const hbsFiles = findHbsFiles('src/assets/stylesheets/');

// Apply templates to all `.less.hbs` files found
hbsFiles.forEach((filePath: string) => applyTemplate(filePath));
