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
const DATA_OUTPUT_DIR = path.join(DOCS_DIR, 'src/data');
const DATA_OUTPUT_FILE = path.join(DATA_OUTPUT_DIR, 'databases.json');
const MDX_OUTPUT_DIR = path.join(DOCS_DIR, 'docs/databases');
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
 * Simple extraction - import DATABASE_DOCS and try to get diagnostics
 * This version attempts to load engine specs individually, skipping failures
 */
function extractDatabaseDocsSimple() {
  console.log('Using simple extraction method...');

  try {
    const result = execSync(
      `cd ${ROOT_DIR} && python3 -c "
import sys
import json
import importlib
import pkgutil
import warnings
sys.path.insert(0, '.')
warnings.filterwarnings('ignore')

# Import just the DATABASE_DOCS constant
from superset.db_engine_specs.lib import DATABASE_DOCS, diagnose, get_name

# Try to load engine specs individually, skipping failures
loaded_specs = {}
failed_imports = []

import superset.db_engine_specs as specs_package
for importer, modname, ispkg in pkgutil.iter_modules(specs_package.__path__):
    if modname in ('base', 'lib', '__init__'):
        continue
    try:
        module = importlib.import_module(f'superset.db_engine_specs.{modname}')
        for attr_name in dir(module):
            attr = getattr(module, attr_name)
            if (isinstance(attr, type) and
                hasattr(attr, 'engine') and
                hasattr(attr, '__module__') and
                attr.__module__.startswith('superset.db_engine_specs')):
                try:
                    name = get_name(attr)
                    if name and name not in loaded_specs:
                        loaded_specs[name] = attr
                except:
                    pass
    except Exception as e:
        failed_imports.append(modname)

# Build output with diagnostics where available
output = {}
for name, docs in DATABASE_DOCS.items():
    spec = loaded_specs.get(name)
    if spec:
        try:
            diag = diagnose(spec)
            output[name] = {
                'engine': getattr(spec, 'engine', name.lower().replace(' ', '_')),
                'engine_name': name,
                'documentation': docs,
                'time_grains': diag.get('time_grains', {}),
                'score': diag.get('score', 0),
                'max_score': diag.get('max_score', 0),
                'joins': diag.get('joins', True),
                'subqueries': diag.get('subqueries', True),
                'supports_dynamic_schema': diag.get('supports_dynamic_schema', False),
                'supports_catalog': diag.get('supports_catalog', False),
                'supports_dynamic_catalog': diag.get('supports_dynamic_catalog', False),
                'ssh_tunneling': diag.get('ssh_tunneling', False),
                'query_cancelation': diag.get('query_cancelation', False),
                'supports_file_upload': diag.get('supports_file_upload', False),
                'user_impersonation': diag.get('user_impersonation', False),
                'query_cost_estimation': diag.get('query_cost_estimation', False),
                'sql_validation': diag.get('sql_validation', False),
            }
        except Exception as e:
            # Fallback for this specific database
            output[name] = {
                'engine': name.lower().replace(' ', '_'),
                'engine_name': name,
                'documentation': docs,
                'time_grains': {},
                'score': 0,
                'max_score': 0,
                'joins': True,
                'subqueries': True,
                'supports_dynamic_schema': False,
                'supports_catalog': False,
            }
    else:
        # No spec found, use placeholder
        output[name] = {
            'engine': name.lower().replace(' ', '_'),
            'engine_name': name,
            'documentation': docs,
            'time_grains': {},
            'score': 0,
            'max_score': 0,
            'joins': True,
            'subqueries': True,
            'supports_dynamic_schema': False,
            'supports_catalog': False,
        }

print(json.dumps({'databases': output, 'loaded': len(loaded_specs), 'failed': failed_imports}, default=str))
"`,
      {
        encoding: 'utf-8',
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      }
    );
    const data = JSON.parse(result);
    console.log(`Loaded ${data.loaded} engine specs (failed: ${data.failed.join(', ') || 'none'})`);
    return data.databases;
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
 * Convert database name to a URL-friendly slug
 */
function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate MDX content for a single database page
 */
function generateDatabaseMDX(name, db, slug) {
  const description = db.documentation?.description || `Documentation for ${name} database connection.`;
  const shortDesc = description
    .slice(0, 160)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

  return `---
title: ${name}
sidebar_label: ${name}
description: "${shortDesc}"
hide_title: true
---

{/*
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
*/}

import { DatabasePage } from '@site/src/components/databases';
import databaseData from '@site/src/data/databases.json';

<DatabasePage name="${name}" database={databaseData.databases["${name}"]} />
`;
}

/**
 * Generate the index MDX for the databases overview
 */
function generateIndexMDX(statistics) {
  return `---
title: Connecting to Databases
sidebar_label: Overview
sidebar_position: 1
---

{/*
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
*/}

import { DatabaseIndex } from '@site/src/components/databases';
import databaseData from '@site/src/data/databases.json';

# Connecting to Databases

Superset does not ship bundled with connectivity to databases. The main step in connecting
Superset to a database is to **install the proper database driver(s)** in your environment.

:::note
You'll need to install the required packages for the database you want to use as your metadata database
as well as the packages needed to connect to the databases you want to access through Superset.
For information about setting up Superset's metadata database, please refer to
installation documentations ([Docker Compose](/docs/installation/docker-compose), [Kubernetes](/docs/installation/kubernetes))
:::

## Supported Databases

Superset supports **${statistics.totalDatabases} databases** with varying levels of feature support.
Click on any database name to see detailed documentation including connection strings,
authentication methods, and configuration options.

<DatabaseIndex data={databaseData} />

## Installing Database Drivers

Superset requires a Python [DB-API database driver](https://peps.python.org/pep-0249/)
and a [SQLAlchemy dialect](https://docs.sqlalchemy.org/en/20/dialects/) to be installed for
each database engine you want to connect to.

### Installing Drivers in Docker

For Docker deployments, create a \`requirements-local.txt\` file in the \`docker\` directory:

\`\`\`bash
# Create the requirements file
touch ./docker/requirements-local.txt

# Add your driver (e.g., for PostgreSQL)
echo "psycopg2-binary" >> ./docker/requirements-local.txt
\`\`\`

Then restart your containers. The drivers will be installed automatically.

### Installing Drivers with pip

For non-Docker installations:

\`\`\`bash
pip install <driver-package>
\`\`\`

See individual database pages for the specific driver packages needed.

## Connecting Through the UI

1. Go to **Settings → Data: Database Connections**
2. Click **+ DATABASE**
3. Select your database type or enter a SQLAlchemy URI
4. Click **Test Connection** to verify
5. Click **Connect** to save

## Contributing

To add or update database documentation, edit the \`DATABASE_DOCS\` dictionary in
\`superset/db_engine_specs/lib.py\`. Documentation pages are auto-generated from this data.
`;
}

const README_PATH = path.join(ROOT_DIR, 'README.md');
const README_START_MARKER = '<!-- SUPPORTED_DATABASES_START -->';
const README_END_MARKER = '<!-- SUPPORTED_DATABASES_END -->';

/**
 * Generate the database logos HTML for README.md
 * Only includes databases that have logos defined
 */
function generateReadmeLogos(databases) {
  // Get databases with logos, sorted alphabetically
  const dbsWithLogos = Object.entries(databases)
    .filter(([, db]) => db.documentation?.logo)
    .sort(([a], [b]) => a.localeCompare(b));

  if (dbsWithLogos.length === 0) {
    return '';
  }

  // Generate HTML img tags
  const logoTags = dbsWithLogos.map(([name, db]) => {
    const logo = db.documentation.logo;
    const alt = name.toLowerCase().replace(/\s+/g, '-');
    // Use docs site URL for logos
    return `  <img src="https://superset.apache.org/img/databases/${logo}" alt="${alt}" border="0" width="120" height="60" style="object-fit: contain;" />`;
  });

  return `<p align="center">
${logoTags.join('\n')}
</p>`;
}

/**
 * Update the README.md with generated database logos
 */
function updateReadme(databases) {
  if (!fs.existsSync(README_PATH)) {
    console.log('README.md not found, skipping update');
    return false;
  }

  const content = fs.readFileSync(README_PATH, 'utf-8');

  // Check if markers exist
  if (!content.includes(README_START_MARKER) || !content.includes(README_END_MARKER)) {
    console.log('README.md missing database markers, skipping update');
    console.log(`  Add ${README_START_MARKER} and ${README_END_MARKER} to enable auto-generation`);
    return false;
  }

  // Generate new logos section
  const logosHtml = generateReadmeLogos(databases);

  // Replace content between markers
  const pattern = new RegExp(
    `${README_START_MARKER}[\\s\\S]*?${README_END_MARKER}`,
    'g'
  );
  const newContent = content.replace(
    pattern,
    `${README_START_MARKER}\n${logosHtml}\n${README_END_MARKER}`
  );

  if (newContent !== content) {
    fs.writeFileSync(README_PATH, newContent);
    console.log('Updated README.md database logos');
    return true;
  }

  console.log('README.md database logos unchanged');
  return false;
}

/**
 * Load existing database data if available
 */
function loadExistingData() {
  if (!fs.existsSync(DATA_OUTPUT_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(DATA_OUTPUT_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.log('Could not load existing data:', error.message);
    return null;
  }
}

/**
 * Merge new documentation with existing diagnostics
 * Preserves score, time_grains, and feature flags from existing data
 */
function mergeWithExistingDiagnostics(newDatabases, existingData) {
  if (!existingData?.databases) return newDatabases;

  const diagnosticFields = [
    'score', 'max_score', 'time_grains', 'joins', 'subqueries',
    'supports_dynamic_schema', 'supports_catalog', 'supports_dynamic_catalog',
    'ssh_tunneling', 'query_cancelation', 'supports_file_upload',
    'user_impersonation', 'query_cost_estimation', 'sql_validation'
  ];

  for (const [name, db] of Object.entries(newDatabases)) {
    const existingDb = existingData.databases[name];
    if (existingDb && existingDb.score > 0) {
      // Preserve diagnostics from existing data
      for (const field of diagnosticFields) {
        if (existingDb[field] !== undefined) {
          db[field] = existingDb[field];
        }
      }
    }
  }

  const preserved = Object.values(newDatabases).filter(d => d.score > 0).length;
  if (preserved > 0) {
    console.log(`Preserved diagnostics for ${preserved} databases from existing data`);
  }

  return newDatabases;
}

/**
 * Main function
 */
async function main() {
  console.log('Generating database documentation...\n');

  // Ensure output directories exist
  if (!fs.existsSync(DATA_OUTPUT_DIR)) {
    fs.mkdirSync(DATA_OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(MDX_OUTPUT_DIR)) {
    fs.mkdirSync(MDX_OUTPUT_DIR, { recursive: true });
  }

  // Load existing data for potential merge
  const existingData = loadExistingData();

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

  console.log(`Processed ${Object.keys(databases).length} databases\n`);

  // Check if new data has scores; if not, preserve existing diagnostics
  const hasNewScores = Object.values(databases).some((db) => db.score > 0);
  if (!hasNewScores && existingData) {
    databases = mergeWithExistingDiagnostics(databases, existingData);
  }

  // Build statistics
  const statistics = buildStatistics(databases);

  // Create the final output structure
  const output = {
    generated: new Date().toISOString(),
    statistics,
    databases,
  };

  // Write the JSON file
  fs.writeFileSync(DATA_OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Generated: ${path.relative(DOCS_DIR, DATA_OUTPUT_FILE)}`);


  // Clean up old MDX files that are no longer in the database list
  console.log(`\nCleaning up old MDX files in ${path.relative(DOCS_DIR, MDX_OUTPUT_DIR)}/`);
  const existingMdxFiles = fs.readdirSync(MDX_OUTPUT_DIR).filter(f => f.endsWith('.mdx') && f !== 'index.mdx');
  const validSlugs = new Set(Object.keys(databases).map(name => `${toSlug(name)}.mdx`));
  let removedCount = 0;
  for (const file of existingMdxFiles) {
    if (!validSlugs.has(file)) {
      fs.unlinkSync(path.join(MDX_OUTPUT_DIR, file));
      removedCount++;
    }
  }
  if (removedCount > 0) {
    console.log(`  Removed ${removedCount} outdated MDX files`);
  }

  // Generate individual MDX files for each database
  console.log(`\nGenerating MDX files in ${path.relative(DOCS_DIR, MDX_OUTPUT_DIR)}/`);

  let mdxCount = 0;
  for (const [name, db] of Object.entries(databases)) {
    const slug = toSlug(name);
    const mdxContent = generateDatabaseMDX(name, db, slug);
    const mdxPath = path.join(MDX_OUTPUT_DIR, `${slug}.mdx`);
    fs.writeFileSync(mdxPath, mdxContent);
    mdxCount++;
  }
  console.log(`  Generated ${mdxCount} database pages`);

  // Generate index page
  const indexContent = generateIndexMDX(statistics);
  const indexPath = path.join(MDX_OUTPUT_DIR, 'index.mdx');
  fs.writeFileSync(indexPath, indexContent);
  console.log(`  Generated index page`);

  // Generate _category_.json for sidebar ordering
  const categoryJson = {
    label: 'Databases',
    position: 1,
    link: {
      type: 'doc',
      id: 'databases/index',
    },
  };
  fs.writeFileSync(
    path.join(MDX_OUTPUT_DIR, '_category_.json'),
    JSON.stringify(categoryJson, null, 2)
  );
  console.log(`  Generated _category_.json`);

  // Update README.md database logos (only when explicitly requested)
  if (process.env.UPDATE_README === 'true' || process.argv.includes('--update-readme')) {
    console.log('');
    updateReadme(databases);
  }

  console.log(`\nStatistics:`);
  console.log(`  Total databases: ${statistics.totalDatabases}`);
  console.log(`  With documentation: ${statistics.withDocumentation}`);
  console.log(`  With connection strings: ${statistics.withConnectionString}`);
  console.log(`  Categories: ${Object.keys(statistics.byCategory).length}`);

  console.log('\nDone!');
}

main().catch(console.error);
