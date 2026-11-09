---
title: Progressive MCP source discovery
---

<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements. See the NOTICE file distributed with
this work for additional information regarding copyright ownership.
The ASF licenses this file to You under the Apache License, Version 2.0
(the "License"); you may not use this file except in compliance with
 the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

Discover source summaries before requesting selected members. All operations
use the acting user's current permissions and metadata privacy controls;
discovery does not grant later query access.

## SQL datasets

Use `list_datasets` to select a source, then opt into bounded metadata with
`get_dataset_info`:

```json
{"request":{"identifier":13,"discovery":{"section":"summary"}}}
```

The response contains `source: {"type":"table","id":13}`, `section`, and a
`summary` with UUID, name, description, `is_virtual`, and `main_dttm_col`. It does
not load member relationships or return the dataset's SQL definition.

```json
{"request":{"identifier":13,"discovery":{"section":"columns","search":"country","page":1,"page_size":25}}}
```

Choose `columns` or `metrics`. Pages contain `items`, `page`, `page_size`,
`has_more`, and `next_page`. Repeat the same source, section, search, and page
size with `next_page`; null means the end. Default page size is 25, maximum 100.
Search is a literal, case-insensitive substring of member name, verbose name,
or description, limited to 200 characters. Saved metric expressions and row
values are never included.

The summary section defaults when omitted and rejects search/pagination.
`discovery` cannot be combined with explicit `select_columns` (including its
`columns` alias) or `column_fields`. Omitting `discovery` retains the existing
response and field-selection behavior. Dataset routing constraints still apply.

## Semantic views

```json
{"request":{"search":"revenue","page":1,"page_size":25}}
```

Pass this to `list_semantic_views`. It returns `sources`, each containing
`source: {"type":"semantic_view","id":42}`, UUID, stored name, and provider
type, plus the same continuation fields. Search matches stored name/description;
page and search limits match dataset member discovery. Access is filtered before
SQL pagination. No total count, encrypted configuration, members, selection
versions, provider calls, or readiness claims are included.

Semantic layers must be enabled. Dataset-read permission and metadata privacy
checks apply independently of view/layer datasource grants. This tool is
unavailable when MCP SQL-dataset routing is configured: semantic views are not
registered SQL datasets. A source summary does not imply that its provider is
configured or that a particular consumer supports querying it. Fetch selected
member metadata only when needed through the appropriate metadata tools.

Pages reflect live metadata and grants, not snapshots. Changes between requests
can move page boundaries; every request checks current access again.
