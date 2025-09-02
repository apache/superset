#!/usr/bin/env node
/* eslint-disable no-param-reassign, no-plusplus, no-restricted-syntax */
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
 * Normalize OpenAPI spec for orval compatibility
 *
 * Converts Flask-AppBuilder anyOf patterns that orval can't handle
 * into oneOf patterns that work properly.
 *
 * Usage: node scripts/normalize-openapi.js input.json output.json
 */

const fs = require('fs');

const isRef = s => !!s && typeof s === 'object' && '$ref' in s;
const asSchema = s =>
  s && typeof s === 'object' && !('$ref' in s) ? s : undefined;

/**
 * Transforms anyOf patterns that orval can't handle into oneOf patterns.
 * Converts Flask-AppBuilder Union[T, list[T]] anyOf schemas into orval-friendly oneOf.
 */
function normalizeOneOrMany(doc) {
  console.log('🔧 Normalizing OpenAPI spec for orval compatibility...');
  let fixCount = 0;

  const visitSchema = sch => {
    if (!sch || isRef(sch)) return;

    // Fix bare arrays missing items (common Flask-AppBuilder issue)
    if (sch.type === 'array' && !sch.items) {
      console.log('🔧 Fixing bare array without items');
      sch.items = { type: 'string' }; // Default to string items
      fixCount++;
    }

    // Recurse into nested properties/arrays
    if (sch.properties) {
      Object.values(sch.properties).forEach(visitSchema);
    }
    if (sch.items) visitSchema(sch.items);
    if (sch.allOf) sch.allOf.forEach(visitSchema);
    if (sch.oneOf) sch.oneOf.forEach(visitSchema);

    if (sch.anyOf && Array.isArray(sch.anyOf)) {
      const { anyOf } = sch;
      const arrayBranches = anyOf.filter(a => asSchema(a)?.type === 'array');
      const nonArray = anyOf.find(a => asSchema(a)?.type !== 'array');

      // Detect the exact bad case: an array branch without items
      const hasBareArray = arrayBranches.some(a => {
        const s = asSchema(a);
        return s && s.type === 'array' && s.items == null;
      });

      if (nonArray && hasBareArray) {
        console.log(
          `🔧 Fixing anyOf pattern with ${arrayBranches.length} array branches`,
        );
        fixCount++;

        // Replace with oneOf: [ nonArray, array(nonArray) ]
        const itemSchema = isRef(nonArray) ? nonArray : { ...nonArray };

        sch.oneOf = [
          nonArray,
          {
            type: 'array',
            items: isRef(itemSchema) ? itemSchema : { ...itemSchema },
          },
        ];
        delete sch.anyOf;
      }
    }
  };

  // Walk component schemas
  const componentSchemas = doc.components?.schemas ?? {};
  Object.values(componentSchemas).forEach(visitSchema);

  // Also walk paths (in case inline anyOfs live there)
  for (const path of Object.values(doc.paths ?? {})) {
    for (const op of Object.values(path ?? {})) {
      const operation = op;
      operation?.parameters?.forEach(p => visitSchema(p.schema));
      const bodySchema =
        operation?.requestBody?.content?.['application/json']?.schema;
      visitSchema(bodySchema);
      const resp = operation?.responses;
      if (resp) {
        for (const r of Object.values(resp)) {
          const s = r?.content?.['application/json']?.schema;
          visitSchema(s);
        }
      }
    }
  }

  // Fix invalid TypeScript identifiers (numbers can't start names)
  const schemas = componentSchemas;
  const responses = doc.components?.responses ?? {};
  const toRename = [];

  // Check both schemas and responses for numeric names
  for (const name of [...Object.keys(schemas), ...Object.keys(responses)]) {
    if (/^\d/.test(name)) {
      // Names starting with numbers are invalid TypeScript identifiers
      toRename.push({ oldName: name, newName: `N${name}Response` });
    }
  }

  if (toRename.length > 0) {
    console.log(`🔧 Fixing ${toRename.length} invalid TypeScript names`);
    toRename.forEach(({ oldName, newName }) => {
      console.log(`  ${oldName} → ${newName}`);

      // Rename in schemas if it exists
      if (schemas[oldName]) {
        schemas[newName] = schemas[oldName];
        delete schemas[oldName];
      }

      // Rename in responses if it exists
      if (responses[oldName]) {
        responses[newName] = responses[oldName];
        delete responses[oldName];
      }

      fixCount++;
    });

    // Also fix any $ref references to the renamed items
    const updateRefs = obj => {
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (key === '$ref' && typeof value === 'string') {
            toRename.forEach(({ oldName, newName }) => {
              // Fix both schema and response references
              if (value.includes(`/schemas/${oldName}`)) {
                obj[key] = value.replace(
                  `/schemas/${oldName}`,
                  `/schemas/${newName}`,
                );
              }
              if (value.includes(`/responses/${oldName}`)) {
                obj[key] = value.replace(
                  `/responses/${oldName}`,
                  `/responses/${newName}`,
                );
              }
            });
          } else if (typeof value === 'object') {
            updateRefs(value);
          }
        }
      }
    };
    updateRefs(doc);
  }

  // Filter to Charts endpoints for POC (tags filtering didn't work)
  const chartsPaths = {};
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    if (path.includes('/chart')) {
      chartsPaths[path] = methods;
    }
  }

  if (Object.keys(chartsPaths).length > 0) {
    console.log(
      `🎯 Filtering to Charts endpoints: ${Object.keys(chartsPaths).length} paths`,
    );
    doc.paths = chartsPaths;
    fixCount++;
  }

  // Handle known orval duplicate issues
  const allSchemas = doc.components?.schemas ?? {};

  // Rename potentially problematic schema to avoid orval conflicts
  if (allSchemas.GetFavStarIdsSchema) {
    console.log(
      '🔧 Renaming GetFavStarIdsSchema to avoid orval duplicate detection',
    );
    allSchemas.FavoriteIdsSchema = allSchemas.GetFavStarIdsSchema;
    delete allSchemas.GetFavStarIdsSchema;

    // Update all references
    const updateRefs = obj => {
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (
            key === '$ref' &&
            typeof value === 'string' &&
            value.includes('GetFavStarIdsSchema')
          ) {
            obj[key] = value.replace(
              'GetFavStarIdsSchema',
              'FavoriteIdsSchema',
            );
          } else if (typeof value === 'object') {
            updateRefs(value);
          }
        }
      }
    };
    updateRefs(doc);
    fixCount++;
  }

  console.log(`✅ Normalization complete: ${fixCount} issues fixed`);
  return doc;
}

// Main script
const [, , inputFile, outputFile] = process.argv;

if (!inputFile || !outputFile) {
  console.error('Usage: node normalize-openapi.js <input.json> <output.json>');
  process.exit(1);
}

try {
  console.log(`📖 Reading ${inputFile}...`);
  const spec = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  const normalizedSpec = normalizeOneOrMany(spec);

  console.log(`💾 Writing normalized spec to ${outputFile}...`);
  fs.writeFileSync(outputFile, JSON.stringify(normalizedSpec, null, 2));

  console.log('🎉 OpenAPI normalization successful!');
} catch (error) {
  console.error('❌ Error normalizing OpenAPI spec:', error.message);
  process.exit(1);
}
