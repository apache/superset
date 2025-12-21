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
 * This script generates database documentation data from the Python lib.py script.
 * It outputs a JSON file that can be imported by React components for rendering.
 *
 * Usage: node scripts/generate-database-docs.mjs
 *
 * The script can run in two modes:
 * 1. With Flask app (full diagnostics) - requires superset to be installed
 * 2. Fallback mode (documentation only) - uses just the DATABASE_DOCS from lib.py
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DOCS_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(DOCS_DIR, 'src/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'databases.json');
const LIB_PY_PATH = path.join(ROOT_DIR, 'superset/db_engine_specs/lib.py');

/**
 * Try to run the full lib.py script with Flask context
 */
function tryRunFullScript() {
  try {
    console.log('Attempting to run lib.py with Flask context...');
    const result = execSync(
      `cd ${ROOT_DIR} && SUPERSET_SECRET_KEY='docs-build-key' python -c "
import sys
import json
sys.path.insert(0, '.')
from superset.app import create_app
from superset.db_engine_specs.lib import generate_yaml_docs
app = create_app()
with app.app_context():
    docs = generate_yaml_docs()
    print(json.dumps(docs, default=str))
"`,
      {
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    return JSON.parse(result);
  } catch (error) {
    console.log('Full script execution failed, using fallback mode...');
    console.log('  Reason:', error.message?.split('\n')[0] || 'Unknown error');
    return null;
  }
}

/**
 * Extract DATABASE_DOCS from lib.py without running it
 * This is a fallback when the full script can't run
 */
function extractDatabaseDocs() {
  console.log('Extracting DATABASE_DOCS directly from lib.py...');

  try {
    const result = execSync(
      `cd ${ROOT_DIR} && python3 -c "
import sys
import json
import ast

# Read the lib.py file
with open('superset/db_engine_specs/lib.py', 'r') as f:
    content = f.read()

# Find DATABASE_DOCS assignment
tree = ast.parse(content)
database_docs = None

for node in ast.walk(tree):
    if isinstance(node, ast.Assign):
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == 'DATABASE_DOCS':
                # Execute just the DATABASE_DOCS portion
                exec(compile(ast.Expression(node.value), '<string>', 'eval'))
                break

# Re-execute to get the actual value
exec_globals = {}
exec('''
DATABASE_DOCS = ${extractDatabaseDocsCode()}
''', exec_globals)

print(json.dumps(exec_globals.get('DATABASE_DOCS', {}), default=str))
"`,
      {
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    return JSON.parse(result);
  } catch {
    // If AST extraction fails, try direct Python import of just DATABASE_DOCS
    return extractDatabaseDocsSimple();
  }
}

/**
 * Simple extraction - just import the DATABASE_DOCS dict
 */
function extractDatabaseDocsSimple() {
  console.log('Using simple extraction method...');

  try {
    const result = execSync(
      `cd ${ROOT_DIR} && python3 -c "
import sys
import json
sys.path.insert(0, '.')

# Import just the DATABASE_DOCS constant
from superset.db_engine_specs.lib import DATABASE_DOCS

# Build the output structure (without diagnose() features)
output = {}
for name, docs in DATABASE_DOCS.items():
    output[name] = {
        'engine': name.lower().replace(' ', '_'),
        'engine_name': name,
        'documentation': docs,
        # Placeholder values for diagnostics (not available without Flask)
        'time_grains': {},
        'score': 0,
        'max_score': 0,
        'joins': True,
        'subqueries': True,
        'supports_dynamic_schema': False,
        'supports_catalog': False,
    }

print(json.dumps(output, default=str))
"`,
      {
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    return JSON.parse(result);
  } catch (error) {
    console.error('Failed to extract DATABASE_DOCS:', error.message);
    return null;
  }
}

/**
 * Build statistics from the database data
 */
function buildStatistics(databases) {
  const stats = {
    totalDatabases: Object.keys(databases).length,
    withDocumentation: 0,
    withConnectionString: 0,
    withDrivers: 0,
    withAuthMethods: 0,
    supportsJoins: 0,
    supportsSubqueries: 0,
    supportsDynamicSchema: 0,
    supportsCatalog: 0,
    averageScore: 0,
    maxScore: 0,
    byCategory: {},
  };

  let totalScore = 0;

  for (const [name, db] of Object.entries(databases)) {
    const docs = db.documentation || {};

    if (Object.keys(docs).length > 0) stats.withDocumentation++;
    if (docs.connection_string || docs.drivers?.length > 0)
      stats.withConnectionString++;
    if (docs.drivers?.length > 0) stats.withDrivers++;
    if (docs.authentication_methods?.length > 0) stats.withAuthMethods++;
    if (db.joins) stats.supportsJoins++;
    if (db.subqueries) stats.supportsSubqueries++;
    if (db.supports_dynamic_schema) stats.supportsDynamicSchema++;
    if (db.supports_catalog) stats.supportsCatalog++;

    totalScore += db.score || 0;
    if (db.max_score > stats.maxScore) stats.maxScore = db.max_score;

    // Categorize databases
    const category = categorizeDatabase(name, docs);
    if (!stats.byCategory[category]) {
      stats.byCategory[category] = [];
    }
    stats.byCategory[category].push(name);
  }

  stats.averageScore = Math.round(totalScore / stats.totalDatabases);

  return stats;
}

/**
 * Categorize a database by its type
 */
function categorizeDatabase(name, docs) {
  const nameLower = name.toLowerCase();

  if (nameLower.includes('aws') || nameLower.includes('amazon'))
    return 'Cloud - AWS';
  if (nameLower.includes('google') || nameLower.includes('bigquery'))
    return 'Cloud - Google';
  if (nameLower.includes('azure') || nameLower.includes('microsoft'))
    return 'Cloud - Azure';
  if (nameLower.includes('snowflake') || nameLower.includes('databricks'))
    return 'Cloud Data Warehouses';
  if (
    nameLower.includes('apache') ||
    nameLower.includes('druid') ||
    nameLower.includes('hive') ||
    nameLower.includes('spark')
  )
    return 'Apache Projects';
  if (
    nameLower.includes('postgres') ||
    nameLower.includes('mysql') ||
    nameLower.includes('sqlite') ||
    nameLower.includes('mariadb')
  )
    return 'Traditional RDBMS';
  if (
    nameLower.includes('clickhouse') ||
    nameLower.includes('vertica') ||
    nameLower.includes('starrocks')
  )
    return 'Analytical Databases';
  if (
    nameLower.includes('elastic') ||
    nameLower.includes('solr') ||
    nameLower.includes('couchbase')
  )
    return 'Search & NoSQL';
  if (nameLower.includes('trino') || nameLower.includes('presto'))
    return 'Query Engines';

  return 'Other Databases';
}

/**
 * Main function
 */
async function main() {
  console.log('Generating database documentation data...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created directory: ${OUTPUT_DIR}\n`);
  }

  // Try to run the full script first, fall back to extraction
  let databases = tryRunFullScript();

  if (!databases) {
    databases = extractDatabaseDocsSimple();
  }

  if (!databases || Object.keys(databases).length === 0) {
    console.error('Failed to generate database documentation data.');
    console.error('Make sure superset is properly installed or lib.py is accessible.');
    process.exit(1);
  }

  console.log(`\nProcessed ${Object.keys(databases).length} databases`);

  // Build statistics
  const statistics = buildStatistics(databases);

  // Create the final output structure
  const output = {
    generated: new Date().toISOString(),
    statistics,
    databases,
  };

  // Write the JSON file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nGenerated: ${path.relative(DOCS_DIR, OUTPUT_FILE)}`);
  console.log(`\nStatistics:`);
  console.log(`  Total databases: ${statistics.totalDatabases}`);
  console.log(`  With documentation: ${statistics.withDocumentation}`);
  console.log(`  With connection strings: ${statistics.withConnectionString}`);
  console.log(`  With multiple drivers: ${statistics.withDrivers}`);
  console.log(`  With auth methods: ${statistics.withAuthMethods}`);
  console.log(`  Categories: ${Object.keys(statistics.byCategory).length}`);

  console.log('\nDone!');
}

main().catch(console.error);
