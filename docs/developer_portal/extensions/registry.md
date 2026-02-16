---
title: Community Extensions
sidebar_position: 11
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

# Community Extensions

This page serves as a registry of community-created Superset extensions. These extensions are developed and maintained by community members and are not officially supported or vetted by the Apache Superset project. **Before installing any community extension, administrators are responsible for evaluating the extension's source code for security vulnerabilities, performance impact, UI/UX quality, and compatibility with their Superset deployment.**

## Extensions

| Name                                                                                                                | Description                                                                                                                                                                                                                                         | Author             | Preview                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Extensions API Explorer](https://github.com/michael-s-molina/superset-extensions/tree/main/api_explorer)           | A SQL Lab panel that demonstrates the Extensions API by providing an interactive explorer for testing commands like getTabs, getCurrentTab, and getDatabases. Useful for extension developers to understand and experiment with the available APIs. | Michael S. Molina  | <a href="/img/extensions/api-explorer.png" target="_blank"><img src="/img/extensions/api-explorer.png" alt="Extensions API Explorer" width="120" /></a>             |
| [SQL Query Flow Visualizer](https://github.com/msyavuz/superset-sql-visualizer)                                     | A SQL Lab panel that transforms SQL queries into interactive flow diagrams, helping developers and analysts understand query execution paths and data relationships.                                                                                | Mehmet Salih Yavuz | <a href="/img/extensions/sql-flow-visualizer.png" target="_blank"><img src="/img/extensions/sql-flow-visualizer.png" alt="SQL Flow Visualizer" width="120" /></a>   |
| [SQL Lab Export to Google Sheets](https://github.com/michael-s-molina/superset-extensions/tree/main/sqllab_gsheets) | A Superset extension that allows users to export SQL Lab query results directly to Google Sheets.                                                                                                                                                   | Michael S. Molina  | <a href="/img/extensions/gsheets-export.png" target="_blank"><img src="/img/extensions/gsheets-export.png" alt="SQL Lab Export to Google Sheets" width="120" /></a> |
| [SQL Lab Export to Parquet](https://github.com/rusackas/superset-extensions/tree/main/sqllab_parquet)               | Export SQL Lab query results directly to Apache Parquet format with Snappy compression.                                                                                                                                                             | Evan Rusackas      | <a href="/img/extensions/parquet-export.png" target="_blank"><img src="/img/extensions/parquet-export.png" alt="SQL Lab Export to Parquet" width="120" /></a>       |
| [SQL Lab Query Comparison](https://github.com/michael-s-molina/superset-extensions/tree/main/query_comparison)      | A SQL Lab extension that enables side-by-side comparison of query results across different tabs, with GitHub-style diff visualization showing added/removed rows and columns.                                                                       | Michael S. Molina  | <a href="/img/extensions/query-comparison.png" target="_blank"><img src="/img/extensions/query-comparison.png" alt="Query Comparison" width="120" /></a>            |
| [SQL Lab Result Stats](https://github.com/michael-s-molina/superset-extensions/tree/main/result_stats)              | A SQL Lab extension that automatically computes statistics for query results, providing type-aware analysis including numeric metrics (min, max, mean, median, std dev), string analysis (length, empty counts), and date range information.        | Michael S. Molina  | <a href="/img/extensions/result-stats.png" target="_blank"><img src="/img/extensions/result-stats.png" alt="Result Stats" width="120" /></a>                        |
| [SQL Snippets](https://github.com/michael-s-molina/superset-extensions/tree/main/sql_snippets)                      | A SQL Lab extension that provides reusable SQL code snippets, enabling quick insertion of commonly used code blocks such as license headers, author information, and frequently used SQL patterns.                                                  | Michael S. Molina  | <a href="/img/extensions/sql-snippets.png" target="_blank"><img src="/img/extensions/sql-snippets.png" alt="SQL Snippets" width="120" /></a>                        |
| [SQL Lab Query Estimator](https://github.com/michael-s-molina/superset-extensions/tree/main/query_estimator)        | A SQL Lab panel that analyzes query execution plans to estimate resource impact, detect performance issues like Cartesian products and high-cost operations, and visualize the query plan tree.                                                     | Michael S. Molina  | <a href="/img/extensions/query-estimator.png" target="_blank"><img src="/img/extensions/query-estimator.png" alt="Query Estimator" width="120" /></a>               |
| [Editors Bundle](https://github.com/michael-s-molina/superset-extensions/tree/main/editors_bundle)                  | A Superset extension that demonstrates how to provide custom code editors for different languages. This extension showcases the editor contribution system by registering alternative editors that can replace Superset's default Ace editor.        | Michael S. Molina  | <a href="/img/extensions/editors-bundle.png" target="_blank"><img src="/img/extensions/editors-bundle.png" alt="Editors Bundle" width="120" /></a>                  |

## How to Add Your Extension

To add your extension to this registry, submit a pull request to the [Apache Superset repository](https://github.com/apache/superset) with the following changes:

1. Add a row to the **Extensions** table above using this format:

```markdown
| [Your Extension](https://github.com/your-username/your-repo) | A brief description of your extension. | Your Name | <a href="/img/extensions/your-screenshot.png" target="_blank"><img src="/img/extensions/your-screenshot.png" alt="Your Extension" width="120" /></a> |
```

2. Add a screenshot to `docs/static/img/extensions/` (recommended size: 800x450px, PNG or JPG format)

3. Submit your PR with a title like "docs: Add [Extension Name] to community extensions registry"
