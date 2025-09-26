---
title: SQL Lab Extensions
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

# SQL Lab Extension Examples

SQL Lab is the primary focus area for Superset's extension architecture. This page showcases various extension examples that demonstrate the capabilities and patterns for extending SQL Lab.

## Dataset References Extension

### Overview
Displays metadata about tables referenced in SQL queries, including ownership, partitions, and row counts.

### Key Features
- Parses SQL queries to identify referenced tables
- Shows table owners for access requests
- Displays latest partition information
- Provides estimated row counts

### Implementation Highlights

```typescript
// Parse query and extract table references
const tables = sqlLab.getCurrentQuery()
  .match(/FROM\s+(\w+\.\w+)/gi)
  ?.map(match => match.split(/\s+/)[1]);

// Fetch metadata for each table
const metadata = await Promise.all(
  tables.map(table =>
    api.get(`/extensions/dataset_references/metadata/${table}`)
  )
);
```

## Query Optimizer Extension

### Overview
Analyzes SQL queries and suggests optimizations for better performance.

### Key Features
- Identifies missing indexes
- Suggests query rewrites
- Detects common anti-patterns
- Provides execution plan analysis

### Implementation Pattern

```typescript
export function activate(context: ExtensionContext) {
  // Add optimization panel
  context.registerView('optimizer.panel', <OptimizerPanel />);

  // Register command for quick optimization
  context.registerCommand('optimizer.analyze', {
    execute: async () => {
      const query = sqlLab.getCurrentQuery();
      const suggestions = await analyzeQuery(query);
      showSuggestions(suggestions);
    }
  });

  // Add context menu item
  context.registerMenuItem({
    command: 'optimizer.analyze',
    when: 'editorTextFocus && !editorReadonly'
  });
}
```

## Natural Language Query Extension

### Overview
Enables natural language to SQL conversion using LLM integration.

### Key Features
- Natural language input interface
- Context-aware table suggestions
- Query validation and explanation
- History of conversions

### Frontend Component

```tsx
const NLQueryPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [sql, setSql] = useState('');

  const convertToSQL = async () => {
    const response = await api.post('/extensions/nl_query/convert', {
      natural_language: input,
      database: sqlLab.getCurrentDatabase(),
      schema: sqlLab.getCurrentSchema()
    });

    setSql(response.data.sql);

    // Insert into editor
    sqlLab.insertText(response.data.sql);
  };

  return (
    <div className="nl-query-panel">
      <TextArea
        placeholder="Describe your query in natural language..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <Button onClick={convertToSQL}>Convert to SQL</Button>
      {sql && <SQLPreview value={sql} />}
    </div>
  );
};
```

### Backend Integration

```python
from superset_core.llm import LLMProvider

class NLQueryAPI(BaseApi):
    @expose("/convert", methods=["POST"])
    def convert_nl_to_sql(self):
        data = request.json

        # Get schema context
        tables = models.get_tables(
            database=data['database'],
            schema=data['schema']
        )

        # Generate SQL using LLM
        llm = LLMProvider.get_instance()
        sql = llm.generate_sql(
            prompt=data['natural_language'],
            context=tables
        )

        # Validate generated SQL
        validation = validate_sql(sql, data['database'])

        return self.response(200, sql=sql, valid=validation.is_valid)
```

## Query Version Control Extension

### Overview
Adds Git-like version control for SQL queries within SQL Lab.

### Key Features
- Save query versions
- Compare versions with diff view
- Restore previous versions
- Share versioned queries

### State Management

```typescript
interface QueryVersion {
  id: string;
  query: string;
  timestamp: Date;
  author: string;
  message: string;
  parent?: string;
}

class VersionStore {
  private versions: Map<string, QueryVersion[]> = new Map();

  commit(query: string, message: string): QueryVersion {
    const version: QueryVersion = {
      id: generateId(),
      query,
      timestamp: new Date(),
      author: authentication.getCurrentUser(),
      message,
      parent: this.getCurrentVersion()?.id
    };

    this.addVersion(version);
    return version;
  }

  diff(v1: string, v2: string): DiffResult {
    const version1 = this.getVersion(v1);
    const version2 = this.getVersion(v2);
    return computeDiff(version1.query, version2.query);
  }
}
```

## Schema Explorer Extension

### Overview
Enhanced schema browser with advanced search and visualization capabilities.

### Key Features
- Visual ERD generation
- Advanced search with filters
- Column-level statistics
- Relationship visualization

### Visualization Component

```tsx
const SchemaERD: React.FC<{tables: Table[]}> = ({tables}) => {
  useEffect(() => {
    const graph = new Graph({
      container: 'erd-container',
      data: transformToGraphData(tables),
      layout: {
        type: 'force',
        preventOverlap: true
      }
    });

    graph.on('node:click', (evt) => {
      const table = evt.item.getModel();
      sqlLab.insertText(`SELECT * FROM ${table.id} LIMIT 100`);
    });

    graph.render();
  }, [tables]);

  return <div id="erd-container" />;
};
```

## Query Execution Monitor

### Overview
Real-time monitoring and profiling of query execution.

### Key Features
- Live execution progress
- Resource usage metrics
- Query plan visualization
- Performance recommendations

### Real-time Updates

```typescript
const ExecutionMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics>({});

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8088/extensions/monitor');

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMetrics(prev => ({
        ...prev,
        [data.queryId]: data.metrics
      }));
    };

    // Subscribe to query execution
    const disposable = sqlLab.onDidQueryRun((editor) => {
      socket.send(JSON.stringify({
        action: 'monitor',
        queryId: editor.queryId
      }));
    });

    return () => {
      disposable.dispose();
      socket.close();
    };
  }, []);

  return <MetricsDisplay metrics={metrics} />;
};
```

## Autocomplete Enhancement Extension

### Overview
Adds intelligent autocomplete with context awareness and snippets.

### Key Features
- Context-aware suggestions
- Custom snippet library
- Function documentation
- Table/column descriptions

### Custom Provider Implementation

```typescript
class SmartAutocompleteProvider implements AutocompleteProvider {
  async provideCompletionItems(
    model: editor.ITextModel,
    position: Position
  ): Promise<CompletionList> {
    const context = this.getContext(model, position);

    const suggestions = await Promise.all([
      this.getTableSuggestions(context),
      this.getColumnSuggestions(context),
      this.getSnippets(context),
      this.getFunctionSuggestions(context)
    ]);

    return {
      suggestions: suggestions.flat().map(s => ({
        label: s.label,
        kind: s.type,
        insertText: s.text,
        documentation: s.docs,
        detail: s.detail
      }))
    };
  }

  private async getSnippets(context: Context) {
    return [
      {
        label: 'select-join',
        text: `SELECT \${1:columns}
FROM \${2:table1} t1
JOIN \${3:table2} t2 ON t1.\${4:id} = t2.\${5:id}
WHERE \${6:condition}`,
        type: CompletionItemKind.Snippet
      }
    ];
  }
}

// Register the provider
sqlLab.registerAutocompleteProvider(new SmartAutocompleteProvider());
```

## Best Practices for SQL Lab Extensions

### Performance Optimization
- Use lazy loading for heavy components
- Cache API responses when appropriate
- Debounce user input handlers
- Use virtual scrolling for large lists

### User Experience
- Provide clear loading states
- Handle errors gracefully
- Add keyboard shortcuts for common actions
- Maintain consistency with SQL Lab UI

### Security
- Validate all user inputs
- Use proper authentication for API calls
- Sanitize SQL before execution
- Follow RBAC patterns from core

### Testing
- Write unit tests for components
- Test API endpoints thoroughly
- Validate SQL parsing logic
- Test with various database engines

## Common Patterns

### Query Analysis Pattern

```typescript
// Common pattern for analyzing queries
async function analyzeQuery(query: string) {
  // Parse the query
  const ast = parseSQL(query);

  // Extract metadata
  const tables = extractTables(ast);
  const columns = extractColumns(ast);
  const filters = extractFilters(ast);

  // Fetch additional context
  const metadata = await fetchMetadata(tables);

  // Perform analysis
  return {
    tables,
    columns,
    filters,
    metadata,
    suggestions: generateSuggestions(ast, metadata)
  };
}
```

### State Synchronization Pattern

```typescript
// Keep extension state in sync with SQL Lab
function syncWithSQLLab(store: ExtensionStore) {
  // Sync on tab change
  sqlLab.onDidChangeActiveTab((tab) => {
    store.setActiveQuery(tab.query);
  });

  // Sync on query change
  sqlLab.onDidChangeQuery((query) => {
    store.updateQuery(query);
  });

  // Sync on execution
  sqlLab.onDidQueryRun((result) => {
    store.addExecutionResult(result);
  });
}
```

### API Integration Pattern

```typescript
// Wrapper for extension API calls
class ExtensionAPI {
  private baseURL = '/api/v1/extensions/my_extension';

  async request(endpoint: string, options?: RequestOptions) {
    const token = await authentication.getCSRFToken();

    return fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...options?.headers,
        'X-CSRFToken': token
      }
    });
  }

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## Resources

- [Frontend API Reference](/developer_portal/api/frontend)
- [Extension Architecture](/developer_portal/architecture/overview)
- [Your First Extension](/developer_portal/get-started/your-first-extension)
- [SQL Lab Extension Repository](https://github.com/apache-superset/sql-lab-extensions)
