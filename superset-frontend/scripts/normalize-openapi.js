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

/**
 * Normalize OpenAPI spec for orval compatibility
 * 
 * Converts Flask-AppBuilder anyOf patterns that orval can't handle
 * into oneOf patterns that work properly.
 * 
 * Usage: node scripts/normalize-openapi.js input.json output.json
 */

const fs = require('fs');
const path = require('path');

const isRef = (s) => !!s && typeof s === 'object' && '$ref' in s;
const asSchema = (s) => s && typeof s === 'object' && !('$ref' in s) ? s : undefined;

/**
 * Transforms anyOf patterns that orval can't handle into oneOf patterns.
 * Converts Flask-AppBuilder Union[T, list[T]] anyOf schemas into orval-friendly oneOf.
 */
function normalizeOneOrMany(doc) {
  console.log('🔧 Normalizing OpenAPI spec for orval compatibility...');
  let fixCount = 0;
  
  const visitSchema = (sch) => {
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
      const anyOf = sch.anyOf;
      const arrayBranches = anyOf.filter(a => asSchema(a)?.type === 'array');
      const nonArray = anyOf.find(a => asSchema(a)?.type !== 'array');

      // Detect the exact bad case: an array branch without items
      const hasBareArray = arrayBranches.some(a => {
        const s = asSchema(a);
        return s && s.type === 'array' && s.items == null;
      });

      if (nonArray && hasBareArray) {
        console.log(`🔧 Fixing anyOf pattern with ${arrayBranches.length} array branches`);
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
      operation?.parameters?.forEach((p) => visitSchema(p.schema));
      const bodySchema = operation?.requestBody?.content?.['application/json']?.schema;
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

  // Fix duplicate schema names by renaming
  const schemas = componentSchemas;
  const nameCount = {};
  const toRename = [];
  
  for (const name of Object.keys(schemas)) {
    nameCount[name] = (nameCount[name] || 0) + 1;
    if (nameCount[name] > 1) {
      toRename.push({ oldName: name, newName: `${name}_${nameCount[name]}` });
    }
  }
  
  if (toRename.length > 0) {
    console.log(`🔧 Fixing ${toRename.length} duplicate schema names`);
    toRename.forEach(({ oldName, newName }) => {
      console.log(`  ${oldName} → ${newName}`);
      schemas[newName] = schemas[oldName];
      delete schemas[oldName];
      fixCount++;
    });
  }

  // Filter to only Charts endpoints for POC
  const chartsPaths = {};
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    if (path.includes('/chart')) {
      chartsPaths[path] = methods;
    }
  }
  
  if (Object.keys(chartsPaths).length > 0) {
    console.log(`🎯 Filtering to Charts endpoints only: ${Object.keys(chartsPaths).length} paths`);
    doc.paths = chartsPaths;
    fixCount++;
  }

  console.log(`✅ Normalization complete: ${fixCount} issues fixed`);
  return doc;
}

// Main script
const [,, inputFile, outputFile] = process.argv;

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