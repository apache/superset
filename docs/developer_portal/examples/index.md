---
title: Extension Examples
sidebar_position: 1
hide_title: true
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

# Extension Examples

Learn from real-world extension implementations that showcase different capabilities of the Superset extension system.

## Dataset References Panel

A SQL Lab panel that analyzes queries and displays information about referenced tables.

### Features
- Parses SQL to extract table references
- Shows table owners and permissions
- Displays last partition information
- Provides row count estimates

### Key Implementation

```typescript
// Parse SQL and extract tables
function extractTables(sql: string): TableReference[] {
  const tables = [];
  const tableRegex = /FROM\s+(\w+\.?\w+)/gi;
  let match;

  while ((match = tableRegex.exec(sql)) !== null) {
    tables.push({
      schema: match[1].split('.')[0],
      table: match[1].split('.')[1] || match[1],
    });
  }

  return tables;
}

// Register panel
export function activate(context: ExtensionContext) {
  const panel = context.core.registerView('dataset-references.panel', () => (
    <DatasetReferencesPanel />
  ));

  // Listen for query changes
  const listener = context.sqlLab.onDidChangeEditorContent((content) => {
    const tables = extractTables(content);
    updatePanelWithTables(tables);
  });

  context.subscriptions.push(panel, listener);
}
```

### Manifest

```json
{
  "name": "dataset-references",
  "contributions": {
    "views": {
      "sqllab.panels": [{
        "id": "dataset-references.panel",
        "name": "Dataset References",
        "icon": "DatabaseOutlined",
        "location": "right"
      }]
    }
  }
}
```

## Query Optimizer

Analyzes SQL queries and suggests optimizations.

### Features
- Detects missing indexes
- Suggests query rewrites
- Identifies expensive operations
- Provides execution plan analysis

### Implementation Highlights

```typescript
// Register optimization command
const optimizeCommand = context.commands.registerCommand('query-optimizer.analyze', {
  title: 'Analyze Query Performance',
  icon: 'ThunderboltOutlined',
  execute: async () => {
    const query = context.sqlLab.getCurrentQuery();
    const database = context.sqlLab.getCurrentDatabase();

    // Get execution plan
    const plan = await getExecutionPlan(database.id, query);

    // Analyze and suggest improvements
    const suggestions = analyzeExecutionPlan(plan);

    // Show results in panel
    showOptimizationResults(suggestions);
  }
});

// Add to editor menu
"menus": {
  "sqllab.editor": {
    "primary": [{
      "command": "query-optimizer.analyze",
      "when": "editorHasContent"
    }]
  }
}
```

## Natural Language to SQL

Converts natural language questions to SQL queries using LLM integration.

### Features
- Natural language input
- Context-aware SQL generation
- Query validation
- History tracking

### Key Components

```typescript
// Backend API endpoint
@rest_api.route('/nl2sql/generate')
def generate_sql(prompt: str, context: dict):
    # Use LLM to generate SQL
    sql = llm_client.generate(
        prompt=prompt,
        schema=context['schema'],
        examples=context['examples']
    )

    # Validate generated SQL
    validation = validate_sql(sql)

    return {
        'sql': sql,
        'valid': validation.is_valid,
        'errors': validation.errors
    }
```

```typescript
// Frontend integration
function NL2SQLPanel() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const generateSQL = async () => {
    setLoading(true);

    const response = await context.network.api.post('/extensions/nl2sql/generate', {
      prompt,
      context: {
        database: context.sqlLab.getCurrentDatabase(),
        schema: await context.sqlLab.getCurrentSchema(),
      }
    });

    if (response.valid) {
      // Insert SQL into editor
      context.sqlLab.insertText(response.sql);
    }

    setLoading(false);
  };

  return (
    <div>
      <Input.TextArea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe what data you want..."
      />
      <Button onClick={generateSQL} loading={loading}>
        Generate SQL
      </Button>
    </div>
  );
}
```

## Schema Visualizer

Interactive database schema visualization.

### Features
- Visual ERD diagram
- Table relationships
- Column details on hover
- Export to image

### Implementation

```typescript
import { Graph } from '@antv/g6';

function SchemaVisualizer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<Graph>();

  useEffect(() => {
    if (!containerRef.current) return;

    const g = new Graph({
      container: containerRef.current,
      layout: {
        type: 'dagre',
        rankdir: 'LR',
      },
      defaultNode: {
        type: 'sql-table-node',
      },
      defaultEdge: {
        type: 'sql-relation-edge',
      },
    });

    setGraph(g);
    loadSchemaData(g);

    return () => g.destroy();
  }, []);

  const loadSchemaData = async (g: Graph) => {
    const tables = await context.sqlLab.getTables();
    const nodes = tables.map(table => ({
      id: table.name,
      label: table.name,
      columns: table.columns,
    }));

    const edges = extractRelationships(tables);

    g.data({ nodes, edges });
    g.render();
  };

  return <div ref={containerRef} style={{ height: '100%' }} />;
}
```

## SQL Formatter

Formats and beautifies SQL code with customizable rules.

### Features
- Multiple formatting styles
- Custom rule configuration
- Batch formatting
- Format on save

### Simple Implementation

```typescript
import { format } from 'sql-formatter';

const formatCommand = context.commands.registerCommand('sql-formatter.format', {
  title: 'Format SQL',
  execute: () => {
    const sql = context.sqlLab.getCurrentQuery();

    const formatted = format(sql, {
      language: 'sql',
      indent: '  ',
      uppercase: true,
      linesBetweenQueries: 2,
    });

    context.sqlLab.replaceQuery(formatted);
  }
});

// Auto-format on save
context.sqlLab.onWillSaveQuery((event) => {
  if (context.storage.local.get('autoFormat')) {
    const formatted = format(event.query);
    event.waitUntil(Promise.resolve(formatted));
  }
});
```

## Query History Search

Enhanced query history with advanced search and filtering.

### Features
- Full-text search
- Filter by date, user, database
- Query statistics
- Export capabilities

### UI Component

```typescript
function QueryHistoryPanel() {
  const [queries, setQueries] = useState<Query[]>([]);
  const [filters, setFilters] = useState<Filters>({});

  useEffect(() => {
    loadQueries();
  }, [filters]);

  const loadQueries = async () => {
    const history = await context.network.api.get('/api/v1/query', {
      params: {
        ...filters,
        page_size: 100,
      }
    });

    setQueries(history.result);
  };

  return (
    <div>
      <SearchFilters onChange={setFilters} />
      <Table
        dataSource={queries}
        columns={[
          { title: 'Query', dataIndex: 'sql', ellipsis: true },
          { title: 'Database', dataIndex: 'database' },
          { title: 'Status', dataIndex: 'status' },
          { title: 'Duration', dataIndex: 'duration' },
          { title: 'User', dataIndex: 'user' },
          {
            title: 'Actions',
            render: (query) => (
              <Button
                icon={<CopyOutlined />}
                onClick={() => context.sqlLab.insertText(query.sql)}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
```

## Git Integration

Version control for SQL queries and dashboards.

### Features
- Save queries to Git
- Track changes
- Collaborative editing
- Branch management

### Backend Integration

```python
from git import Repo

class GitExtension:
    def __init__(self, repo_path):
        self.repo = Repo(repo_path)

    def save_query(self, query, message):
        # Save query to file
        path = f"queries/{query.name}.sql"
        with open(path, 'w') as f:
            f.write(query.sql)

        # Commit to Git
        self.repo.index.add([path])
        self.repo.index.commit(message)

        return {
            'status': 'success',
            'commit': self.repo.head.commit.hexsha
        }
```

## Best Practices from Examples

### 1. User Experience
- Provide clear feedback for async operations
- Handle errors gracefully
- Include loading states
- Add keyboard shortcuts

### 2. Performance
- Debounce expensive operations
- Cache API responses
- Use virtual scrolling for large lists
- Lazy load heavy components

### 3. Integration
- Respect Superset's theme
- Use provided UI components
- Follow existing UX patterns
- Integrate with existing menus

### 4. Code Organization
```
extension/
├── frontend/
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API services
│   │   ├── utils/          # Utilities
│   │   └── index.tsx       # Entry point
│   └── tests/
├── backend/
│   ├── src/
│   │   ├── api/           # REST endpoints
│   │   ├── models/        # Data models
│   │   ├── services/      # Business logic
│   │   └── entrypoint.py
│   └── tests/
```

### 5. Testing
```typescript
// Test example
describe('DatasetReferences', () => {
  it('should extract tables from SQL', () => {
    const sql = 'SELECT * FROM users JOIN orders ON users.id = orders.user_id';
    const tables = extractTables(sql);

    expect(tables).toEqual([
      { schema: 'public', table: 'users' },
      { schema: 'public', table: 'orders' },
    ]);
  });
});
```

## Learn More

- [API Reference](../api/frontend)
- [Architecture Overview](../architecture/overview)
- [Getting Started Guide](../getting-started)
- [CLI Documentation](../cli/overview)
