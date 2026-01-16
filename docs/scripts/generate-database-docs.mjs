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
 * This script generates database documentation data from engine spec metadata.
 * It outputs a JSON file that can be imported by React components for rendering.
 *
 * Usage: node scripts/generate-database-docs.mjs
 *
 * The script can run in two modes:
 * 1. With Flask app (full diagnostics) - requires superset to be installed
 * 2. Fallback mode (documentation only) - parses engine spec `metadata` attributes via AST
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const DOCS_DIR = path.resolve(__dirname, '..');
const DATA_OUTPUT_DIR = path.join(DOCS_DIR, 'src/data');
const DATA_OUTPUT_FILE = path.join(DATA_OUTPUT_DIR, 'databases.json');
const MDX_OUTPUT_DIR = path.join(DOCS_DIR, 'docs/databases');

/**
 * Try to run the full lib.py script with Flask context
 */
function tryRunFullScript() {
  try {
    console.log('Attempting to run lib.py with Flask context...');
    const pythonCode = `
import sys
import json
sys.path.insert(0, '.')
from superset.app import create_app
from superset.db_engine_specs.lib import generate_yaml_docs
app = create_app()
with app.app_context():
    docs = generate_yaml_docs()
    print(json.dumps(docs, default=str))
`;
    const result = spawnSync('python', ['-c', pythonCode], {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, SUPERSET_SECRET_KEY: 'docs-build-key' },
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(result.stderr || 'Python script failed');
    }
    return JSON.parse(result.stdout);
  } catch (error) {
    console.log('Full script execution failed, using fallback mode...');
    console.log('  Reason:', error.message?.split('\n')[0] || 'Unknown error');
    return null;
  }
}

/**
 * Extract metadata from individual engine spec files using AST parsing
 * This is the preferred approach - reads directly from spec.metadata attributes
 */
function extractEngineSpecMetadata() {
  console.log('Extracting metadata from engine spec files...');

  try {
    const pythonCode = `
import sys
import json
import ast
import os

def eval_node(node):
    """Safely evaluate an AST node as a Python literal."""
    if node is None:
        return None
    if isinstance(node, ast.Constant):
        return node.value
    elif isinstance(node, ast.Str):  # Python 3.7
        return node.s
    elif isinstance(node, ast.Num):  # Python 3.7
        return node.n
    elif isinstance(node, ast.List):
        return [eval_node(e) for e in node.elts]
    elif isinstance(node, ast.Dict):
        result = {}
        for k, v in zip(node.keys, node.values):
            if k is not None:
                key = eval_node(k)
                if key is not None:
                    result[key] = eval_node(v)
        return result
    elif isinstance(node, ast.Name):
        # Handle True, False, None constants
        if node.id == 'True':
            return True
        elif node.id == 'False':
            return False
        elif node.id == 'None':
            return None
        return node.id
    elif isinstance(node, ast.Attribute):
        # Handle DatabaseCategory.SOMETHING - return just the attribute name
        return node.attr
    elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left, right = eval_node(node.left), eval_node(node.right)
        if isinstance(left, str) and isinstance(right, str):
            return left + right
        return None
    elif isinstance(node, ast.Tuple):
        return tuple(eval_node(e) for e in node.elts)
    elif isinstance(node, ast.JoinedStr):
        # f-strings - just return a placeholder
        return "<f-string>"
    return None

databases = {}
specs_dir = 'superset/db_engine_specs'
errors = []

if not os.path.isdir(specs_dir):
    print(json.dumps({"error": f"Directory not found: {specs_dir}"}))
    sys.exit(1)

for filename in sorted(os.listdir(specs_dir)):
    if not filename.endswith('.py') or filename in ('__init__.py', 'base.py', 'lib.py', 'lint_metadata.py'):
        continue

    filepath = os.path.join(specs_dir, filename)
    try:
        with open(filepath) as f:
            source = f.read()
        tree = ast.parse(source)

        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue

            # Check if it's an engine spec class by looking at base class names
            base_names = []
            for b in node.bases:
                if isinstance(b, ast.Name):
                    base_names.append(b.id)
                elif isinstance(b, ast.Attribute):
                    base_names.append(b.attr)

            is_engine_spec = any('EngineSpec' in name or 'Mixin' in name for name in base_names)
            if not is_engine_spec:
                continue

            # Skip base classes and mixins
            if node.name.endswith('BaseEngineSpec') or 'Mixin' in node.name:
                continue

            engine_name = None
            metadata = None

            for item in node.body:
                if isinstance(item, ast.Assign):
                    for target in item.targets:
                        if isinstance(target, ast.Name):
                            if target.id == 'engine_name':
                                val = eval_node(item.value)
                                if isinstance(val, str):
                                    engine_name = val
                            elif target.id == 'metadata':
                                metadata = eval_node(item.value)

            # Use class name as fallback for engine_name
            display_name = engine_name or node.name.replace('EngineSpec', '').replace('_', ' ')

            if metadata and isinstance(metadata, dict) and display_name:
                databases[display_name] = {
                    'engine': display_name.lower().replace(' ', '_'),
                    'engine_name': display_name,
                    'documentation': metadata,
                    'time_grains': {},
                    'score': 0,
                    'max_score': 0,
                    'joins': True,
                    'subqueries': True,
                    'supports_dynamic_schema': False,
                    'supports_catalog': False,
                    'supports_dynamic_catalog': False,
                    'ssh_tunneling': False,
                    'query_cancelation': False,
                    'supports_file_upload': False,
                    'user_impersonation': False,
                    'query_cost_estimation': False,
                    'sql_validation': False,
                }
    except Exception as e:
        errors.append(f"{filename}: {str(e)}")

if errors and not databases:
    print(json.dumps({"error": "Parse errors", "details": errors}), file=sys.stderr)

print(json.dumps(databases, default=str))
`;
    const result = spawnSync('python3', ['-c', pythonCode], {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(result.stderr || 'Python script failed');
    }
    const databases = JSON.parse(result.stdout);
    if (Object.keys(databases).length === 0) {
      throw new Error('No metadata found in engine specs');
    }

    console.log(`Extracted metadata from ${Object.keys(databases).length} engine specs`);
    return databases;
  } catch (err) {
    console.log('Engine spec metadata extraction failed:', err.message);
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

    // Use category from documentation metadata (computed by Python)
    // This eliminates the need for duplicate categorization logic in JS
    const category = docs.category || 'Other Databases';
    if (!stats.byCategory[category]) {
      stats.byCategory[category] = [];
    }
    stats.byCategory[category].push(name);
  }

  stats.averageScore = Math.round(totalScore / stats.totalDatabases);

  return stats;
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
function generateDatabaseMDX(name, db) {
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

To add or update database documentation, add a \`metadata\` attribute to your engine spec class in
\`superset/db_engine_specs/\`. Documentation is auto-generated from these metadata attributes.

See [METADATA_STATUS.md](https://github.com/apache/superset/blob/master/superset/db_engine_specs/METADATA_STATUS.md)
for the current status of database documentation and the [README](https://github.com/apache/superset/blob/master/superset/db_engine_specs/README.md) for the metadata schema.
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
    return `  <img src="https://superset.apache.org/img/databases/${logo}" alt="${alt}" border="0" width="120" height="60" class="database-logo" />`;
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

  // Try sources in order of preference:
  // 1. Full script with Flask context (richest data with diagnostics)
  // 2. Engine spec metadata files (works in CI without Flask)
  let databases = tryRunFullScript();

  if (!databases) {
    // Extract from engine spec metadata (preferred for CI)
    databases = extractEngineSpecMetadata();
  }

  if (!databases || Object.keys(databases).length === 0) {
    console.error('Failed to generate database documentation data.');
    console.error('Could not extract from Flask app or engine spec metadata.');
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
    const mdxContent = generateDatabaseMDX(name, db);
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
